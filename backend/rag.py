import os
import time
import pandas as pd
from dotenv import load_dotenv
from langchain_community.document_loaders import PyMuPDFLoader, TextLoader, CSVLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from supabase.client import create_client
from langchain_community.vectorstores import SupabaseVectorStore

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

embedding_function = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

# CLOUD VECTOR STORE
vector_store = SupabaseVectorStore(
    client=supabase,
    embedding=embedding_function,
    table_name="langchain_vecs", # <-- CHANGED THIS
    query_name="match_vecs",     # <-- CHANGED THIS
)

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
            query_embedding = embedding_function.embed_query(query)
            
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
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async for chunk in llm.astream(messages):
                if chunk.content:
                    full_ai_response += chunk.content
                    yield chunk.content
            break
        except Exception as e:
            if "429" in str(e) and attempt < max_retries - 1:
                wait_time = (2 ** attempt) + 1
                logger.warning(f"Rate limited. Retrying in {wait_time}s...")
                time.sleep(wait_time)
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
        chunks = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=400).split_documents(docs)
    else:
        chunks = docs 

    for chunk in chunks:
        chunk.metadata["username"] = username
        chunk.metadata["source"] = filename

    # BATCH INSERTION TO CLOUD DB
    batch_size = 100 
    for i in range(0, len(chunks), batch_size):
        vector_store.add_documents(chunks[i:i+batch_size])
        time.sleep(0.2)