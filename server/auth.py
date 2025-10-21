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
    try:
        payload = jwt.decode(
            token, 
            JWT_SECRET, 
            algorithms=["HS256"],
            options={"verify_exp": True}
        )
        user_id = payload.get("sub")
        return user_id
    except JWTError:
        return None

def get_current_user_id(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> str:
    """
    FastAPI dependency to get authenticated user ID
    Raises HTTPException(401) if authentication fails
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    user_id = verify_jwt_token(token)
    
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user_id
