import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Fetch the Postgres URL from your .env file
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# Connect to PostgreSQL
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Create a session factory for our routes to use
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for our database models (Users, etc.)
Base = declarative_base()

# Dependency to get the database session in our FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()