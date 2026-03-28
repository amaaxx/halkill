from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime

# 1. The data React sends us when a user signs up
class UserCreate(BaseModel):
    username: str
    email: str
    password: str  # Raw password from the user

# 2. The data FastAPI sends back (Notice: NO password field here!)
class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool

    class Config:
        # This tells Pydantic to cleanly read the SQLAlchemy User model
        from_attributes = True

class Question(BaseModel):
    query: str
    history: List[Dict[str, str]] = []
    filename: str # <-- NEW: React will send the name of the active document
    session_id: Optional[int] = None # <-- NEW: Tells the backend which chat to save to

# Schema for an individual message
class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

# Schema for a chat session (including its history)
class ChatSessionResponse(BaseModel):
    id: int
    title: str
    document_filename: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True