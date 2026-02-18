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
        print(f"⚠️  Database already exists at {DB_PATH}.")
        return
    
    if not os.path.exists(PDF_PATH):
        print(f"❌ Error: File not found at {PDF_PATH}")
        return

    print("📚 Loading PDF...")
    loader = PyPDFLoader(PDF_PATH)
    docs = loader.load()
    
    print("✂️  Splitting text...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = text_splitter.split_documents(docs)

    print("mb  Creating Database...")
    embedding_function = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vector_store = Chroma.from_documents(chunks, embedding_function, persist_directory=DB_PATH)
    print(f"✅ Database saved to '{DB_PATH}'.")

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

def ask_question(query: str) -> str:
    # 1. Setup the Brain (Gemini)
    llm = ChatGoogleGenerativeAI(
        model="models/gemini-2.5-flash",
        google_api_key=GOOGLE_API_KEY,
        temperature=0.3
    )

    # 2. Setup the Memory (ChromaDB)
    embedding_function = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )
    vector_store = Chroma(
        persist_directory=DB_PATH,
        embedding_function=embedding_function
    )
    retriever = vector_store.as_retriever(search_kwargs={"k": 3})

    # 3. Prompt
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

    # 4. RAG chain
    rag_chain = (
        {
            "context": retriever | format_docs,
            "input": RunnablePassthrough(),
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    return rag_chain.invoke(query)

