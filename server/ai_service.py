import os
import logging
from typing import List, AsyncGenerator, Optional
import fitz  # PyMuPDF
from openai import AsyncOpenAI
import asyncio
from io import BytesIO
import requests
import uuid
import urllib3
import base64
import time
from dataclasses import dataclass
import httpx

# Disable SSL warnings for GigaChat API
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

@dataclass
class TokenInfo:
    """Information about GigaChat access token"""
    access_token: str
    expires_at: int
    created_at: int
    
    def is_expired(self) -> bool:
        """Check if token is expired (with 5 minute buffer)"""
        current_time = int(time.time())
        return current_time >= (self.expires_at - 300)  # 5 minute buffer

class AIService:
    def __init__(self):
        self.provider = os.getenv("AI_PROVIDER", "deepseek").lower()
        self.context_pages = int(os.getenv("CHAT_CONTEXT_PAGES", "2"))
        
        # Token caching for GigaChat
        self._cached_token: Optional[TokenInfo] = None
        
        if self.provider == "gigachat":
            self._init_gigachat()
        else:
            self._init_deepseek()
    
    def _init_deepseek(self):
        """Initialize DeepSeek client"""
        api_key = os.getenv("DEEPSEEK_API_KEY")
        if not api_key:
            logger.warning("DEEPSEEK_API_KEY not found, DeepSeek client not initialized")
            self.client = None
            return
            
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com")
        )
        self.model_name = "deepseek-chat"
    
    def _init_gigachat(self):
        """Initialize GigaChat client"""
        # Don't initialize client here, we'll get token dynamically
        self.client = None
        self.model_name = "GigaChat"
    
    async def get_gigachat_token(self) -> str:
        """Get GigaChat access token using authorization key with caching"""
        # Check if we have a valid cached token
        if self._cached_token and not self._cached_token.is_expired():
            logger.debug("Using cached GigaChat token")
            return self._cached_token.access_token
        
        # Get new token
        logger.info("Requesting new GigaChat access token")
        auth_key = os.getenv("GIGACHAT_AUTH_KEY")
        if not auth_key:
            raise ValueError("GIGACHAT_AUTH_KEY not found in environment variables")
        
        url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
        payload = "scope=GIGACHAT_API_PERS"
        # According to GigaChat API docs, auth key should be base64 encoded Client ID:Client Secret
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "RqUID": str(uuid.uuid4()),
            "Authorization": f"Basic {auth_key}"
        }
        
        try:
            response = requests.post(url, data=payload, headers=headers, verify=False)
            
            if not response.ok:
                logger.error(f"GigaChat token request failed: {response.status_code} - {response.text}")
                raise Exception(f"GigaChat API returned {response.status_code}: {response.text}")
            
            response.raise_for_status()
            
            token_data = response.json()
            access_token = token_data["access_token"]
            expires_at = token_data.get("expires_at", int(time.time()) + 1800)  # Default 30 min
            
            # Cache the token
            self._cached_token = TokenInfo(
                access_token=access_token,
                expires_at=expires_at,
                created_at=int(time.time())
            )
            
            logger.info(f"GigaChat token obtained successfully, expires at {expires_at}")
            return access_token
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get GigaChat token: {e}")
            raise Exception(f"Failed to get GigaChat access token: {e}")
    
    def clear_token_cache(self):
        """Clear cached token (useful for testing or forced refresh)"""
        self._cached_token = None
        logger.info("GigaChat token cache cleared")
    
    def get_token_info(self) -> Optional[TokenInfo]:
        """Get information about cached token"""
        return self._cached_token
    
    async def extract_text_from_pdf(self, pdf_url: str, page_numbers: List[int]) -> str:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(pdf_url)
                response.raise_for_status()
                pdf_data = BytesIO(response.content)
            
            doc = fitz.open(stream=pdf_data, filetype="pdf")
            text_parts = []
            
            for page_num in page_numbers:
                if 1 <= page_num <= doc.page_count:
                    page = doc[page_num - 1]  # PyMuPDF uses 0-based indexing
                    text = page.get_text()
                    if text.strip():
                        text_parts.append(f"--- Page {page_num} ---\n{text.strip()}")
            
            doc.close()
            return "\n\n".join(text_parts)
            
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            return f"Error extracting text from pages {page_numbers}: {str(e)}"
    
    def build_context_pages(self, current_page: int, total_pages: int) -> List[int]:
        """Build list of page numbers for context (current + surrounding pages)"""
        pages = set()
        
        # Add current page
        pages.add(current_page)
        
        # Add surrounding pages
        for i in range(1, self.context_pages + 1):
            if current_page - i >= 1:
                pages.add(current_page - i)
            if current_page + i <= total_pages:
                pages.add(current_page + i)
        
        return sorted(list(pages))
    
    async def generate_response_stream(
        self, 
        messages: List[dict], 
        pdf_url: str, 
        current_page: int, 
        total_pages: int
    ) -> AsyncGenerator[str, None]:
        """Generate streaming response from AI API with PDF context"""
        try:
            # Extract text from relevant pages
            context_pages = self.build_context_pages(current_page, total_pages)
            pdf_text = await self.extract_text_from_pdf(pdf_url, context_pages)
            
            # Build system message with PDF context
            system_message = {
                "role": "system",
                "content": f"""You are an AI reading assistant helping users understand PDF documents. 
                
Current context: You are viewing page {current_page} of {total_pages} pages.

Document content from pages {', '.join(map(str, context_pages))}:
{pdf_text}

Instructions:
- Answer questions about the document content
- Provide explanations and insights
- Help users understand complex topics
- Reference specific pages when relevant
- Be concise but thorough
- If asked about content not in the current context, mention that you can only see pages {', '.join(map(str, context_pages))}"""
            }
            
            # Prepare messages for API
            api_messages = [system_message] + messages
            
            # Initialize client for GigaChat if needed
            if self.provider == "gigachat":
                try:
                    access_token = await self.get_gigachat_token()
                    # Use the correct GigaChat API endpoint
                    api_base = os.getenv("GIGACHAT_API_BASE", "https://gigachat.devices.sberbank.ru/api/v1")
                    
                    self.client = AsyncOpenAI(
                        api_key=access_token,
                        base_url=api_base,
                        http_client=httpx.AsyncClient(
                            verify=False,  # Disable SSL verification for GigaChat
                            timeout=httpx.Timeout(30.0)  # 30 second timeout
                        )
                    )
                    
                    logger.info("GigaChat client initialized successfully")
                except Exception as token_error:
                    logger.error(f"Failed to get GigaChat token: {token_error}")
                    yield f"❌ **GigaChat Error**: Failed to get access token. Please check your GIGACHAT_AUTH_KEY."
                    return
            
            # Stream response from AI provider
            stream = await self.client.chat.completions.create(
                model=self.model_name,
                messages=api_messages,
                stream=True,
                temperature=0.7,
                max_tokens=2000
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            logger.error(f"Error generating AI response: {e}")
            
            # Handle specific API errors
            if "Insufficient Balance" in str(e) or "402" in str(e):
                if self.provider == "deepseek":
                    yield "❌ **API Error**: Insufficient balance on your DeepSeek account. Please:\n\n1. Check your DeepSeek account balance at https://platform.deepseek.com\n2. Add credits to your account\n3. Verify your API key is correct\n\nIf you need a new API key, get one from https://platform.deepseek.com/api_keys"
                else:
                    yield "❌ **API Error**: Insufficient balance on your GigaChat account. Please:\n\n1. Check your GigaChat account balance at https://developers.sber.ru\n2. Add credits to your account\n3. Verify your API key is correct"
            elif "401" in str(e) or "Unauthorized" in str(e):
                if self.provider == "deepseek":
                    yield "❌ **API Error**: Invalid DeepSeek API key. Please check your `DEEPSEEK_API_KEY` in the server configuration."
                else:
                    yield "❌ **API Error**: Invalid GigaChat authorization key. Please check your `GIGACHAT_AUTH_KEY` in the server configuration."
            elif "429" in str(e) or "rate limit" in str(e).lower():
                yield "❌ **API Error**: Rate limit exceeded. Please wait a moment and try again."
            elif "Connection error" in str(e) or "connection" in str(e).lower():
                if self.provider == "gigachat":
                    yield "❌ **Connection Error**: Unable to connect to GigaChat API. This might be due to:\n\n1. Network connectivity issues\n2. GigaChat API server maintenance\n3. Firewall or proxy restrictions\n\nPlease try again in a few moments."
                else:
                    yield f"❌ **Connection Error**: {str(e)}"
            else:
                yield f"❌ **Error**: {str(e)}"

# Global instance
ai_service = AIService()
