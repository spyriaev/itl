#!/usr/bin/env python3
"""
GigaChat API Connection Test
This script tests direct connection to GigaChat API
"""

import asyncio
import httpx
import os
import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def test_gigachat_connection():
    """Test direct connection to GigaChat API"""
    print("🔍 Testing GigaChat API Connection")
    print("=" * 50)
    
    auth_key = os.getenv("GIGACHAT_AUTH_KEY")
    if not auth_key:
        print("❌ GIGACHAT_AUTH_KEY not found")
        return
    
    # Get access token first
    print("🔄 Getting access token...")
    url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    payload = "scope=GIGACHAT_API_PERS"
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "RqUID": str(uuid.uuid4()),
        "Authorization": f"Basic {auth_key}"
    }
    
    try:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(url, data=payload, headers=headers)
            
            if response.status_code == 200:
                token_data = response.json()
                access_token = token_data["access_token"]
                print(f"✅ Token obtained: {access_token[:20]}...")
                
                # Test different API endpoints
                endpoints = [
                    "https://gigachat.devices.sberbank.ru/api/v1",
                    "https://gigachat.devices.sberbank.ru/",
                    "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"
                ]
                
                for endpoint in endpoints:
                    print(f"\n🔄 Testing endpoint: {endpoint}")
                    
                    try:
                        # Test with different models
                        models = ["GigaChat", "gigachat", "GigaChat:latest"]
                        
                        for model in models:
                            print(f"  Testing model: {model}")
                            
                            test_data = {
                                "model": model,
                                "messages": [
                                    {"role": "user", "content": "Привет! Ответь 'Тест успешен' если ты можешь это прочитать."}
                                ],
                                "max_tokens": 50
                            }
                            
                            headers = {
                                "Authorization": f"Bearer {access_token}",
                                "Content-Type": "application/json"
                            }
                            
                            try:
                                response = await client.post(
                                    f"{endpoint}/chat/completions",
                                    json=test_data,
                                    headers=headers,
                                    timeout=30.0
                                )
                                
                                print(f"    Status: {response.status_code}")
                                print(f"    Response: {response.text[:200]}...")
                                
                                if response.status_code == 200:
                                    print(f"    ✅ Success with model {model}!")
                                    return
                                    
                            except Exception as e:
                                print(f"    ❌ Error with model {model}: {e}")
                                
                    except Exception as e:
                        print(f"  ❌ Endpoint error: {e}")
                        
            else:
                print(f"❌ Token request failed: {response.status_code} - {response.text}")
                
    except Exception as e:
        print(f"❌ Connection test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_gigachat_connection())
