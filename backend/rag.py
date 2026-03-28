import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from logger import get_logger

# Import Database dependencies for auto-saving memory
from database import SessionLocal
import models

logger = get_logger(__name__)

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY is not set properly.")

# --- CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "chroma_db")

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

# =================================================================
# 1. GLOBAL INITIALIZATION
# =================================================================
logger.info("Initializing Models and Brain... Please wait.")

llm = ChatGoogleGenerativeAI(
    model="models/gemini-2.5-flash-lite",
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

system_prompt = (
    "You are an elite Academic Professor and Research Assistant.\n\n"
    "RULE 1 (STRICT RETRIEVAL): When asked to extract or list information, use ONLY the provided Document Context. "
    "You must perform an exhaustive scan of the context. Do not skip any sections, items, or details. "
    "Your goal is to provide a complete and comprehensive map of what is in the document without summarization.\n\n"
    "RULE 2 (TUTOR MODE): When asked to explain, teach, or summarize, use the Document Context as your primary source "
    "to define the scope, then use your internal expertise to provide a deep, high-level educational experience. "
    "Use bolding, bullet points, and clear structural hierarchies to make the information easy to digest.\n\n"
    "Chat History:\n{history}\n\n"
    "Document Context:\n{context}"
)

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system_prompt),
        ("human", "{input}"),
    ]
)

logger.info("Engine is fully loaded and ready!")

# =================================================================
# 2. THE QUERY FUNCTION (With Database Auto-Save)
# =================================================================
async def ask_question_stream(query: str, history: list, username: str, filename: str, session_id: int):

    # 1. Save the User's question to the database immediately
    db = SessionLocal()
    try:
        user_msg = models.ChatMessage(session_id=session_id, role="user", content=query)
        db.add(user_msg)
        db.commit()
    finally:
        db.close()

    # 2. Format the React history into a readable script for Gemini
    formatted_history = ""
    for msg in history[-6:]: 
        speaker = "Human" if msg["role"] == "user" else "AI"
        formatted_history += f"{speaker}: {msg['content']}\n"

    # 3. Retrieve context
    dynamic_retriever = vector_store.as_retriever(
        search_type="mmr", 
        search_kwargs={
            "k": 40,          
            "fetch_k": 150,   
            "lambda_mult": 0.2,
            "filter": {
                "$and": [
                    {"username": username},
                    {"source": filename}
                ]
            }
        }
    )
        
    docs = await dynamic_retriever.ainvoke(query)
    context_text = format_docs(docs)

    messages = prompt.format_messages(context=context_text, history=formatted_history, input=query)

    # 4. Stream the response AND keep a copy of the full text
    full_ai_response = ""
    async for chunk in llm.astream(messages):
        if chunk.content:
            full_ai_response += chunk.content
            yield chunk.content

    # 5. Save the AI's complete answer to the database
    db = SessionLocal()
    try:
        ai_msg = models.ChatMessage(session_id=session_id, role="ai", content=full_ai_response)
        db.add(ai_msg)
        db.commit()
    finally:
        db.close()


# =================================================================
# 3. DYNAMIC INGESTION 
# =================================================================
def add_pdf_to_vector_store(file_path: str, username: str, filename: str):
    logger.info(f"Processing new PDF: {file_path}")
    
    if not os.path.exists(file_path):
        logger.error(f"File not found at {file_path}")
        raise FileNotFoundError(f"File not found at {file_path}")

    logger.info("Loading PDF...")
    loader = PyMuPDFLoader(file_path)
    docs = loader.load()

    logger.info("Splitting text...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=400)
    chunks = text_splitter.split_documents(docs)

    for chunk in chunks:
        chunk.metadata["username"] = username
        chunk.metadata["source"] = filename

    logger.info(f"Adding {len(chunks)} chunks to the Database...")
    vector_store.add_documents(chunks) 
    
    logger.info(f"Successfully ingested '{file_path}' into the AI's memory!")