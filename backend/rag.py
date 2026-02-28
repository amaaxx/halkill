from dotenv import load_dotenv
import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings

from langchain_chroma import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

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
    loader = PyPDFLoader(PDF_PATH)
    docs = loader.load()

    logger.info("Splitting text...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
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

retriever = vector_store.as_retriever(search_kwargs={"k": 10})

# Prompt
system_prompt = (
    "You are an assistant answering questions using a document and your general knowledge.\n\n"
    "Instructions:\n"
    "- First, extract and present all relevant information found explicitly in the document context.\n"
    "- Present this under a section titled 'From the Document'.\n"
    "- If the document does not fully answer the question, then provide additional helpful explanation.\n"
    "- Present this under a section titled 'Additional Explanation (General Knowledge)'.\n"
    "- Do NOT mix document content and general knowledge.\n"
    "- Be clear and structured.\n\n"
    "{context}"
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
async def ask_question_stream(query: str):
    # 1. Fetch the relevant PDF chunks asynchronously first
    docs = await retriever.ainvoke(query)
    context_text = format_docs(docs)

    # 2. Format the exact text for the prompt
    messages = prompt.format_messages(context=context_text, input=query)

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
    loader = PyPDFLoader(file_path)
    docs = loader.load()

    # 2. Split it into chunks (the math we talked about for Day 5!)
    logger.info("Splitting text...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = text_splitter.split_documents(docs)

    # 3. Add to the existing database
    logger.info(f"Adding {len(chunks)} chunks to the Database...")
    vector_store.add_documents(chunks) 
    
    logger.info(f"Successfully ingested '{file_path}' into the AI's memory!")