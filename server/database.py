from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
from typing import Generator
from supabase import create_client, Client
import traceback
# Database configuration
username = os.getenv("DATABASE_USERNAME", "postgres")
password = os.getenv("DATABASE_PASSWORD", "postgres")
dbname = os.getenv("DATABASE_NAME", "postgres")
port = os.getenv("DATABASE_PORT", "54322")
host = os.getenv("DATABASE_HOST", "127.0.0.1")
DATABASE_URL = (f"postgresql+psycopg2://{username}:{password}@{host}:{port}/{dbname}?sslmode=require")

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Create Supabase client
supabase: Client = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception as e:
        print(f"Warning: Failed to create Supabase client: {e}")
        supabase = None

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
    except Exception as e:
        print(f"Error testing database connection: {e}")
        traceback.print_exc()
        return False
