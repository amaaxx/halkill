import os
import time
import pandas as pd
from dotenv import load_dotenv
from langchain_community.document_loaders import PyMuPDFLoader, TextLoader, CSVLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
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

# 1. SWITCHING TO FLASH-LITE
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash-lite", 
    google_api_key=GOOGLE_API_KEY,
    temperature=0.2, # Lower temperature for better factual accuracy
    max_tokens=4096
)

embedding_function = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

vector_store = Chroma(
    persist_directory=DB_PATH,
    embedding_function=embedding_function
)

async def ask_question_stream(query: str, history: list, username: str, filename: str, session_id: int, strict_mode: bool, image_data: str = None):
    # Log user message
    db_content = f"![Image]({image_data})\n\n{query}" if image_data else query
    db = SessionLocal()
    try:
        user_msg = models.ChatMessage(session_id=session_id, role="user", content=db_content)
        db.add(user_msg)
        db.commit()
    finally:
        db.close()

    # Shorten history to save tokens
    formatted_history = ""
    for msg in history[-3:]: 
        speaker = "Human" if msg["role"] == "user" else "AI"
        formatted_history += f"{speaker}: {msg['content']}\n"

    context_text = ""
    if filename:
        ext = os.path.splitext(filename)[1].lower()
        is_tabular = ext in [".xlsx", ".xls", ".csv"]
        
        # DYNAMIC RETRIEVER: Similarity for Excel, MMR for PDFs
        search_type = "similarity" if is_tabular else "mmr"
        search_kwargs = {
            "k": 15, # Balanced token limit
            "filter": { "$and": [ {"username": username}, {"source": filename} ] }
        }
        if not is_tabular:
            search_kwargs["fetch_k"] = 50
            search_kwargs["lambda_mult"] = 0.3

        dynamic_retriever = vector_store.as_retriever(search_type=search_type, search_kwargs=search_kwargs)
        docs = await dynamic_retriever.ainvoke(query)
        
        context_text = "\n\n".join([f"--- [Pg. {d.metadata.get('page', 'N/A')}] ---\n{d.page_content}" for d in docs])

    # 2. SHORT-FORM PROMPT (Token Optimized)
    if not filename:
        sys_p = "Helpful AI. History: {history}"
    elif strict_mode:
        sys_p = "Strict Assistant. Answer ONLY using context. Cite: `[Pg. X]`. End with [CONFIDENCE: HIGH/MED/LOW]. Context: {context} \nHistory: {history}"
    else:
        sys_p = "Hybrid AI. Use context primarily. Cite: `[Pg. X]`. OK to use general knowledge if clear. End with [CONFIDENCE: HIGH/MED/EXT]. Context: {context} \nHistory: {history}"

    formatted_sys = sys_p.format(history=formatted_history, context=context_text)

    # 3. RETRY SHIELD (Exponential Backoff)
    messages = [SystemMessage(content=formatted_sys)]
    h_content = [{"type": "text", "text": query}]
    if image_data:
        h_content.append({"type": "image_url", "image_url": {"url": image_data}})
    messages.append(HumanMessage(content=h_content))

    full_ai_response = ""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async for chunk in llm.astream(messages):
                if chunk.content:
                    full_ai_response += chunk.content
                    yield chunk.content
            break # Success!
        except Exception as e:
            if "429" in str(e) and attempt < max_retries - 1:
                wait_time = (2 ** attempt) + 1
                logger.warning(f"Rate limited. Retrying in {wait_time}s...")
                time.sleep(wait_time)
                continue
            else:
                logger.error(f"Brain Error: {str(e)}")
                yield f"System error: {str(e)}"
                break

    # Save AI Response
    db = SessionLocal()
    try:
        ai_msg = models.ChatMessage(session_id=session_id, role="ai", content=full_ai_response)
        db.add(ai_msg)
        db.commit()
    finally:
        db.close()


def add_document_to_vector_store(file_path: str, username: str, filename: str):
    ext = os.path.splitext(filename)[1].lower()
    docs = []
    is_tabular = False
    
    if ext == ".pdf":
        loader = PyMuPDFLoader(file_path)
        docs = loader.load()
    elif ext in [".txt", ".md"]:
        loader = TextLoader(file_path, encoding="utf-8")
        docs = loader.load()
    elif ext in [".xlsx", ".xls", ".csv"]:
        is_tabular = True
        df = pd.read_csv(file_path) if ext == ".csv" else pd.read_excel(file_path)
        df = df.fillna("") 
        
        current_chunk = ""
        start_row = 2
        # 5 ROWS PER CHUNK: Maximum search accuracy for employee names
        for index, row in df.iterrows():
            row_text = " | ".join([f"{col}: {val}" for col, val in row.items() if str(val).strip() != ""])
            current_chunk += f"[Row {index+2}] {row_text}\n"
            if (index + 1) % 5 == 0:
                docs.append(Document(page_content=current_chunk, metadata={"source": filename, "page": f"Rows {start_row}-{index+2}"}))
                current_chunk = ""
                start_row = index + 3
        if current_chunk:
            docs.append(Document(page_content=current_chunk, metadata={"source": filename, "page": f"Rows {start_row}-{len(df)+1}"}))
    
    if not is_tabular:
        chunks = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=400).split_documents(docs)
    else:
        chunks = docs 

    for chunk in chunks:
        chunk.metadata["username"] = username
        chunk.metadata["source"] = filename

    # BATCH INSERTION WITH BREATHER
    batch_size = 100 
    for i in range(0, len(chunks), batch_size):
        vector_store.add_documents(chunks[i:i+batch_size])
        time.sleep(0.2) # Breather for ChromaDB