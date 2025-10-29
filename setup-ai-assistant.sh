#!/bin/bash

# AI Reading Assistant Setup Script
echo "🤖 Setting up AI Reading Assistant..."

# Check if we're in the right directory
if [ ! -f "server/requirements.txt" ] || [ ! -f "web/package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Install Python dependencies
echo "📦 Installing Python dependencies..."
cd server
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt
echo "✅ Python dependencies installed"

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
cd ../web
npm install
echo "✅ Node.js dependencies installed"

# Go back to root
cd ..

# Check for required environment variables
echo "🔧 Checking environment configuration..."

if [ ! -f "server/.env" ]; then
    echo "⚠️  server/.env not found. Please create it from server/env.example"
fi

if [ ! -f "web/.env" ]; then
    echo "⚠️  web/.env not found. Please create it from web/.env.example"
fi

# Check for DeepSeek API key
if ! grep -q "DEEPSEEK_API_KEY=sk-" server/.env 2>/dev/null; then
    echo "⚠️  Please add your DeepSeek API key to server/.env:"
    echo "   DEEPSEEK_API_KEY=sk-your-key-here"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your DeepSeek API key to server/.env"
echo "2. Run the database migration: supabase db reset"
echo "3. Start the development servers:"
echo "   - Backend: cd server && source venv/bin/activate && python main.py"
echo "   - Frontend: cd web && npm run dev"
echo "   - Supabase: supabase start"
echo ""
echo "The AI Reading Assistant will be available in the PDF viewer! 🤖📚"
