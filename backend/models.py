from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
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