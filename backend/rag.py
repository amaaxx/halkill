import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from logger import get_logger

from database import SessionLocal
import models

logger = get_logger(__name__)
load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY is not set properly.")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "chroma_db")

llm = ChatGoogleGenerativeAI(
    model="models/gemini-2.5-flash",
    google_api_key=GOOGLE_API_KEY,
    temperature=0.3,
    max_tokens=8192
)

embedding_function = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

vector_store = Chroma(
    persist_directory=DB_PATH,
    embedding_function=embedding_function
)

async def ask_question_stream(query: str, history: list, username: str, filename: str, session_id: int, strict_mode: bool):
    db = SessionLocal()
    try:
        user_msg = models.ChatMessage(session_id=session_id, role="user", content=query)
        db.add(user_msg)
        db.commit()
    finally:
        db.close()

    formatted_history = ""
    for msg in history[-6:]: 
        speaker = "Human" if msg["role"] == "user" else "AI"
        formatted_history += f"{speaker}: {msg['content']}\n"

    context_text = ""
    if filename:
        dynamic_retriever = vector_store.as_retriever(
            search_type="mmr", 
            search_kwargs={
                "k": 40, "fetch_k": 150, "lambda_mult": 0.2,
                "filter": { "$and": [ {"username": username}, {"source": filename} ] }
            }
        )
        docs = await dynamic_retriever.ainvoke(query)
        
        context_entries = []
        for doc in docs:
            src = doc.metadata.get("source", "Unknown")
            page = doc.metadata.get("page", "N/A")
            context_entries.append(f"--- [Source: {src}, Page: {page}] ---\n{doc.page_content}")
        context_text = "\n\n".join(context_entries)

    if not filename:
        sys_prompt = "You are a helpful AI assistant. Answer queries directly using your general knowledge.\nChat History:\n{history}"
        messages = ChatPromptTemplate.from_messages([("system", sys_prompt), ("human", "{input}")]).format_messages(history=formatted_history, input=query)
    elif strict_mode:
        sys_prompt = """You are a strict Research Assistant.
        RULE: Answer ONLY using the provided Document Context. 
        CITATION RULE: Cite ONLY the page number concisely at the end of the sentence using backticks, like this: `[Pg. 45]`. DO NOT repeat the filename.
        RULE: End your response with [CONFIDENCE: HIGH], [CONFIDENCE: MEDIUM], or [CONFIDENCE: LOW].
        If data is missing, say 'I cannot find this information' and end with [CONFIDENCE: LOW].
        Chat History:\n{history}\nDocument Context:\n{context}"""
        messages = ChatPromptTemplate.from_messages([("system", sys_prompt), ("human", "{input}")]).format_messages(history=formatted_history, context=context_text, input=query)
    else:
        sys_prompt = """You are a Hybrid Knowledge Engine.
        Use the Document Context as your primary source. CITATION RULE: Cite ONLY the page number concisely using backticks, like this: `[Pg. 45]`. DO NOT repeat the filename.
        If the context is insufficient, use your general knowledge but clearly state you are doing so.
        End your response with [CONFIDENCE: HIGH] (if in document), [CONFIDENCE: MEDIUM] (if inferred), or [CONFIDENCE: EXTERNAL] (if using general knowledge).
        Chat History:\n{history}\nDocument Context:\n{context}"""
        messages = ChatPromptTemplate.from_messages([("system", sys_prompt), ("human", "{input}")]).format_messages(history=formatted_history, context=context_text, input=query)

    full_ai_response = ""
    async for chunk in llm.astream(messages):
        if chunk.content:
            full_ai_response += chunk.content
            yield chunk.content

    db = SessionLocal()
    try:
        ai_msg = models.ChatMessage(session_id=session_id, role="ai", content=full_ai_response)
        db.add(ai_msg)
        db.commit()
    finally:
        db.close()

def add_pdf_to_vector_store(file_path: str, username: str, filename: str):
    logger.info(f"Processing new PDF: {file_path}")
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found at {file_path}")

    loader = PyMuPDFLoader(file_path)
    docs = loader.load()

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=400)
    chunks = text_splitter.split_documents(docs)

    for chunk in chunks:
        chunk.metadata["username"] = username
        chunk.metadata["source"] = filename

    vector_store.add_documents(chunks)