#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# oute.me — GCP Monitoring & Alerting Setup
# Projeto: oute-488706 | Região: us-central1
# Uso: ./infra/gcp/monitoring.sh
# =============================================================================

PROJECT_ID="oute-488706"
REGION="us-central1"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1" >&2; }

# Enable monitoring API
gcloud services enable monitoring.googleapis.com --project="$PROJECT_ID" --quiet
gcloud services enable logging.googleapis.com --project="$PROJECT_ID" --quiet
log "Monitoring and Logging APIs enabled."

# Create notification channel (email)
if [[ -z "$NOTIFICATION_EMAIL" ]]; then
  warn "NOTIFICATION_EMAIL not set. Skipping notification channel creation."
  warn "Run with: NOTIFICATION_EMAIL=you@example.com ./infra/gcp/monitoring.sh"
  CHANNEL_ID=""
else
  log "Creating email notification channel..."
  CHANNEL_ID=$(gcloud alpha monitoring channels create \
    --display-name="oute.me Alerts" \
    --type=email \
    --channel-labels=email_address="$NOTIFICATION_EMAIL" \
    --project="$PROJECT_ID" \
    --format='value(name)' 2>/dev/null || echo "")

  if [[ -n "$CHANNEL_ID" ]]; then
    log "Notification channel created: ${CHANNEL_ID}"
  else
    warn "Could not create notification channel. Alerts will be created without notifications."
  fi
fi

# --- Alert Policies ---

# 1. Cloud Run — High error rate (5xx > 5% over 5 min)
log "Creating alert: Cloud Run high error rate..."
cat > /tmp/alert-error-rate.json <<'POLICY'
{
  "displayName": "Cloud Run - High Error Rate (>5%)",
  "conditions": [
    {
      "displayName": "Error rate > 5%",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\"",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_RATE"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0.05,
        "duration": "300s",
        "trigger": { "count": 1 }
      }
    }
  ],
  "combiner": "OR",
  "enabled": true
}
POLICY
gcloud alpha monitoring policies create \
  --policy-from-file=/tmp/alert-error-rate.json \
  --project="$PROJECT_ID" \
  --quiet 2>/dev/null || warn "Error rate alert may already exist."

# 2. Cloud Run — High latency (p95 > 5s over 5 min)
log "Creating alert: Cloud Run high latency..."
cat > /tmp/alert-latency.json <<'POLICY'
{
  "displayName": "Cloud Run - High Latency (p95 > 5s)",
  "conditions": [
    {
      "displayName": "Latency p95 > 5s",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_latencies\"",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_PERCENTILE_95"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 5000,
        "duration": "300s",
        "trigger": { "count": 1 }
      }
    }
  ],
  "combiner": "OR",
  "enabled": true
}
POLICY
gcloud alpha monitoring policies create \
  --policy-from-file=/tmp/alert-latency.json \
  --project="$PROJECT_ID" \
  --quiet 2>/dev/null || warn "Latency alert may already exist."

# 3. Cloud Run — Instance count spike (> 4 instances)
log "Creating alert: Cloud Run instance count spike..."
cat > /tmp/alert-instances.json <<'POLICY'
{
  "displayName": "Cloud Run - Instance Count > 4",
  "conditions": [
    {
      "displayName": "Instance count > 4",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/container/instance_count\"",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_MAX"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 4,
        "duration": "300s",
        "trigger": { "count": 1 }
      }
    }
  ],
  "combiner": "OR",
  "enabled": true
}
POLICY
gcloud alpha monitoring policies create \
  --policy-from-file=/tmp/alert-instances.json \
  --project="$PROJECT_ID" \
  --quiet 2>/dev/null || warn "Instance count alert may already exist."

# 4. Cloud SQL — High CPU (> 80% over 10 min)
log "Creating alert: Cloud SQL high CPU..."
cat > /tmp/alert-sql-cpu.json <<'POLICY'
{
  "displayName": "Cloud SQL - CPU > 80%",
  "conditions": [
    {
      "displayName": "CPU utilization > 80%",
      "conditionThreshold": {
        "filter": "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\"",
        "aggregations": [
          {
            "alignmentPeriod": "600s",
            "perSeriesAligner": "ALIGN_MEAN"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0.8,
        "duration": "600s",
        "trigger": { "count": 1 }
      }
    }
  ],
  "combiner": "OR",
  "enabled": true
}
POLICY
gcloud alpha monitoring policies create \
  --policy-from-file=/tmp/alert-sql-cpu.json \
  --project="$PROJECT_ID" \
  --quiet 2>/dev/null || warn "SQL CPU alert may already exist."

# Clean up temp files
rm -f /tmp/alert-*.json

# --- Log-based metrics ---

log "Creating log-based metrics..."

# Auth failures
gcloud logging metrics create auth_failures \
  --description="Authentication failures" \
  --log-filter='resource.type="cloud_run_revision" AND textPayload=~"401|authentication|unauthorized"' \
  --project="$PROJECT_ID" 2>/dev/null || warn "auth_failures metric may already exist."

# Rate limit hits
gcloud logging metrics create rate_limit_hits \
  --description="Rate limit 429 responses" \
  --log-filter='resource.type="cloud_run_revision" AND textPayload=~"429|Too many requests|rate.limit"' \
  --project="$PROJECT_ID" 2>/dev/null || warn "rate_limit_hits metric may already exist."

# Estimate pipeline errors
gcloud logging metrics create estimate_pipeline_errors \
  --description="Estimate pipeline failures" \
  --log-filter='resource.type="cloud_run_revision" AND textPayload=~"Estimate job.*failed"' \
  --project="$PROJECT_ID" 2>/dev/null || warn "estimate_pipeline_errors metric may already exist."

log "Monitoring setup complete!"
echo ""
warn "Next steps:"
echo "  1. Visit https://console.cloud.google.com/monitoring?project=${PROJECT_ID}"
echo "  2. Create a dashboard with Cloud Run + Cloud SQL metrics"
echo "  3. Set up an uptime check for https://oute.me/"
echo "  4. Review and adjust alert thresholds as needed"
