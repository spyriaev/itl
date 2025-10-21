#!/usr/bin/env python3
"""
Simple test script to verify the FastAPI server setup
"""

import sys
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def test_imports():
    """Test if all required packages can be imported"""
    try:
        import fastapi
        import uvicorn
        import sqlalchemy
        import jose
        import psycopg2
        import pydantic
        print("✅ All required packages are available")
        return True
    except ImportError as e:
        print(f"❌ Missing package: {e}")
        print("Run: pip install -r requirements.txt")
        return False

def test_environment():
    """Test environment variables"""
    required_vars = ["DATABASE_URL"]
    missing = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing.append(var)
    
    # Check JWT secret (allow placeholder for development)
    jwt_secret = os.getenv("SUPABASE_JWT_SECRET")
    if not jwt_secret or jwt_secret == "your_jwt_secret_here":
        print("⚠️  SUPABASE_JWT_SECRET not set (using placeholder for development)")
    
    if missing:
        print(f"❌ Missing required environment variables: {', '.join(missing)}")
        print("Create a .env file with the required variables")
        return False
    else:
        print("✅ Environment variables are set")
        return True

def test_database_connection():
    """Test database connection"""
    try:
        from database import test_database_connection
        if test_database_connection():
            print("✅ Database connection successful")
            return True
        else:
            print("❌ Database connection failed")
            return False
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Testing FastAPI server setup...")
    print()
    
    tests = [
        ("Package imports", test_imports),
        ("Environment variables", test_environment),
        ("Database connection", test_database_connection),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"Testing {test_name}...")
        result = test_func()
        results.append(result)
        print()
    
    if all(results):
        print("🎉 All tests passed! Server is ready to run.")
        print("Run: ./run-dev.sh")
    else:
        print("❌ Some tests failed. Please fix the issues above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
