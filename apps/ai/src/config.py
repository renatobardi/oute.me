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


settings = Settings()
