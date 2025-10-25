#!/usr/bin/env python3
"""
GigaChat Authorization Key Diagnostic
This script helps diagnose issues with GigaChat authorization key
"""

import os
import base64
import requests
import uuid
import urllib3
from dotenv import load_dotenv

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Load environment variables
load_dotenv()

def diagnose_auth_key():
    """Diagnose GigaChat authorization key issues"""
    print("🔍 GigaChat Authorization Key Diagnostic")
    print("=" * 50)
    
    auth_key = os.getenv("GIGACHAT_AUTH_KEY")
    if not auth_key:
        print("❌ GIGACHAT_AUTH_KEY not found in environment variables")
        return
    
    print(f"📋 Current auth key: {auth_key[:20]}...{auth_key[-20:]}")
    print(f"📏 Key length: {len(auth_key)} characters")
    
    # Try to decode the key
    try:
        decoded = base64.b64decode(auth_key).decode('utf-8')
        print(f"✅ Successfully decoded: {decoded}")
        
        # Check format
        if ':' in decoded:
            parts = decoded.split(':', 1)
            print(f"📝 Client ID: {parts[0]}")
            print(f"📝 Client Secret: {parts[1][:10]}...{parts[1][-10:]}")
            print(f"📏 Client ID length: {len(parts[0])}")
            print(f"📏 Client Secret length: {len(parts[1])}")
        else:
            print("❌ Decoded key doesn't contain ':' separator")
            print("Expected format: Client ID:Client Secret")
            
    except Exception as e:
        print(f"❌ Failed to decode base64: {e}")
        print("The key should be base64 encoded Client ID:Client Secret")
    
    # Test the key with GigaChat API
    print(f"\n🔄 Testing with GigaChat API...")
    
    url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    payload = "scope=GIGACHAT_API_PERS"
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "RqUID": str(uuid.uuid4()),
        "Authorization": f"Basic {auth_key}"
    }
    
    try:
        response = requests.post(url, data=payload, headers=headers, verify=False)
        
        print(f"📊 Response status: {response.status_code}")
        print(f"📊 Response headers: {dict(response.headers)}")
        print(f"📊 Response body: {response.text}")
        
        if response.ok:
            print("✅ Authorization key is working!")
            token_data = response.json()
            if "access_token" in token_data:
                print(f"🎉 Access token obtained: {token_data['access_token'][:20]}...")
            if "expires_at" in token_data:
                print(f"⏰ Token expires at: {token_data['expires_at']}")
        else:
            print("❌ Authorization key is not working")
            
            # Try different approaches
            print(f"\n🔄 Trying alternative approaches...")
            
            # Method 1: Try with Bearer instead of Basic
            print("Method 1: Bearer auth")
            headers["Authorization"] = f"Bearer {auth_key}"
            response = requests.post(url, data=payload, headers=headers, verify=False)
            print(f"Bearer result: {response.status_code} - {response.text[:100]}")
            
            # Method 2: Try re-encoding the key
            print("Method 2: Re-encoding key")
            try:
                decoded = base64.b64decode(auth_key).decode('utf-8')
                reencoded = base64.b64encode(decoded.encode('utf-8')).decode('utf-8')
                headers["Authorization"] = f"Basic {reencoded}"
                response = requests.post(url, data=payload, headers=headers, verify=False)
                print(f"Re-encoded result: {response.status_code} - {response.text[:100]}")
            except Exception as e:
                print(f"Re-encoding failed: {e}")
            
    except Exception as e:
        print(f"❌ API request failed: {e}")
    
    print(f"\n💡 Recommendations:")
    print("1. Make sure you have valid Client ID and Client Secret from GigaChat")
    print("2. Generate auth key using: echo -n 'client_id:client_secret' | base64")
    print("3. Or use the provided script: python generate_gigachat_key.py client_id client_secret")
    print("4. Check that your GigaChat account has API access enabled")

if __name__ == "__main__":
    diagnose_auth_key()
