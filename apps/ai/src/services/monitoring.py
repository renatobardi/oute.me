import logging
import time

logger = logging.getLogger(__name__)


async def emit_metric(metric_name: str, value: float, labels: dict[str, str] | None = None) -> None:
    """Emite uma métrica customizada para o Cloud Monitoring.

    Silencia erros para não impactar o fluxo principal.
    Métricas disponíveis:
      - llm/tokens_used       labels: source (chat|estimate), agent
      - llm/pipeline_duration labels: status (done|failed)
      - llm/maturity_score    labels: —
      - llm/pipeline_error    labels: agent
    """
    try:
        from google.cloud import monitoring_v3

        from src.config import settings

        client = monitoring_v3.MetricServiceClient()
        project_name = f"projects/{settings.gcp_project}"

        series = monitoring_v3.TimeSeries()
        series.metric.type = f"custom.googleapis.com/oute/{metric_name}"
        for k, v in (labels or {}).items():
            series.metric.labels[k] = v

        now = time.time()
        seconds = int(now)
        nanos = int((now - seconds) * 10**9)

        interval = monitoring_v3.TimeInterval(
            {"end_time": {"seconds": seconds, "nanos": nanos}}
        )
        point = monitoring_v3.Point(
            {"interval": interval, "value": {"double_value": value}}
        )
        series.points = [point]

        client.create_time_series(name=project_name, time_series=[series])
    except Exception:
        logger.debug("Cloud Monitoring emit_metric falhou (não-crítico)", exc_info=True)
