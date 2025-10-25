#!/usr/bin/env python3
"""
AI Provider Test Script
This script helps you test and configure your AI provider (DeepSeek or GigaChat).
"""

import os
import asyncio
from openai import AsyncOpenAI
from dotenv import load_dotenv
import requests
import uuid

async def test_deepseek_api():
    """Test the DeepSeek API configuration"""
    
    # Load environment variables
    load_dotenv()
    
    api_key = os.getenv("DEEPSEEK_API_KEY")
    api_base = os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com")
    
    print("🔍 Testing DeepSeek API Configuration...")
    print(f"API Base URL: {api_base}")
    print(f"API Key: {'*' * (len(api_key) - 8) + api_key[-8:] if api_key else 'NOT SET'}")
    print()
    
    if not api_key:
        print("❌ Error: DEEPSEEK_API_KEY not found in environment variables")
        print("Please add your API key to server/.env:")
        print("DEEPSEEK_API_KEY=sk-your-key-here")
        return False
    
    if not api_key.startswith("sk-"):
        print("❌ Error: API key should start with 'sk-'")
        print("Please check your API key format")
        return False
    
    try:
        # Initialize client
        client = AsyncOpenAI(
            api_key=api_key,
            base_url=api_base
        )
        
        print("🔄 Testing API connection...")
        
        # Test with a simple request
        response = await client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "user", "content": "Hello! Please respond with 'API test successful' if you can read this."}
            ],
            max_tokens=50
        )
        
        if response.choices[0].message.content:
            print("✅ DeepSeek API test successful!")
            print(f"Response: {response.choices[0].message.content}")
            return True
        else:
            print("❌ No response received from DeepSeek API")
            return False
            
    except Exception as e:
        error_str = str(e)
        print(f"❌ DeepSeek API Error: {error_str}")
        
        if "Insufficient Balance" in error_str or "402" in error_str:
            print("\n💡 Solution:")
            print("1. Visit https://platform.deepseek.com")
            print("2. Check your account balance")
            print("3. Add credits to your account")
            print("4. Verify your API key is correct")
        elif "401" in error_str or "Unauthorized" in error_str:
            print("\n💡 Solution:")
            print("1. Check your API key at https://platform.deepseek.com/api_keys")
            print("2. Make sure the key is active and not expired")
            print("3. Copy the key exactly as shown (including 'sk-' prefix)")
        elif "429" in error_str or "rate limit" in error_str.lower():
            print("\n💡 Solution:")
            print("1. Wait a few minutes and try again")
            print("2. Check your rate limits at https://platform.deepseek.com")
        else:
            print("\n💡 General troubleshooting:")
            print("1. Verify your API key is correct")
            print("2. Check your internet connection")
            print("3. Visit https://platform.deepseek.com for account status")
        
        return False

async def test_gigachat_api():
    """Test the GigaChat API configuration"""
    
    # Load environment variables
    load_dotenv()
    
    auth_key = os.getenv("GIGACHAT_AUTH_KEY")
    api_base = os.getenv("GIGACHAT_API_BASE", "https://gigachat.devices.sberbank.ru/api/v1")
    
    print("🔍 Testing GigaChat API Configuration...")
    print(f"API Base URL: {api_base}")
    print(f"Auth Key: {'*' * (len(auth_key) - 8) + auth_key[-8:] if auth_key else 'NOT SET'}")
    print()
    
    if not auth_key:
        print("❌ Error: GIGACHAT_AUTH_KEY not found in environment variables")
        print("Please add your authorization key to server/.env:")
        print("GIGACHAT_AUTH_KEY=your-auth-key-here")
        return False
    
    try:
        # Get access token
        print("🔄 Getting GigaChat access token...")
        url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
        payload = "scope=GIGACHAT_API_PERS"
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "RqUID": str(uuid.uuid4()),
            "Authorization": f"Bearer {auth_key}"
        }
        
        response = requests.post(url, data=payload, headers=headers)
        response.raise_for_status()
        
        token_data = response.json()
        access_token = token_data["access_token"]
        
        print("✅ Access token obtained successfully")
        
        # Initialize client
        client = AsyncOpenAI(
            api_key=access_token,
            base_url=api_base
        )
        
        print("🔄 Testing API connection...")
        
        # Test with a simple request
        response = await client.chat.completions.create(
            model="GigaChat",
            messages=[
                {"role": "user", "content": "Привет! Ответь 'Тест API успешен', если ты можешь это прочитать."}
            ],
            max_tokens=50
        )
        
        if response.choices[0].message.content:
            print("✅ GigaChat API test successful!")
            print(f"Response: {response.choices[0].message.content}")
            return True
        else:
            print("❌ No response received from GigaChat API")
            return False
            
    except Exception as e:
        error_str = str(e)
        print(f"❌ GigaChat API Error: {error_str}")
        
        if "401" in error_str or "Unauthorized" in error_str:
            print("\n💡 Solution:")
            print("1. Check your authorization key at https://developers.sber.ru")
            print("2. Make sure the key is active and not expired")
            print("3. Verify you have access to GigaChat API")
        elif "429" in error_str or "rate limit" in error_str.lower():
            print("\n💡 Solution:")
            print("1. Wait a few minutes and try again")
            print("2. Check your rate limits at https://developers.sber.ru")
        else:
            print("\n💡 General troubleshooting:")
            print("1. Verify your authorization key is correct")
            print("2. Check your internet connection")
            print("3. Visit https://developers.sber.ru for account status")
            print("4. Make sure you have access to GigaChat API")
        
        return False

async def main():
    """Main function"""
    print("🤖 AI Provider Configuration Test")
    print("=" * 50)
    
    provider = os.getenv("AI_PROVIDER", "deepseek").lower()
    print(f"Current provider: {provider}")
    print()
    
    if provider == "gigachat":
        success = await test_gigachat_api()
    else:
        success = await test_deepseek_api()
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 Configuration is working! You can now use the AI Reading Assistant.")
    else:
        print("🔧 Please fix the issues above and run this script again.")
        print("\nTo run this script:")
        print("cd server && python test_ai_providers.py")
        
        print("\n📋 Available providers:")
        print("1. DeepSeek: Set AI_PROVIDER=deepseek and configure DEEPSEEK_API_KEY")
        print("2. GigaChat: Set AI_PROVIDER=gigachat and configure GIGACHAT_AUTH_KEY")

if __name__ == "__main__":
    asyncio.run(main())
