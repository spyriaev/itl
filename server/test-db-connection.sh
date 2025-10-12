#!/bin/bash

# Test database connection using Kotlin/Gradle
# This script will compile and run a simple database connection test

cd "$(dirname "$0")"

echo "Testing database connection..."
echo "================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ ERROR: .env file not found!"
    echo "Please create .env file from env.example and add your credentials"
    echo ""
    echo "Run: cp env.example .env"
    echo "Then edit .env and add your DATABASE_PASSWORD"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Test with a simple Kotlin script using Gradle
cat > /tmp/TestConnection.kt << 'EOF'
import java.sql.DriverManager
import java.sql.Connection

fun main() {
    val url = System.getenv("DATABASE_URL") ?: "jdbc:postgresql://db.sjrfppeisxmglrozufoy.supabase.co:6543/postgres?sslmode=require"
    val user = System.getenv("DATABASE_USER") ?: "postgres"
    val password = System.getenv("DATABASE_PASSWORD")
    
    if (password.isNullOrEmpty()) {
        println("❌ ERROR: DATABASE_PASSWORD is not set in .env file")
        System.exit(1)
    }
    
    println("Attempting to connect to database...")
    println("URL: $url")
    println("User: $user")
    println("")
    
    try {
        Class.forName("org.postgresql.Driver")
        val connection: Connection = DriverManager.getConnection(url, user, password)
        
        println("✅ SUCCESS: Connected to database!")
        println("")
        
        // Test a simple query
        val statement = connection.createStatement()
        val resultSet = statement.executeQuery("SELECT version(), current_database(), current_user")
        
        if (resultSet.next()) {
            println("Database Info:")
            println("- Version: ${resultSet.getString(1).take(50)}...")
            println("- Database: ${resultSet.getString(2)}")
            println("- User: ${resultSet.getString(3)}")
        }
        
        resultSet.close()
        statement.close()
        connection.close()
        
        println("")
        println("✅ Database connection test passed!")
        
    } catch (e: Exception) {
        println("❌ ERROR: Failed to connect to database")
        println("Error: ${e.message}")
        e.printStackTrace()
        System.exit(1)
    }
}
EOF

echo "Running connection test..."
echo ""

./gradlew --quiet run --args="-test-connection" 2>/dev/null || {
    # If gradle run fails, try using kotlinc directly
    echo "Compiling and running test script..."
    
    # Check if kotlinc is available
    if command -v kotlinc &> /dev/null; then
        CLASSPATH="$(find ~/.gradle/caches -name 'postgresql-*.jar' 2>/dev/null | head -1)"
        if [ -z "$CLASSPATH" ]; then
            echo "Downloading PostgreSQL JDBC driver..."
            curl -L -o /tmp/postgresql.jar https://jdbc.postgresql.org/download/postgresql-42.6.0.jar
            CLASSPATH="/tmp/postgresql.jar"
        fi
        
        kotlinc /tmp/TestConnection.kt -include-runtime -d /tmp/test-connection.jar -classpath "$CLASSPATH"
        java -cp "/tmp/test-connection.jar:$CLASSPATH" TestConnectionKt
    else
        echo "❌ kotlinc not found. Cannot compile test script."
        echo ""
        echo "Alternative: Test connection manually with psql:"
        echo "psql \"$DATABASE_URL\" -U $DATABASE_USER"
        exit 1
    fi
}

echo ""
echo "================================"


