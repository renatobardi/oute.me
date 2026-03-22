from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = ""
    redis_url: str = ""
    google_cloud_storage_bucket: str = ""
    storage_local_path: str = "./data/uploads"

    # Vertex AI — autenticação via ADC (Application Default Credentials)
    gcp_project: str = "oute-488706"
    gcp_location: str = "us-central1"

    # Cloud Tasks — fila para pipeline de estimativa (opcional: fallback para background task)
    cloud_tasks_queue: str = ""
    ai_service_url: str = ""  # URL pública do Cloud Run AI (para Cloud Tasks callback)

    # Document AI — processador Layout Parser (opcional: fallback para parsers locais)
    document_ai_processor_id: str = ""

    # Google Custom Search — busca web no pipeline de estimativa (opcional)
    google_search_api_key: str = ""
    google_search_cx: str = ""

    # Grok (xAI) — opcional, usado quando llm_model começa com "grok"
    grok_api_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v:
            raise ValueError(
                "DATABASE_URL é obrigatório. Exemplo: postgresql://user:pass@host:5432/oute_develop"
            )
        return v

    @field_validator("gcp_project")
    @classmethod
    def validate_gcp_project(cls, v: str) -> str:
        if not v:
            raise ValueError("GCP_PROJECT é obrigatório para Vertex AI")
        return v


settings = Settings()
