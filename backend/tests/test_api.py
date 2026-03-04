import sys
import os

# Force Python to look in the parent directory (backend) for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi.testclient import TestClient
from main import app  # Imports your actual FastAPI app

# Create a simulated client to send requests to your app without actually running the server
client = TestClient(app)

def test_ask_endpoint_missing_data():
    """Test what happens if the frontend sends an empty request."""
    response = client.post("/ask", json={})
    
    # We expect a 422 error because 'question' and 'history' are required by your Pydantic model
    assert response.status_code == 422

def test_ask_endpoint_missing_question():
    """Test what happens if history is provided, but no question."""
    payload = {
        "history": []
    }
    response = client.post("/ask", json=payload)
    
    # We expect a 422 error because the 'question' field is missing
    assert response.status_code == 422
    
    # Verify the error message points out the missing 'question' field
    error_detail = response.json()["detail"][0]
    assert error_detail["loc"] == ["body", "query"]
    assert error_detail["type"] == "missing"

def test_strict_mode_refusal():
    """
    Test that the RAG engine strictly follows the prompt and 
    refuses to answer questions outside the uploaded documents.
    """
    payload = {
        "query": "What is the recipe for a chocolate cake?",
        "history": []
    }
    
    # Send the trick question to your active API
    response = client.post("/ask", json=payload)
    
    # 1. The server should successfully process the request (200 OK)
    assert response.status_code == 200
    
    # 2. Capture the AI's streaming response text
    answer = response.text.lower()
    
    # 3. Prove it didn't hallucinate! 
    # If it gives a recipe, it fails. We assert that "flour", "sugar", or "bake" are NOT in the answer.
    assert "flour" not in answer
    assert "sugar" not in answer
    assert "bake" not in answer
    
    # Optional: You can also print the AI's refusal to the terminal to see it in action
    print(f"\nAI's Refusal Response: {response.text}")

def test_valid_document_retrieval():
    """
    Test that the engine successfully retrieves actual document chunks
    and provides a real answer instead of a refusal.
    """
    payload = {
        # Asking a broad question that should trigger a hit on your uploaded CVs or Lab Reports
        "query": "Summarize the skills, education, or test results mentioned in the documents.", 
        "history": []
    }
    
    response = client.post("/ask", json=payload)
    
    # 1. The server should process it successfully
    assert response.status_code == 200
    
    # 2. Capture the answer
    answer = response.text
    
    # 3. Prove it actually found information!
    # If it found documents, it should NOT output your strict refusal message.
    assert "The document does not contain" not in answer
    
    print(f"\nAI's Successful Response: {answer[:150]}...") # Print the first 150 characters to verify