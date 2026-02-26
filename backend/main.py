from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from rag import ask_question
from logger import get_logger
import uuid

logger = get_logger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


class Question(BaseModel):
    query: str


@app.get("/")
def home():
    return {"status": "Academic Engine is Active"}


@app.post("/ask")
def ask(q: Question, request: Request):

    request_id = request.state.request_id
    logger.info(f"[{request_id}] Received query: {q.query}")

    answer = ask_question(q.query)

    if not answer:
        logger.warning(f"[{request_id}] No answer found")
        raise HTTPException(status_code=404, detail="No answer found")

    logger.info(f"[{request_id}] Answer generated successfully")

    return {
        "success": True,
        "answer": answer,
        "request_id": request_id
    }