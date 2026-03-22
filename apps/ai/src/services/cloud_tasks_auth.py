from __future__ import annotations

import logging

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

logger = logging.getLogger(__name__)


async def verify_cloud_tasks_token(
    authorization: str,
    expected_audience: str,
) -> bool:
    """Verifica OIDC token enviado pelo Cloud Tasks.

    Cloud Tasks envia um JWT assinado pelo Google no header Authorization.
    Devemos verificar:
    - Assinatura válida (Google-signed)
    - issuer é accounts.google.com
    - audience é a URL do nosso Cloud Run service
    """
    if not authorization.startswith("Bearer "):
        return False
    token = authorization[7:]
    try:
        claims = id_token.verify_oauth2_token(  # type: ignore[no-untyped-call]  # google-auth has no stubs
            token,
            google_requests.Request(),
            audience=expected_audience,
        )
        issuer = claims.get("iss", "")
        if issuer not in (
            "accounts.google.com",
            "https://accounts.google.com",
        ):
            logger.warning("OIDC token issuer inválido: %s", issuer)
            return False
        return True
    except Exception:
        logger.exception("Falha na verificação do OIDC token")
        return False
