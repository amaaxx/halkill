import os
from dotenv import load_dotenv
from supabase.client import create_client, Client
from rag import get_embeddings, CloudEmbeddings

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

_supabase_client = None

def get_supabase() -> Client:
    global _supabase_client
    if not _supabase_client:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError("Missing Supabase credentials")
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_client

def get_embedding_model() -> CloudEmbeddings:
    return get_embeddings()
