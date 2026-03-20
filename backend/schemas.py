from pydantic import BaseModel
from typing import List, Dict

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