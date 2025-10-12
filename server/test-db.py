#!/usr/bin/env python3
"""
Quick database connection test script
"""
import os
import sys

# Load .env file
env_file = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value

# Get database credentials
db_url = os.getenv('DATABASE_URL', 'jdbc:postgresql://db.sjrfppeisxmglrozufoy.supabase.co:6543/postgres?sslmode=require')
db_user = os.getenv('DATABASE_USER', 'postgres')
db_password = os.getenv('DATABASE_PASSWORD', '')

# Parse JDBC URL to get connection parameters
# jdbc:postgresql://host:port/database?params
if db_url.startswith('jdbc:postgresql://'):
    db_url = db_url.replace('jdbc:postgresql://', 'postgresql://')
    db_url = db_url.replace('?sslmode=require', '')
    
# Extract host, port, database from URL
import re
match = re.match(r'postgresql://([^:]+):(\d+)/(.+?)(\?.*)?$', db_url)
if match:
    host, port, database = match.groups()[:3]
else:
    print("❌ ERROR: Could not parse DATABASE_URL")
    sys.exit(1)

if not db_password:
    print("❌ ERROR: DATABASE_PASSWORD is not set in .env file")
    sys.exit(1)

print("Testing database connection...")
print("=" * 60)
print(f"Host: {host}")
print(f"Port: {port}")
print(f"Database: {database}")
print(f"User: {db_user}")
print(f"SSL: required")
print("=" * 60)
print()

try:
    import psycopg2
    print("✅ psycopg2 module found")
except ImportError:
    print("⚠️  psycopg2 not installed, trying to install...")
    import subprocess
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "--quiet"])
        import psycopg2
        print("✅ psycopg2-binary installed successfully")
    except Exception as e:
        print(f"❌ ERROR: Could not install psycopg2: {e}")
        print()
        print("Alternative: Install PostgreSQL client and use psql:")
        print(f"  brew install postgresql@15")
        print(f"  psql 'host={host} port={port} dbname={database} user={db_user} sslmode=require'")
        sys.exit(1)

print()
print("Connecting to database...")

try:
    # Connect to database
    conn = psycopg2.connect(
        host=host,
        port=port,
        database=database,
        user=db_user,
        password=db_password,
        sslmode='require'
    )
    
    print("✅ SUCCESS: Connected to database!")
    print()
    
    # Test a simple query
    cursor = conn.cursor()
    cursor.execute("SELECT version(), current_database(), current_user")
    result = cursor.fetchone()
    
    print("Database Info:")
    print(f"  Version: {result[0][:80]}...")
    print(f"  Database: {result[1]}")
    print(f"  User: {result[2]}")
    print()
    
    # Check tables
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    tables = cursor.fetchall()
    
    if tables:
        print(f"Tables in database ({len(tables)}):")
        for table in tables:
            print(f"  - {table[0]}")
    else:
        print("No tables found in public schema")
    
    print()
    
    cursor.close()
    conn.close()
    
    print("=" * 60)
    print("✅ Database connection test PASSED!")
    print("=" * 60)
    
except psycopg2.Error as e:
    print(f"❌ ERROR: Failed to connect to database")
    print(f"Error code: {e.pgcode}")
    print(f"Error message: {e.pgerror}")
    print()
    print("Common issues:")
    print("  1. Check DATABASE_PASSWORD in .env file")
    print("  2. Check network connectivity")
    print("  3. Verify database is accessible from your IP")
    sys.exit(1)
except Exception as e:
    print(f"❌ ERROR: Unexpected error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)


