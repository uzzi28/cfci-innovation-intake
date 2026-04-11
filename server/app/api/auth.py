from fastapi import APIRouter, HTTPException
from app.core.dependencies import db_dependency, user_dependency
from app.db.models.user import User
from app.schemas import user_schemas, auth_schemas
from app.core.security import hash_password, verify_password
from app.core.jwt import create_access_token
import logging
import os

logger = logging.getLogger(__name__)


def _approved_staff_emails() -> set[str]:
    raw = os.getenv("STAFF_EMAILS", "tingting.li@duke.edu")
    return {x.strip().lower() for x in raw.split(",") if x.strip()}

# Create router for all auth-related endpoints
router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register")
async def register_user(
    payload: user_schemas.UserCreateSchema,
    db = db_dependency
):
    """
    Endpoint to register a new user.
    """
    
    """
    1. Validate the incoming user data,
       ensuring the email is unique.
    """
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")
    
    """
    2. Create new User instance, hash the password,
       and store in the database.
    """
    email_lower = payload.email.strip().lower()
    user = User(
        email=payload.email.strip(),
        hashed_password=hash_password(payload.password),
        firstname=payload.firstname,
        lastname=payload.lastname,
        is_staff=email_lower in _approved_staff_emails(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "email": user.email,
        "firstname": user.firstname,
        "lastname": user.lastname,
        "is_staff": bool(user.is_staff),
    }


@router.get("/me")
async def get_me(user: User = user_dependency):
    return {
        "user_id": user.id,
        "email": user.email,
        "firstname": user.firstname,
        "lastname": user.lastname,
        "is_staff": bool(user.is_staff),
    }


@router.post("/login")
async def login_user(
    payload: auth_schemas.LoginRequestSchema,
    db = db_dependency
):
    """
    Endpoint to sign a user in.
    
    1. Verify user credentials, raising error if invalid
       or user doesn't exist for some reason.
    2. If valid, return a success message, generate token
       and return it.
    """

    logger.info(f"Login attempt for email: {payload.email}")

    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(plain_password=payload.password, hashed_password=user.hashed_password):
        logger.warning(f"Failed login attempt for email: {payload.email}")
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    logger.info(f"Successful login for email: {payload.email}")
    
    token = create_access_token(
        data={
            "user_id": user.id,
            "email": user.email,
            "is_staff": bool(user.is_staff),
        },
        expires_minutes=43200,
    )
    return {
        "user_id": user.id,
        "access_token": token,
        "token_type": "bearer",
        "email": user.email,
        "firstname": user.firstname,
        "lastname": user.lastname,
        "is_staff": bool(user.is_staff),
    }

