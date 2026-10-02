"""SQLAlchemy database models for URLShield."""

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from URLshield.database import Base


class ScanJob(Base):
    """Persistent URL analysis job."""

    __tablename__ = "scan_jobs"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
    )

    url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    state: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="queued",
        index=True,
    )

    brand_hint: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    legitimate_domain: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )