from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True

class ChatCreate(BaseModel):
    filename: Optional[str] = None

class Question(BaseModel):
    query: str
    history: List[Dict[str, str]] = []
    filename: Optional[str] = None 
    session_id: Optional[int] = None 
    strict_mode: bool = True

class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class ChatSessionResponse(BaseModel):
    id: int
    title: str
    document_filename: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True