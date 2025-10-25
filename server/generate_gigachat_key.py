#!/usr/bin/env python3
"""
GigaChat Authorization Key Generator
This script helps you generate the correct authorization key for GigaChat API.
"""

import base64
import sys

def generate_auth_key(client_id, client_secret):
    """Generate GigaChat authorization key from Client ID and Client Secret"""
    auth_string = f"{client_id}:{client_secret}"
    auth_key = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
    return auth_key

def main():
    print("🔑 GigaChat Authorization Key Generator")
    print("=" * 50)
    
    if len(sys.argv) == 3:
        client_id = sys.argv[1]
        client_secret = sys.argv[2]
    else:
        print("Enter your GigaChat credentials:")
        client_id = input("Client ID: ").strip()
        client_secret = input("Client Secret: ").strip()
    
    if not client_id or not client_secret:
        print("❌ Error: Both Client ID and Client Secret are required")
        return
    
    try:
        auth_key = generate_auth_key(client_id, client_secret)
        
        print("\n✅ Generated authorization key:")
        print(f"GIGACHAT_AUTH_KEY={auth_key}")
        
        print("\n📋 Add this to your server/.env file:")
        print(f"GIGACHAT_AUTH_KEY={auth_key}")
        
        print("\n🔍 Verification:")
        print(f"Original string: {client_id}:{client_secret}")
        print(f"Base64 encoded: {auth_key}")
        
        # Verify by decoding
        decoded = base64.b64decode(auth_key).decode('utf-8')
        print(f"Decoded back: {decoded}")
        
        if decoded == f"{client_id}:{client_secret}":
            print("✅ Verification successful!")
        else:
            print("❌ Verification failed!")
            
    except Exception as e:
        print(f"❌ Error generating key: {e}")

if __name__ == "__main__":
    main()
