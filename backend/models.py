from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    # Primary Key
    id = Column(Integer, primary_key=True, index=True)
    
    # User Info
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    
    # Security (Never store the real password!)
    hashed_password = Column(String, nullable=False)
    
    # Permissions (From your Layer 4 checklist: admin vs user)
    role = Column(String, default="user")
    is_active = Column(Boolean, default=True)

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    
    # This links the document to the specific user who uploaded it
    owner_id = Column(Integer, ForeignKey("users.id"))

# 1. The "Folder" for a specific conversation
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, default="New Chat")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Links the chat to the specific user
    owner_id = Column(Integer, ForeignKey("users.id"))
    # Links the chat to a specific PDF (so the AI knows what to read!)
    document_filename = Column(String, nullable=True)

# 2. The individual back-and-forth messages inside that folder
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"))
    role = Column(String) # "user" or "ai"
    content = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())