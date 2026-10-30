from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from URLshield.config import get_settings
from URLshield.database import get_db
from URLshield.db_models import User as DBUser


router = APIRouter(prefix="/auth", tags=["Authentication"])

password_hasher = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)


# -----------------------------
# Request and response schemas
# -----------------------------

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    role: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# -----------------------------
# JWT functions
# -----------------------------

def _get_jwt_secret_key() -> str:
    secret_key = get_settings().jwt_secret_key

    if not secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured. Set URLSHIELD_JWT_SECRET_KEY.",
        )

    return secret_key


def create_access_token(user: DBUser) -> str:
    settings = get_settings()
    secret_key = _get_jwt_secret_key()

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )

    payload = {
        "sub": str(user.id),
        "iat": now,
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        secret_key,
        algorithm="HS256",
    )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
) -> DBUser:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise unauthorized

    try:
        payload = jwt.decode(
            credentials.credentials,
            _get_jwt_secret_key(),
            algorithms=["HS256"],
        )

        user_id = int(payload.get("sub", ""))

    except (jwt.InvalidTokenError, TypeError, ValueError):
        raise unauthorized

    user = db.get(DBUser, user_id)

    if user is None:
        raise unauthorized

    return user


def get_admin_user(
    current_user: DBUser = Depends(get_current_user),
) -> DBUser:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )

    return current_user


# -----------------------------
# Registration
# -----------------------------

@router.post("/register", response_model=AuthResponse,
             status_code=status.HTTP_201_CREATED)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
):
    _get_jwt_secret_key()

    email = str(request.email).strip().lower()
    username = request.username.strip()

    if not username:
        raise HTTPException(
            status_code=400,
            detail="Username cannot be empty.",
        )

    existing_user = db.scalar(
        select(DBUser).where(
            (DBUser.email == email) |
            (DBUser.username == username)
        )
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Email or username is already registered.",
        )

    user = DBUser(
        username=username,
        email=email,
        password_hash=password_hasher.hash(request.password),
        role="user",
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Email or username is already registered.",
        )

    token = create_access_token(user)

    return AuthResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


# -----------------------------
# Login
# -----------------------------

@router.post("/login", response_model=AuthResponse)
def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
):
    email = str(request.email).strip().lower()

    user = db.scalar(
        select(DBUser).where(DBUser.email == email)
    )

    if user is None or not password_hasher.verify(
        request.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(user)

    return AuthResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


# -----------------------------
# Current logged-in user
# -----------------------------

@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: DBUser = Depends(get_current_user),
):
    return current_user