from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models, security

def reset_password(username, new_password):
    db = SessionLocal()
    user = db.query(models.User).filter(models.User.username == username).first()
    
    if user:
        user.hashed_password = security.get_password_hash(new_password)
        db.commit()
        print(f"✅ Password for {username} updated successfully!")
    else:
        print("❌ User not found.")
    db.close()

if __name__ == "__main__":
    reset_password("Amaan", "1301")