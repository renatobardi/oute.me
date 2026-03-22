"""
Configura variáveis de ambiente mínimas antes que pytest importe
qualquer módulo que instancie src.config.Settings.
"""

import os

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/oute_test")
os.environ.setdefault("GCP_PROJECT", "test-project")
