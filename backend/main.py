import os
import shutil
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any
import uuid

from database import engine, get_db
import models, schemas, security
from rag import ask_question_stream, add_document_to_vector_store
from logger import get_logger

from fastapi import Depends, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt

models.Base.metadata.create_all(bind=engine)

logger = get_logger(__name__)

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://halkill.vercel.app"  
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"[{request_id}] Unhandled error", exc_info=True)
    return JSONResponse(status_code=500, content={"success": False, "error": {"message": "Internal server error"}})

@app.post("/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.username == user.username).first()
    if existing_user: raise HTTPException(status_code=400, detail="Username already registered")
    hashed_pw = security.get_password_hash(user.password)
    new_user = models.User(username=user.username, email=user.email, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect credentials", headers={"WWW-Authenticate": "Bearer"})
    access_token = security.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/")
def home():
    return {"status": "Halkill Engine is Active"}

@app.get("/documents")
def get_user_documents(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(models.Document).filter(models.Document.owner_id == current_user.id).all()
    return {"files": list(set([doc.filename for doc in docs]))}

@app.post("/chats", response_model=schemas.ChatSessionResponse)
def create_chat_session(chat_req: schemas.ChatCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    title = f"Chat about {chat_req.filename}" if chat_req.filename else "General Chat"
    new_chat = models.ChatSession(title=title, document_filename=chat_req.filename, owner_id=current_user.id)
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)
    return new_chat

@app.get("/chats", response_model=List[schemas.ChatSessionResponse])
def get_user_chats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.ChatSession).filter(models.ChatSession.owner_id == current_user.id).order_by(models.ChatSession.created_at.desc()).all()

@app.get("/chats/{session_id}/messages", response_model=List[schemas.MessageResponse])
def get_chat_history(session_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id, models.ChatSession.owner_id == current_user.id).first()
    if not session: raise HTTPException(status_code=404)
    return db.query(models.ChatMessage).filter(models.ChatMessage.session_id == session_id).order_by(models.ChatMessage.created_at.asc()).all()

@app.post("/ask")
async def ask(q: schemas.Question, request: Request, current_user: models.User = Depends(get_current_user)):
    if not q.session_id: raise HTTPException(status_code=400, detail="session_id required")
    return StreamingResponse(
        ask_question_stream(q.query, q.history, current_user.username, q.filename, q.session_id, q.strict_mode, q.image_data),
        media_type="text/event-stream"
    )

class ChatRename(BaseModel):
    title: str

@app.put("/chats/{session_id}")
def rename_chat(session_id: int, req: ChatRename, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id, models.ChatSession.owner_id == current_user.id).first()
    if not session: raise HTTPException(status_code=404)
    session.title = req.title
    db.commit()
    return {"success": True}

@app.delete("/chats/{session_id}")
def delete_chat(session_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id, models.ChatSession.owner_id == current_user.id).first()
    if not session: raise HTTPException(status_code=404)
    db.delete(session)
    db.commit()
    return {"success": True}

@app.delete("/documents/{filename}")
def delete_document(filename: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(models.Document).filter(models.Document.filename == filename, models.Document.owner_id == current_user.id).all()
    for doc in docs: db.delete(doc)
    
    # Optional: You could also add logic here to delete the vectors from Supabase
    db.commit()
    return {"success": True}

@app.post("/upload")
async def upload_document(file: UploadFile = File(...), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Create Ephemeral Temp Directory (Safe for Render)
    os.makedirs("/tmp/halkill_data", exist_ok=True)
    file_path = os.path.join("/tmp/halkill_data", file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    new_doc = models.Document(filename=file.filename, owner_id=current_user.id)
    db.add(new_doc)
    db.commit()
    
    try:
        # Extracts to Supabase pgvector
        add_document_to_vector_store(file_path, current_user.username, file.filename) 
    except Exception as e:
        logger.error(f"Failed to process document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to extract text: {str(e)}")
    finally:
        # Clean up ephemeral disk space
        if os.path.exists(file_path):
            os.remove(file_path)
            
    return {"success": True, "filename": file.filename}