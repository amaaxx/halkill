from datetime import datetime, timedelta, timezone
import bcrypt
from jose import jwt
import os

# 1. Configuration (In production, these go in a .env file!)
SECRET_KEY = os.getenv("SECRET_KEY", "SUPER_SECRET_JAMIA_ENGINE_KEY_DO_NOT_SHARE")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# 2. Security Functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Checks if the typed password matches the scrambled one in Postgres."""
    # Bcrypt requires bytes, not strings!
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )

def get_password_hash(password: str) -> str:
    """Scrambles a plain text password into an unreadable hash."""
    # Generate a random salt and hash the password
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    
    # Decode back to a string so PostgreSQL can save it easily
    return hashed_password.decode('utf-8')

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """Creates the digital ID card (JWT) for the user to stay logged in."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
        
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt