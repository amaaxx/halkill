📚 Academic Engine
A Hallucination-Resistant RAG System Built From Scratch
Academic Engine is a full-stack Retrieval-Augmented Generation (RAG) system designed to reduce LLM hallucinations by grounding responses strictly in user-provided documents.
Instead of blindly trusting a language model, this system retrieves relevant context from a PDF using vector similarity search and only then generates answers based on that retrieved content.
This project demonstrates real AI system engineering using FastAPI, React, LangChain, and ChromaDB.

🚀 Why I Built This

Large language models (ChatGPT, Gemini, etc.) are powerful — but they hallucinate.
In academic and knowledge-heavy environments, hallucination destroys trust.

This project explores how to:
Ground responses in verified documents
Prevent unsupported claims
Build a full-stack AI system (not just a notebook demo)
Understand retrieval, embeddings, vector databases, and backend integration deeply

This is not just a chatbot.
It is an engineered RAG pipeline.

🏗 System Architecture

Frontend (React)
⬇
FastAPI Backend
⬇
LangChain RAG Pipeline
⬇
ChromaDB (Vector Database)
⬇
Gemini LLM

Flow:
User asks a question.
The system embeds the query.
It retrieves top-K relevant chunks from the PDF.
Only retrieved context is passed to the LLM.
The model answers strictly using that context.
If the answer is not found → it explicitly says so.

🧠 Core Features (Current Layer)

✅ PDF ingestion and chunking
✅ Vector embeddings (HuggingFace)
✅ ChromaDB persistent storage
✅ Strict context-grounded answering
✅ Clean React frontend
✅ Markdown rendering
✅ Environment variable configuration
✅ Loading state + error handling

⚙️ Tech Stack:
Backend:

FastAPI
LangChain
ChromaDB
HuggingFace Embeddings
Google Gemini API
Python

Frontend:

React
Fetch API
React Markdown
JavaScript

Project Structure:
backend/
  main.py              # FastAPI server and API routes
  rag.py               # RAG pipeline logic
  requirements.txt

frontend/
  src/
    components/
      ChatBox.js
    api.js
    App.js
  package.json

data/
  math.pdf             # Source document

chroma_db/             # Vector database (auto-generated)

🔐 Environment Setup

Create a .env file inside the backend folder:
GOOGLE_API_KEY=your_api_key_here
Do NOT hardcode API keys.

▶️ How To Run Locally
1️⃣ Start Backend
cd backend
venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn main:app --reload

Backend runs at:
http://127.0.0.1:8000

2️⃣ Start Frontend
cd frontend
npm install
npm start


Frontend runs at:
http://localhost:3000

🧪 What This Project Demonstrates:

How embeddings work
How vector similarity retrieval works
How to build a RAG pipeline
How to connect LLMs to real data
How to build a backend API for AI systems
How to build a frontend for AI applications
How to structure a full-stack AI system professionally

🔥 Planned Engineering Upgrades

This project will evolve into a production-grade RAG system with:

Hybrid Search (BM25 + Vector)
Re-ranking layer
Similarity confidence threshold
Source citations
Conversation memory
JWT Authentication
Automated backend testing
Evaluation pipeline
Dockerization
Cloud deployment
Managed vector database
CI/CD pipeline

The goal is to go beyond tutorials and build something industry-ready.

🎯 Long-Term Vision

To turn Academic Engine into a:
Trust-aware knowledge system
Multi-document AI assistant
Production-deployable RAG infrastructure
Portfolio-level AI engineering project

📌 Author

Built by Amaan Ansari
B.Tech | AI Engineering Focus
Learning AI systems by building them from scratch.

📜 License

MIT License


