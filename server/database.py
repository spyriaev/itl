from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
from typing import Generator

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL") or "postgresql://postgres:foxtot-gUmmaw-zujqu2@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

# Create engine with connection pooling
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    echo=False
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator:
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_database_connection() -> bool:
    """Test database connectivity"""
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return True
    except Exception:
        return False
