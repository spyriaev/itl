from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import os
from typing import Optional

# JWT configuration
JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
if not JWT_SECRET or JWT_SECRET == "your_jwt_secret_here":
    print("⚠️  WARNING: SUPABASE_JWT_SECRET not set or using placeholder value")
    print("   Authentication will not work until you set the real JWT secret")
    print("   Get it from: Supabase Dashboard → Settings → API → JWT Settings → JWT Secret")
    JWT_SECRET = "placeholder-secret-for-development"

security = HTTPBearer(auto_error=False)

def verify_jwt_token(token: str) -> Optional[str]:
    """
    Verify JWT token and extract user ID from 'sub' claim
    Returns user ID if valid, None if invalid
    """
    print(f"\n🔐 JWT VERIFICATION:")
    print(f"   Token (first 50 chars): {token[:50]}...")
    print(f"   JWT Secret configured: {'Yes' if JWT_SECRET and JWT_SECRET != 'placeholder-secret-for-development' else 'No'}")
    
    try:
        payload = jwt.decode(
            token, 
            JWT_SECRET, 
            algorithms=["HS256"],
            options={"verify_exp": True, "verify_aud": False}  # Disable audience verification
        )
        user_id = payload.get("sub")
        audience = payload.get("aud")
        print(f"   ✅ Token valid! User ID: {user_id}")
        print(f"   Token audience: {audience}")
        print(f"   Token payload keys: {list(payload.keys())}")
        return user_id
    except JWTError as e:
        print(f"   ❌ Token verification failed: {str(e)}")
        return None

def get_current_user_id(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> str:
    """
    FastAPI dependency to get authenticated user ID
    Raises HTTPException(401) if authentication fails
    """
    print(f"\n🔑 AUTHENTICATION CHECK:")
    
    if not credentials:
        print(f"   ❌ No credentials provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    print(f"   📝 Credentials scheme: {credentials.scheme}")
    token = credentials.credentials
    user_id = verify_jwt_token(token)
    
    if user_id is None:
        print(f"   ❌ Authentication failed - invalid token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    print(f"   ✅ Authentication successful!")
    return user_id
