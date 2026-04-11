from fastapi import Depends, Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import get_settings
from jose import JWTError
from app.core.jwt import decode_token
from app.services.openai_service import OpenAIService
from app.db.database import get_db
from app.db.models.user import User
import logging

# LOGGER FOR TESTING
logger = logging.getLogger(__name__)


# Database dependency
db_dependency = Depends(get_db)

# Define settings dependency (used for routes)
settings_dependency = Depends(get_settings)

# Security dependency for extracting and verifying JWT tokens
bearer_scheme = HTTPBearer(auto_error=True)

def get_openai_service(request: Request) -> OpenAIService:
    return request.app.state.openai_client

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db = db_dependency
):
    """
    Extract the JWT from the Authorization header, decode it,
    validate it, and return the authenticated user.
    """

    logger.info("Getting current user from token.")

    # Extract the raw token (no need to reconstruct "Bearer ...")
    token = credentials.credentials

    # Decode the token
    try:
        payload = decode_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        # FIX: use the field you actually encode
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

    except JWTError:
        raise HTTPException(status_code=401, detail="Token decode error")

    # Load the user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user

user_dependency = Depends(get_current_user)


def get_current_staff_user(user: User = Depends(get_current_user)):
    if not getattr(user, "is_staff", False):
        raise HTTPException(status_code=403, detail="Staff access required.")
    return user


staff_user_dependency = Depends(get_current_staff_user)

openai_service_dependency = Depends(get_openai_service)

