import os
import shutil
from fastapi import FastAPI, HTTPException, Request, UploadFile, File #  Add UploadFile and File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from rag import ask_question_stream, add_pdf_to_vector_store # <-- Import the new function
from logger import get_logger
import uuid
from fastapi.responses import JSONResponse, StreamingResponse
from typing import List, Dict, Any

from database import engine

from fastapi import Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

# Import your local Layer 4 files
import models, schemas, security
from database import get_db

# This tells SQLAlchemy to create all tables in Postgres if they don't exist
models.Base.metadata.create_all(bind=engine)


logger = get_logger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# This tells FastAPI where the login URL is to get a token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decode the JWT token using the Secret Key from security.py
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

    logger.error(
        f"[{request_id}] Unhandled error",
        exc_info=True
    )

    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Internal server error",
                "request_id": request_id
            }
        },
    )

# ==========================================
# AUTHENTICATION ROUTES (The Vault)
# ==========================================

@app.post("/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # 1. Check if the username is already taken
    existing_user = db.query(models.User).filter(models.User.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # 2. Scramble (hash) the plain text password
    hashed_pw = security.get_password_hash(user.password)
    
    # 3. Build the database record
    new_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_pw
    )
    
    # 4. Save to PostgreSQL
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Pydantic (UserResponse) automatically strips the password before returning this
    return new_user


@app.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 1. Find the user in the database
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    
    # 2. Verify existence AND check if the password matches the hash
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 3. Generate the Digital ID Card (JWT)
    access_token = security.create_access_token(data={"sub": user.username})
    
    # 4. Hand the token back to the frontend
    return {"access_token": access_token, "token_type": "bearer"}


class Question(BaseModel):
    query: str
    history: List[Dict[str, str]] = [] # Defaults to empty list if no history exists


@app.get("/")
def home():
    return {"status": "Academic Engine is Active"}


@app.post("/ask")
async def ask(
    q: schemas.Question, 
    request: Request, 
    current_user: models.User = Depends(get_current_user) # The Vault Lock
):
    request_id = getattr(request.state, "request_id", "UNKNOWN")
    
    # We now know EXACTLY who is asking the question
    logger.info(f"[{request_id}] User '{current_user.username}' is querying: {q.query}")
    
    logger.info(f"[{request_id}] Initiating streaming response...")
    
    return StreamingResponse(
        ask_question_stream(q.query, q.history),
        media_type="text/event-stream"
    )

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    os.makedirs("data", exist_ok=True)
    file_path = os.path.join("data", file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    logger.info(f"Successfully uploaded: {file.filename}")
    
    # THE UPGRADE: Process the PDF and add it to the Vector Database
    try:
        # This calls LangChain to chop up the PDF and embed it
        add_pdf_to_vector_store(file_path) 
    except Exception as e:
        logger.error(f"Failed to process PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to extract text from PDF: {str(e)}")
    
    return {
        "success": True, 
        "filename": file.filename, 
        "message": "Document uploaded and processed successfully!"
    }