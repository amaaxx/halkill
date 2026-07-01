import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# Use Redis as the broker and backend for Celery
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "worker",
    broker=redis_url,
    backend=redis_url
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

@celery_app.task(bind=True, max_retries=3)
def process_and_cleanup_document_task(self, username: str, filename: str):
    """
    Celery task that downloads the document from Supabase Storage,
    executes the computationally heavy embedding extraction, 
    then cleans up the local temporary file on the worker.
    """
    from rag import add_document_to_vector_store
    from logger import get_logger
    from dependencies import get_supabase
    import os
    
    logger = get_logger(__name__)
    supabase = get_supabase()
    
    storage_path = f"{username}/{filename}"
    temp_dir = "/tmp/halkill_worker_data"
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = os.path.join(temp_dir, filename)
    
    try:
        logger.info(f"Downloading {filename} from Supabase Storage...")
        # Download the file content from Supabase
        file_data = supabase.storage.from_("halkill_documents").download(storage_path)
        with open(temp_file_path, "wb") as f:
            f.write(file_data)
            
        logger.info(f"Starting Celery background processing for {filename}...")
        add_document_to_vector_store(temp_file_path, username, filename)
        logger.info(f"Completed processing for {filename}.")
    except Exception as e:
        logger.error(f"Failed to process document in Celery: {str(e)}")
        # Retry exponentially if it's a transient failure like a network issue or rate limit
        raise self.retry(exc=e, countdown=2 ** self.request.retries)
    finally:
        # Clean up ephemeral disk space on the worker AFTER processing finishes or fails
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            logger.info(f"Cleaned up temporary worker file {temp_file_path}")
