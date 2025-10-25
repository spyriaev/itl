#!/usr/bin/env python3
"""
GigaChat Token Caching Test
This script tests the token caching functionality in ai_service.py
"""

import asyncio
import time
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from ai_service import ai_service

async def test_token_caching():
    """Test GigaChat token caching functionality"""
    print("🧪 Testing GigaChat Token Caching")
    print("=" * 50)
    
    if ai_service.provider != "gigachat":
        print("❌ This test requires AI_PROVIDER=gigachat")
        print("Please set AI_PROVIDER=gigachat in your .env file")
        return
    
    try:
        # Test 1: Get token for the first time
        print("🔄 Test 1: Getting token for the first time...")
        start_time = time.time()
        token1 = await ai_service.get_gigachat_token()
        first_request_time = time.time() - start_time
        
        token_info = ai_service.get_token_info()
        if token_info:
            print(f"✅ Token obtained: {token1[:20]}...")
            print(f"📅 Expires at: {token_info.expires_at}")
            print(f"⏱️  Request took: {first_request_time:.2f} seconds")
        else:
            print("❌ No token info available")
            return
        
        # Test 2: Get token again (should use cache)
        print("\n🔄 Test 2: Getting token again (should use cache)...")
        start_time = time.time()
        token2 = await ai_service.get_gigachat_token()
        second_request_time = time.time() - start_time
        
        print(f"✅ Token obtained: {token2[:20]}...")
        print(f"⏱️  Request took: {second_request_time:.2f} seconds")
        
        # Verify tokens are the same
        if token1 == token2:
            print("✅ Tokens are identical (cache working)")
        else:
            print("❌ Tokens are different (cache not working)")
        
        # Test 3: Check token expiration
        print(f"\n🔄 Test 3: Checking token expiration...")
        if token_info.is_expired():
            print("❌ Token is expired")
        else:
            print("✅ Token is still valid")
        
        # Test 4: Clear cache and get new token
        print(f"\n🔄 Test 4: Clearing cache and getting new token...")
        ai_service.clear_token_cache()
        start_time = time.time()
        token3 = await ai_service.get_gigachat_token()
        third_request_time = time.time() - start_time
        
        print(f"✅ New token obtained: {token3[:20]}...")
        print(f"⏱️  Request took: {third_request_time:.2f} seconds")
        
        # Test 5: Performance comparison
        print(f"\n📊 Performance Summary:")
        print(f"First request:  {first_request_time:.2f}s")
        print(f"Cached request: {second_request_time:.2f}s")
        print(f"After clear:    {third_request_time:.2f}s")
        
        if second_request_time < first_request_time * 0.5:
            print("✅ Cache is significantly faster")
        else:
            print("⚠️  Cache performance improvement is minimal")
        
        print("\n🎉 Token caching test completed successfully!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")

async def main():
    """Main function"""
    await test_token_caching()

if __name__ == "__main__":
    asyncio.run(main())
