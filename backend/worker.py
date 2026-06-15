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
def process_and_cleanup_document_task(self, file_path: str, username: str, filename: str):
    """
    Celery task that executes the computationally heavy embedding extraction, 
    then automatically cleans up the local file.
    """
    from rag import add_document_to_vector_store
    from logger import get_logger
    import os
    
    logger = get_logger(__name__)
    
    try:
        logger.info(f"Starting Celery background processing for {filename}...")
        add_document_to_vector_store(file_path, username, filename)
        logger.info(f"Completed processing for {filename}.")
    except Exception as e:
        logger.error(f"Failed to process document in Celery: {str(e)}")
        # Retry exponentially if it's a transient failure like a network issue or rate limit
        raise self.retry(exc=e, countdown=2 ** self.request.retries)
    finally:
        # Clean up ephemeral disk space AFTER processing finishes or fails
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Cleaned up temporary file {file_path}")
