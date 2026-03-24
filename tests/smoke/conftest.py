"""Smoke test config — não precisa de database nem venv do projeto."""
import os

os.environ.setdefault("GCP_PROJECT", "test")
os.environ.setdefault("DATABASE_URL", "")
