# AI Reading Assistant

The AI Reading Assistant is a powerful feature that helps users understand and interact with PDF documents using AI models. It supports multiple AI providers (DeepSeek and GigaChat) and provides contextual assistance based on the current page and surrounding content.

## Features

- **Contextual AI Chat**: Ask questions about the document content with AI responses based on current page context
- **Multiple Conversations**: Create and manage multiple chat threads per document
- **Streaming Responses**: Real-time AI responses with smooth streaming
- **Page Context**: AI understands which page you're viewing and includes surrounding pages for context
- **Persistent History**: All conversations are saved and can be resumed later
- **Mobile Responsive**: Works seamlessly on desktop and mobile devices
- **Markdown Support**: AI responses support rich formatting including code blocks, lists, and more

## Architecture

### Backend (Python/FastAPI)
- **AI Service** (`ai_service.py`): Handles AI provider integration (DeepSeek/GigaChat) and PDF text extraction
- **Chat Models** (`models.py`): Database models for threads and messages
- **API Endpoints** (`main.py`): RESTful API with Server-Sent Events for streaming
- **Repository Layer** (`repository.py`): Database operations for chat functionality

### Frontend (React/TypeScript)
- **Chat Context** (`ChatContext.tsx`): State management for chat functionality
- **Chat Panel** (`ChatPanel.tsx`): Main chat interface with thread management
- **Chat Message** (`ChatMessage.tsx`): Individual message display with markdown rendering
- **Thread Selector** (`ThreadSelector.tsx`): Conversation management dropdown
- **Chat Service** (`chatService.ts`): API client with SSE handling

### Database Schema
- `chat_threads`: Stores conversation threads linked to documents
- `chat_messages`: Stores individual messages with page context

## Setup

1. **Install Dependencies**:
   \`\`\`bash
   ./setup-ai-assistant.sh
   \`\`\`

2. **Configure Environment**:
   - Add your DeepSeek API key to `server/.env`:
     \`\`\`
     DEEPSEEK_API_KEY=sk-your-key-here
     DEEPSEEK_API_BASE=https://api.deepseek.com
     CHAT_CONTEXT_PAGES=2
     \`\`\`

3. **Run Database Migration**:
   \`\`\`bash
   supabase db reset
   \`\`\`

4. **Start Services**:
   \`\`\`bash
   # Backend
   cd server && source venv/bin/activate && python main.py
   
   # Frontend  
   cd web && npm run dev
   
   # Supabase
   supabase start
   \`\`\`

## Usage

1. **Open a PDF**: Upload and open any PDF document
2. **Enable AI Assistant**: Click the "🤖 Show AI" button in the PDF viewer
3. **Start Chatting**: Type questions about the document content
4. **Manage Conversations**: Use the thread selector to create new conversations or switch between existing ones
5. **Context Awareness**: The AI automatically includes content from the current page and surrounding pages

## API Endpoints

- `POST /api/documents/{doc_id}/chat/threads` - Create new chat thread
- `GET /api/documents/{doc_id}/chat/threads` - List threads for document
- `GET /api/chat/threads/{thread_id}/messages` - Get thread with messages
- `POST /api/chat/threads/{thread_id}/messages` - Send message (streaming)

## Configuration

### Environment Variables

**Server (.env)**:
- `AI_PROVIDER`: Choose AI provider - "deepseek" or "gigachat" (default: deepseek)
- `DEEPSEEK_API_KEY`: Your DeepSeek API key
- `DEEPSEEK_API_BASE`: DeepSeek API base URL (default: https://api.deepseek.com)
- `GIGACHAT_AUTH_KEY`: Your GigaChat authorization key
- `GIGACHAT_API_BASE`: GigaChat API base URL (default: https://gigachat.devices.sberbank.ru/api/v1)
- `CHAT_CONTEXT_PAGES`: Number of pages before/after current page to include (default: 2)

**Frontend (.env)**:
- `VITE_API_URL`: Backend API URL (default: http://localhost:8080)

### Context Strategy

The AI assistant uses a smart context strategy:
- **Current Page**: Always includes the page you're currently viewing
- **Surrounding Pages**: Includes N pages before and after (configurable via `CHAT_CONTEXT_PAGES`)
- **Text Extraction**: Uses PyMuPDF for fast, accurate text extraction
- **Context Limits**: Automatically handles large documents by focusing on relevant pages

## Troubleshooting

### Common Issues

### Common Issues

1. **AI Not Responding**:
   - Check AI provider API key is valid
   - Verify API quota and rate limits
   - Check server logs for errors
   - For GigaChat: ensure authorization key is correct

2. **Text Extraction Issues**:
   - Ensure PDF is not password-protected
   - Check if PDF contains text (not just images)
   - Verify PyMuPDF installation

3. **Streaming Not Working**:
   - Check browser EventSource support
   - Verify CORS configuration
   - Check network connectivity

### Debug Mode

Enable debug logging by setting:
\`\`\`bash
export LOG_LEVEL=DEBUG
\`\`\`

## Security

- **Authentication**: All endpoints require valid Supabase JWT tokens
- **Authorization**: Users can only access their own documents and threads
- **Data Privacy**: Chat messages are stored securely in PostgreSQL
- **API Keys**: DeepSeek API key is server-side only, never exposed to clients

## Performance

- **Streaming**: Real-time responses without blocking the UI
- **Caching**: PDF text extraction is optimized for repeated access
- **Pagination**: Thread and message loading supports pagination
- **Mobile**: Responsive design with touch-friendly interface

## Getting API Keys

### DeepSeek
1. Visit [DeepSeek Platform](https://platform.deepseek.com)
2. Create an account or sign in
3. Go to API Keys section
4. Create a new API key
5. Add credits to your account

### GigaChat
1. Visit [GigaChat Developers](https://developers.sber.ru)
2. Register for GigaChat API access
3. Get your **Client ID** and **Client Secret** from the dashboard
4. Generate authorization key using the provided script:
   \`\`\`bash
   cd server && python generate_gigachat_key.py your_client_id your_client_secret
   \`\`\`
5. Use the generated base64 string as `GIGACHAT_AUTH_KEY`

## Switching AI Providers

To switch between AI providers, simply change the `AI_PROVIDER` environment variable:

\`\`\`bash
# For DeepSeek
AI_PROVIDER=deepseek

# For GigaChat  
AI_PROVIDER=gigachat
\`\`\`

Then restart the server. The system will automatically use the appropriate provider and configuration.
