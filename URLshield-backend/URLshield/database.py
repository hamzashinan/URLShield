"""Database configuration for URLShield."""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from URLshield.config import get_settings


settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    """Provide a database session for FastAPI endpoints."""
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()