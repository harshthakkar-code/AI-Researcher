import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    port: int = 8000
    environment: str = "development"

    # API Keys
    gemini_api_key: str = ""
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    serper_api_key: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
