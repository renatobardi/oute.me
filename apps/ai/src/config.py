from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = ""
    redis_url: str = ""
    gemini_api_key: str = ""
    google_cloud_storage_bucket: str = ""
    storage_local_path: str = "./data/uploads"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
