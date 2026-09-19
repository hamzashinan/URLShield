"""Configuration management for URLShield"""

from pathlib import Path
from typing import Optional

import yaml
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from URLshield.utils import mkdir_with_permissions



class Settings(BaseSettings):
    
    """Application settings with environment variable overrides"""

    # API Authentication
    api_key: str = Field(
        default="dev-secret-key",
        alias="URLSHIELD_API_KEY"
    )

    allow_origin: str = Field(
        default="http://localhost:5173",
        alias="URLSHIELD_ALLOW_ORIGIN"
    )

    # Data Storage
    data_root: Path = Field(
        default=Path("./data"),
        alias="URLSHIELD_DATA_ROOT"
    )

    # Browser Settings
    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36"
    )
    headless: bool = True

    # Scraping Behavior
    respect_robots: bool = True
    request_timeout_ms: int = 30000
    max_retries: int = 3
    retry_delay_ms: int = 1000

    # Concurrency & Rate Limiting
    max_concurrency: int = 5
    rate_limit_per_host: int = 0

    # Features
    ocr_enabled: bool = False

    # API Server
    api_host: str = Field(
        default="0.0.0.0",
        alias="URLSHIELD_API_HOST"
    )

    api_port: int = Field(
        default=8080,
        alias="URLSHIELD_API_PORT"
    )

    # Worker
    worker_concurrency: int = 24
    queue_check_interval_ms: int = 1000
    cleanup_on_start: bool = True

    # Logging
    log_level: str = Field(
        default="INFO",
        alias="URLSHIELD_LOG_LEVEL"
    )

    log_format: str = "json"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="allow",
        populate_by_name=True
    )


def load_config(config_path: Optional[Path] = None) -> Settings:
    """Load configuration from YAML and environment variables"""

    yaml_config = {}

    if config_path is None:
        config_path = Path("config.yaml")

    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            yaml_config = yaml.safe_load(f) or {}

    settings_dict = {}

    for key, value in yaml_config.items():
        settings_dict[key] = value

    settings = Settings(**settings_dict)

    mkdir_with_permissions(settings.data_root)

    return settings


_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get global settings instance"""

    global _settings

    if _settings is None:
        _settings = load_config()

    return _settings
