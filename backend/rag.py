from dotenv import load_dotenv
import os
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings

from langchain_chroma import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_classic.retrievers.multi_query import MultiQueryRetriever
from logger import get_logger
logger = get_logger(__name__)

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY is not set properly.")

# --- CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PDF_PATH = os.path.join(BASE_DIR, "data", "math.pdf")
DB_PATH = os.path.join(BASE_DIR, "chroma_db")

def create_vector_db():
    if os.path.exists(DB_PATH):
        logger.warning(f"Database already exists at {DB_PATH}.")
        return

    if not os.path.exists(PDF_PATH):
        logger.error(f"File not found at {PDF_PATH}")
        return

    logger.info("Loading PDF...")
    loader = PyMuPDFLoader(PDF_PATH)
    docs = loader.load()

    logger.info("Splitting text...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=400)
    chunks = text_splitter.split_documents(docs)

    logger.info("Creating Database...")
    embedding_function = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vector_store = Chroma.from_documents(chunks, embedding_function, persist_directory=DB_PATH)
    logger.info(f"Database saved to '{DB_PATH}'.")

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)


# =================================================================
# 1. GLOBAL INITIALIZATION (This runs ONLY ONCE when server starts)
# =================================================================
logger.info("Initializing Models and Brain... Please wait.")

# Setup the Brain (Gemini)
llm = ChatGoogleGenerativeAI(
    model="models/gemini-2.5-flash",
    google_api_key=GOOGLE_API_KEY,
    temperature=0.3
)

# Setup the Memory (ChromaDB)
embedding_function = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

vector_store = Chroma(
    persist_directory=DB_PATH,
    embedding_function=embedding_function
)

base_retriever = vector_store.as_retriever(search_kwargs={"k": 15})

# FIX APPLIED HERE: Pass the actual 'llm' variable
retriever = MultiQueryRetriever.from_llm(
    retriever=base_retriever, 
    llm=llm 
)

# Prompt
system_prompt = (
    "You are a precise Academic and Research Assistant. Answer the user's question based on the provided context.\n\n"
    "CRITICAL RULE: If the user asks for a list (like 'Units' or 'Topics'), you must scan the entire context and list EVERY instance found. Do not summarize. Do not skip items. Identify topics by their subject matter even if labels are missing.\n\n"
    "STRUCTURE:\n"
    "1. Start with '### From the Document:' followed by a concise answer using ONLY provided text.\n"
    "2. If applicable, follow with '### General Knowledge:' to provide expert context or explain medical/technical terms.\n\n"
    "RULES:\n"
    "- If the document is missing information, explicitly say: 'The document does not contain this specific detail.'\n"
    "- Use bullet points for lists.\n"
    "- Keep the tone professional.\n\n"
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
# 2. THE QUERY FUNCTION (Optimized for ultra-low latency)
# =================================================================
async def ask_question_stream(query: str,history: list):

    # 0 Format the React history into a readable script for Gemini
    formatted_history = ""
    for msg in history[-6:]: # Only keep the last 6 messages so we don't blow up our token limit!
        speaker = "Human" if msg["role"] == "user" else "AI"
        formatted_history += f"{speaker}: {msg['content']}\n"
        
    # 1. Fetch the relevant PDF chunks asynchronously first
    docs = await retriever.ainvoke(query)
    context_text = format_docs(docs)

    # 2. Format the exact text for the prompt
    messages = prompt.format_messages(context=context_text, history=formatted_history, input=query)

    # 3. Open a direct, unblocked stream to Gemini
    async for chunk in llm.astream(messages):
        if chunk.content:  # Safely yield only the text
            yield chunk.content

# =================================================================
# 3. DYNAMIC INGESTION (Adding new files on the fly)
# =================================================================
def add_pdf_to_vector_store(file_path: str):
    logger.info(f"Processing new PDF: {file_path}")
    
    if not os.path.exists(file_path):
        logger.error(f"File not found at {file_path}")
        raise FileNotFoundError(f"File not found at {file_path}")

    # 1. Load the new PDF
    logger.info("Loading PDF...")
    loader = PyMuPDFLoader(file_path)
    docs = loader.load()

    # 2. Split it into chunks (Synced with the massive chunks from the DB creator)
    logger.info("Splitting text...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=400)
    chunks = text_splitter.split_documents(docs)

    # 3. Add to the existing database
    logger.info(f"Adding {len(chunks)} chunks to the Database...")
    vector_store.add_documents(chunks) 
    
    logger.info(f"Successfully ingested '{file_path}' into the AI's memory!")