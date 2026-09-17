import os
import time
import asyncio

import pandas as pd
from dotenv import load_dotenv
from langchain_community.document_loaders import PyMuPDFLoader, TextLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from supabase.client import create_client
from google import genai


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

# Supabase client will be injected where needed

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
    """Zero-RAM cloud embeddings via Gemini API with built-in batching to avoid rate limits."""
    def __init__(self):
        self.client = genai.Client(api_key=GOOGLE_API_KEY)
        self.model_name = "gemini-embedding-001"
    
    def _truncate(self, vec: list[float]) -> list[float]:
        """Slice 3072-dim Gemini vectors down to 768 to fit Supabase schema."""
        return vec[:TARGET_DIMS]

    def _retry_embed(self, fn, *args, max_retries=6, **kwargs):
        """Retry with smart backoff parsing exact quota reset times on 429 rate-limit errors."""
        import re
        for attempt in range(max_retries):
            try:
                return fn(*args, **kwargs)
            except Exception as e:
                err_str = str(e)
                if "429" in err_str and attempt < max_retries - 1:
                    match = re.search(r"retry in (\d+(?:\.\d+)?)s", err_str, re.IGNORECASE)
                    wait = float(match.group(1)) + 1.0 if match else (2 ** attempt) * 5
                    logger.warning(f"Embedding rate limited. Retry {attempt+1}/{max_retries} in {wait:.1f}s...")
                    time.sleep(wait)
                else:
                    raise

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        # The new SDK takes a list and batches them automatically in 1 API request!
        response = self._retry_embed(
            self.client.models.embed_content,
            model=self.model_name,
            contents=texts,
        )
        return [self._truncate(v.values) for v in response.embeddings]

    def embed_query(self, text: str) -> list[float]:
        response = self._retry_embed(
            self.client.models.embed_content,
            model=self.model_name,
            contents=text,
        )
        return self._truncate(response.embeddings[0].values)

def get_embeddings():
    global GLOBAL_EMBEDDING
    if GLOBAL_EMBEDDING is None:
        logger.info("Initializing Cloud Embeddings (gemini-embedding-001, 0 MB local RAM)...")
        GLOBAL_EMBEDDING = CloudEmbeddings()
    return GLOBAL_EMBEDDING

async def ask_question_stream(query: str, history: list, username: str, filename: str, session_id: int, strict_mode: bool, image_data: str = None, supabase=None, embedder=None):
    if not supabase:
        from dependencies import get_supabase
        supabase = get_supabase()
    if not embedder:
        from dependencies import get_embedding_model
        embedder = get_embedding_model()
        
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
        # ---------------------------------------------------------
        # HYBRID RETRIEVER + RECIPROCAL RANK FUSION (RRF)
        # ---------------------------------------------------------
        try:
            query_embedding = embedder.embed_query(query)
            
            response = supabase.rpc("hybrid_search", {
                "query_text": query,               
                "query_embedding": query_embedding, 
                "match_count": k_val,
                "filter": filter_dict
            }).execute()
            
            # 1. Capture the chunks and scores for the frontend
            retrieved_sources = []
            context_entries = []
            for row in response.data:
                score = round(row.get("similarity", 0), 3)
                page = row.get("metadata", {}).get("page", "N/A")
                content = row.get("content", "")
                
                retrieved_sources.append({
                    "page": page,
                    "score": score,
                    "snippet": content[:200] + "..." # Send a small preview
                })
                context_entries.append(f"--- [Pg. {page}] ---\n{content}")
                
            context_text = "\n\n".join(context_entries)
            logger.info(f"Retrieved {len(retrieved_sources)} sources, context text length: {len(context_text)}")
            
            # 2. Send the sources as a special "metadata" chunk before the AI response
            import json
            yield f"METADATA_SOURCES:{json.dumps(retrieved_sources)}|||"
            
        except Exception as e:
            logger.error(f"Hybrid Retrieval Error: {str(e)}")
            context_text = "I could not retrieve the document data due to a database error."

    if not filename:
        sys_p = "Helpful AI. History: {history}"
    elif strict_mode:
        sys_p = (
            "You are a Strict QA Assistant. Your task is to answer the user's question relying strictly on the provided Context.\n\n"
            "Guidelines:\n"
            "- First, read the Context carefully to see if it contains information relevant to the question.\n"
            "- If the information is present, answer the question comprehensively with high detail based exclusively on the context.\n"
            "- You MUST cite the source page for your facts. In the context, pages are labeled like `--- [Pg. X] ---`. Use the page label from the header to cite your sources (e.g. '[Pg. X](#page=X&search=keyword)' where keyword is a unique 1-2 word search term from the cited sentence).\n"
            "- If the Context does not contain sufficient information to answer the question, you must respond with exactly: 'I cannot find any information about this in the uploaded document.'\n"
            "- WARNING: DO NOT use factual information from the 'History' to answer the question. The History is only for conversational flow. ALL facts and citations MUST come exclusively from the 'Context' provided.\n"
            "- End your response with [CONFIDENCE: HIGH/MED/LOW] indicating how certain you are of the answer based on the context.\n\n"
            "Context:\n{context}\n\n"
            "History:\n{history}"
        )
    else:
        sys_p = (
            "You are a Hybrid AI Assistant capable of general knowledge AND document Q&A.\n\n"
            "Guidelines:\n"
            "1. If the provided Context contains information relevant to the user's question, answer using the Context and cite the source pages using `[Pg. X](#page=X&search=keyword)`.\n"
            "2. If the Context is irrelevant, incomplete, or does not contain the answer, IGNORE the Context entirely and answer the question directly using your broad general knowledge.\n"
            "3. NEVER state 'The document does not contain...', 'I cannot find...', or apologize for missing information. ALWAYS provide a direct, complete, and helpful answer to the user's prompt no matter what topic they ask about.\n"
            "4. End your response with [CONFIDENCE: HIGH/MED/EXTERNAL].\n\n"
            "Context:\n{context}\n\n"
            "History:\n{history}"
        )

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
            if ("429" in str(e) or "503" in str(e)) and attempt < max_retries - 1:
                wait_time = (2 ** attempt) * 3  # 3, 6, 12, 24 seconds backoff
                logger.warning(f"Engine Rate Limited/Unavailable (429/503). Retrying in {wait_time}s...")
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
    from dependencies import get_supabase, get_embedding_model
    supabase = get_supabase()
    embedder = get_embedding_model()
    
    ext = os.path.splitext(filename)[1].lower()
    docs = []
    is_tabular = False
    
    if ext == ".pdf":
        loader = PyMuPDFLoader(file_path)
        docs = loader.load()
        # Enforce 1-indexed Physical Pages (PyMuPDF outputs 0-indexed by default)
        for doc in docs:
            if "page" in doc.metadata:
                doc.metadata["page"] += 1
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

    # BATCH INSERTION TO CLOUD DB
    # Batch size 20 + 12s sleep guarantees strictly staying under 100 RPM quota (20 items * 5 = 100 RPM)
    batch_size = 20

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
        if i + batch_size < len(chunks):
            time.sleep(12)