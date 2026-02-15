from fastapi import FastAPI
from pydantic import BaseModel
from rag import ask_question
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # later we restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



class Question(BaseModel):
    query: str

@app.get("/")
def home():
    return {"status": "Academic Engine is Active"}

@app.post("/ask")
def ask(q: Question):
    try:
        answer = ask_question(q.query)
        return {"success": True, "answer": answer}
    except Exception as e:
        return {"success": False, "error": str(e)}

