from fastapi import FastAPI
from pydantic import BaseModel
from rag import ask_question
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
)

logger = logging.getLogger(__name__)
app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  
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
    logger.info(f"Received query: {q.query}")

    try:
        answer = ask_question(q.query)

        if not answer:
            logger.warning("No answer found in document.")
            raise HTTPException(status_code=404, detail="No answer found in document.")

        logger.info("Answer generated successfully.")
        return {"answer": answer}

    except HTTPException as e:
        raise e

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error.")

