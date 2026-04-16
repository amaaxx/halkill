import os
import time
import asyncio

import pandas as pd
from dotenv import load_dotenv
from langchain_community.document_loaders import PyMuPDFLoader, TextLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_core.messages import SystemMessage, HumanMessage
from supabase.client import create_client


from logger import get_logger
from database import SessionLocal
import models

logger = get_logger(__name__)
load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not all([GOOGLE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    raise ValueError("Missing critical environment variables.")

# Initialize Supabase Client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash-lite", 
    google_api_key=GOOGLE_API_KEY,
    temperature=0.2, 
    max_tokens=4096
)

GLOBAL_EMBEDDING = None

# Dimension target for Supabase pgvector schema
TARGET_DIMS = 768

class CloudEmbeddings:
    """Zero-RAM cloud embeddings via Gemini API with built-in rate-limit protection."""
    def __init__(self):
        self.model = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=GOOGLE_API_KEY,
        )
    
    def _truncate(self, vec: list[float]) -> list[float]:
        """Slice 3072-dim Gemini vectors down to 768 to fit Supabase schema."""
        return vec[:TARGET_DIMS]

    def _retry_embed(self, fn, *args, max_retries=6):
        """Retry with exponential backoff on 429 rate-limit errors."""
        for attempt in range(max_retries):
            try:
                return fn(*args)
            except Exception as e:
                if "429" in str(e) and attempt < max_retries - 1:
                    wait = (2 ** attempt) * 2  # 2, 4, 8, 16, 32, 64s
                    logger.warning(f"Embedding rate limited. Retry {attempt+1}/{max_retries} in {wait}s...")
                    time.sleep(wait)
                else:
                    raise

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        raw = self._retry_embed(self.model.embed_documents, texts)
        return [self._truncate(v) for v in raw]

    def embed_query(self, text: str) -> list[float]:
        raw = self._retry_embed(self.model.embed_query, text)
        return self._truncate(raw)

def get_embeddings():
    global GLOBAL_EMBEDDING
    if GLOBAL_EMBEDDING is None:
        logger.info("Initializing Cloud Embeddings (gemini-embedding-001, 0 MB local RAM)...")
        GLOBAL_EMBEDDING = CloudEmbeddings()
    return GLOBAL_EMBEDDING

async def ask_question_stream(query: str, history: list, username: str, filename: str, session_id: int, strict_mode: bool, image_data: str = None):
    db_content = f"![Image]({image_data})\n\n{query}" if image_data else query
    db = SessionLocal()
    try:
        user_msg = models.ChatMessage(session_id=session_id, role="user", content=db_content)
        db.add(user_msg)
        db.commit()
    finally:
        db.close()

    formatted_history = ""
    for msg in history[-3:]: 
        speaker = "Human" if msg["role"] == "user" else "AI"
        formatted_history += f"{speaker}: {msg['content']}\n"

    context_text = ""
    if filename:
        ext = os.path.splitext(filename)[1].lower()
        is_tabular = ext in [".xlsx", ".xls", ".csv"]
        
        filter_dict = {"username": username, "source": filename}
        k_val = 20 if is_tabular else 8
        
        # ---------------------------------------------------------
        # THE CUSTOM RETRIEVER (Bypassing LangChain's broken wrapper)
        # ---------------------------------------------------------
        try:
            # 1. Turn the user's question into a math vector
            query_embedding = get_embeddings().embed_query(query)
            
            # 2. Call your raw SQL function directly inside Supabase
            response = supabase.rpc("match_vecs", {
                "query_embedding": query_embedding,
                "match_threshold": 0.0, 
                "match_count": k_val,
                "filter": filter_dict
            }).execute()
            
            # 3. Format the returned rows into our Prompt Context
            context_entries = []
            for row in response.data:
                page = row.get("metadata", {}).get("page", "N/A")
                content = row.get("content", "")
                context_entries.append(f"--- [Pg. {page}] ---\n{content}")
                
            context_text = "\n\n".join(context_entries)
            
        except Exception as e:
            logger.error(f"Custom Retrieval Error: {str(e)}")
            context_text = "I could not retrieve the document data due to a database error."

    if not filename:
        sys_p = "Helpful AI. History: {history}"
    elif strict_mode:
        sys_p = "Strict Assistant. Answer ONLY using context. Cite: `[Pg. X]`. End with [CONFIDENCE: HIGH/MED/LOW]. Context: {context} \nHistory: {history}"
    else:
        sys_p = "Hybrid AI. Use context primarily. Cite: `[Pg. X]`. OK to use general knowledge if clear. End with [CONFIDENCE: HIGH/MED/EXT]. Context: {context} \nHistory: {history}"

    formatted_sys = sys_p.format(history=formatted_history, context=context_text)

    messages = [SystemMessage(content=formatted_sys)]
    h_content = [{"type": "text", "text": query}]
    if image_data:
        h_content.append({"type": "image_url", "image_url": {"url": image_data}})
    messages.append(HumanMessage(content=h_content))

    full_ai_response = ""
    max_retries = 5
    for attempt in range(max_retries):
        try:
            async for chunk in llm.astream(messages):
                if chunk.content:
                    full_ai_response += chunk.content
                    yield chunk.content
            break
        except Exception as e:
            if "429" in str(e) and attempt < max_retries - 1:
                wait_time = (2 ** attempt) * 3  # 3, 6, 12, 24 seconds backoff
                logger.warning(f"Rate limited. Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
                continue
            else:
                logger.error(f"Engine Error: {str(e)}")
                yield f"System error: {str(e)}"
                break

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
        
        current_chunk = ""
        start_row = 2
        for index, row in df.iterrows():
            row_text = " | ".join([f"{col}: {val}" for col, val in row.items() if pd.notna(val) and str(val).strip() != ""])
            current_chunk += f"[Row {index+2}] {row_text}\n"
            if (index + 1) % 5 == 0:
                docs.append(Document(page_content=current_chunk, metadata={"source": filename, "page": f"Rows {start_row}-{index+2}"}))
                current_chunk = ""
                start_row = index + 3
        if current_chunk:
            docs.append(Document(page_content=current_chunk, metadata={"source": filename, "page": f"Rows {start_row}-{len(df)+1}"}))
    
    if not is_tabular:
        # Increased chunk size to reduce database load and processing chunks
        chunks = RecursiveCharacterTextSplitter(chunk_size=3000, chunk_overlap=600).split_documents(docs)
    else:
        chunks = docs 

    for chunk in chunks:
        chunk.metadata["username"] = username
        chunk.metadata["source"] = filename

    # BATCH INSERTION TO CLOUD DB (raw insert to bypass supabase-py/LangChain incompatibility)
    # Small batches + delay to stay well under Gemini's 1500 RPM embedding quota
    batch_size = 20
    embedder = get_embeddings()

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i+batch_size]
        texts = [c.page_content for c in batch]
        metadatas = [c.metadata for c in batch]
        vectors = embedder.embed_documents(texts)

        rows = [
            {
                "content": texts[j],
                "metadata": metadatas[j],
                "embedding": vectors[j],
            }
            for j in range(len(batch))
        ]
        supabase.table("langchain_vecs").insert(rows).execute()
        time.sleep(1)