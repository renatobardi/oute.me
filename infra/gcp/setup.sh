#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# oute.me — GCP Infrastructure Setup
# Projeto: oute-488706 | Região: us-central1
# Uso: ./infra/gcp/setup.sh [--phase PHASE]
#   --phase 1  APIs, Artifact Registry, Service Account, Cloud SQL, GCS
#   --phase 2  VPC Connector, Memorystore (prod), WIF (GitHub Actions)
#   --phase 3  Domain mappings (oute.pro)
#   Sem flag  = executa todas as fases
# =============================================================================

PROJECT_ID="oute-488706"
REGION="us-central1"
GITHUB_REPO="renatobardi/oute.me"

# Cloud SQL
SQL_INSTANCE="oute-postgres"
SQL_TIER_DEV="db-f1-micro"
SQL_VERSION="POSTGRES_16"
DB_DEV="oute_develop"
DB_PROD="oute_production"

# Service Account
SA_NAME="oute-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Networking
VPC_CONNECTOR="oute-vpc-connector"

# Redis (prod only)
REDIS_INSTANCE="oute-redis-prod"
REDIS_TIER="BASIC"
REDIS_SIZE_GB=1

# GCS
BUCKET_DEV="oute-dev-uploads"
BUCKET_PROD="oute-prod-uploads"

# WIF
WIF_POOL="github-actions-pool"
WIF_PROVIDER="github-actions-provider"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1" >&2; }

# -----------------------------------------------------------------------------
# Pre-flight checks
# -----------------------------------------------------------------------------
preflight() {
  if ! command -v gcloud &>/dev/null; then
    err "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
    exit 1
  fi

  local current_project
  current_project=$(gcloud config get-value project 2>/dev/null)
  if [[ "$current_project" != "$PROJECT_ID" ]]; then
    warn "Current project is '${current_project}'. Setting to '${PROJECT_ID}'..."
    gcloud config set project "$PROJECT_ID"
  fi
  log "Project: ${PROJECT_ID}"
}

# -----------------------------------------------------------------------------
# Phase 1: APIs, Artifact Registry, Service Account, Cloud SQL, GCS
# -----------------------------------------------------------------------------
phase1() {
  echo ""
  echo "━━━ Phase 1: Core Infrastructure ━━━"

  # Enable APIs
  log "Enabling GCP APIs..."
  gcloud services enable \
    run.googleapis.com \
    sqladmin.googleapis.com \
    redis.googleapis.com \
    storage.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    vpcaccess.googleapis.com \
    iam.googleapis.com \
    iamcredentials.googleapis.com \
    cloudresourcemanager.googleapis.com

  # Artifact Registry
  log "Creating Artifact Registry repository..."
  if gcloud artifacts repositories describe oute --location="$REGION" &>/dev/null; then
    warn "Artifact Registry 'oute' already exists, skipping."
  else
    gcloud artifacts repositories create oute \
      --repository-format=docker \
      --location="$REGION" \
      --description="oute.me container images"
  fi

  # Service Account
  log "Creating Service Account..."
  if gcloud iam service-accounts describe "$SA_EMAIL" &>/dev/null 2>&1; then
    warn "Service Account '${SA_NAME}' already exists, skipping."
  else
    gcloud iam service-accounts create "$SA_NAME" \
      --display-name="oute.me Deployer"
  fi

  local roles=(
    "roles/run.admin"
    "roles/artifactregistry.writer"
    "roles/secretmanager.secretAccessor"
    "roles/cloudsql.client"
    "roles/storage.admin"
    "roles/iam.serviceAccountUser"
    "roles/firebaseauth.admin"
  )
  for role in "${roles[@]}"; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member="serviceAccount:${SA_EMAIL}" \
      --role="$role" \
      --condition=None \
      --quiet
  done
  log "Service Account roles assigned."

  # Cloud SQL
  log "Creating Cloud SQL instance..."
  if gcloud sql instances describe "$SQL_INSTANCE" &>/dev/null 2>&1; then
    warn "Cloud SQL instance '${SQL_INSTANCE}' already exists, skipping."
  else
    gcloud sql instances create "$SQL_INSTANCE" \
      --database-version="$SQL_VERSION" \
      --tier="$SQL_TIER_DEV" \
      --edition=ENTERPRISE \
      --region="$REGION" \
      --storage-type=SSD \
      --storage-size=10GB \
      --storage-auto-increase \
      --availability-type=zonal
  fi

  # Databases
  for db in "$DB_DEV" "$DB_PROD"; do
    if gcloud sql databases describe "$db" --instance="$SQL_INSTANCE" &>/dev/null 2>&1; then
      warn "Database '${db}' already exists, skipping."
    else
      gcloud sql databases create "$db" --instance="$SQL_INSTANCE"
      log "Database '${db}' created."
    fi
  done

  # Set postgres password (interactive)
  warn "Set the postgres user password for Cloud SQL:"
  gcloud sql users set-password postgres \
    --instance="$SQL_INSTANCE" \
    --prompt-for-password

  # GCS Buckets
  for bucket in "$BUCKET_DEV" "$BUCKET_PROD"; do
    if gcloud storage buckets describe "gs://${bucket}" &>/dev/null 2>&1; then
      warn "Bucket '${bucket}' already exists, skipping."
    else
      gcloud storage buckets create "gs://${bucket}" \
        --location="$REGION" \
        --uniform-bucket-level-access \
        --public-access-prevention=enforced
      log "Bucket '${bucket}' created."
    fi
  done

  log "Phase 1 complete."
}

# -----------------------------------------------------------------------------
# Phase 2: VPC Connector, Memorystore, Workload Identity Federation
# -----------------------------------------------------------------------------
phase2() {
  echo ""
  echo "━━━ Phase 2: Networking & CI/CD ━━━"

  # VPC Connector (for Cloud Run → Cloud SQL / Memorystore)
  log "Creating VPC Connector..."
  if gcloud compute networks vpc-access connectors describe "$VPC_CONNECTOR" --region="$REGION" &>/dev/null 2>&1; then
    warn "VPC Connector '${VPC_CONNECTOR}' already exists, skipping."
  else
    gcloud compute networks vpc-access connectors create "$VPC_CONNECTOR" \
      --region="$REGION" \
      --range="10.8.0.0/28" \
      --min-instances=2 \
      --max-instances=3
  fi

  # Memorystore Redis (prod only)
  log "Creating Memorystore Redis (prod)..."
  if gcloud redis instances describe "$REDIS_INSTANCE" --region="$REGION" &>/dev/null 2>&1; then
    warn "Redis instance '${REDIS_INSTANCE}' already exists, skipping."
  else
    gcloud redis instances create "$REDIS_INSTANCE" \
      --region="$REGION" \
      --tier="$REDIS_TIER" \
      --size="$REDIS_SIZE_GB" \
      --redis-version=redis_7_2 \
      --network=default
  fi

  # Workload Identity Federation (GitHub Actions)
  log "Setting up Workload Identity Federation..."

  if gcloud iam workload-identity-pools describe "$WIF_POOL" --location=global &>/dev/null 2>&1; then
    warn "WIF pool '${WIF_POOL}' already exists, skipping."
  else
    gcloud iam workload-identity-pools create "$WIF_POOL" \
      --location=global \
      --display-name="GitHub Actions Pool"
  fi

  if gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER" \
    --workload-identity-pool="$WIF_POOL" --location=global &>/dev/null 2>&1; then
    warn "WIF provider '${WIF_PROVIDER}' already exists, skipping."
  else
    gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER" \
      --location=global \
      --workload-identity-pool="$WIF_POOL" \
      --display-name="GitHub Actions Provider" \
      --issuer-uri="https://token.actions.githubusercontent.com" \
      --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
      --attribute-condition="assertion.repository=='${GITHUB_REPO}'"
  fi

  # Bind SA to WIF pool
  local wif_member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${GITHUB_REPO}"

  gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
    --role="roles/iam.workloadIdentityUser" \
    --member="$wif_member" \
    --quiet

  log "WIF configured for ${GITHUB_REPO}."

  # Print WIF values for GitHub secrets
  local project_number
  project_number=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
  echo ""
  warn "Add these to GitHub repository secrets:"
  echo "  GCP_WORKLOAD_IDENTITY_PROVIDER = projects/${project_number}/locations/global/workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}"
  echo "  GCP_SERVICE_ACCOUNT = ${SA_EMAIL}"
  echo ""
  warn "Add these to GitHub repository variables:"
  echo "  GCP_PROJECT_ID = ${PROJECT_ID}"
  echo "  GCP_REGION = ${REGION}"

  log "Phase 2 complete."
}

# -----------------------------------------------------------------------------
# Phase 3: Domain mappings
# -----------------------------------------------------------------------------
phase3() {
  echo ""
  echo "━━━ Phase 3: Domain Mappings ━━━"

  # oute.pro → Cloud Run prod (primary domain)
  log "Creating domain mapping for oute.pro..."
  if gcloud run domain-mappings describe --domain=oute.pro --region="$REGION" &>/dev/null 2>&1; then
    warn "Domain mapping 'oute.pro' already exists, skipping."
  else
    gcloud run domain-mappings create \
      --service=oute-web-prod \
      --domain=oute.pro \
      --region="$REGION"
  fi

  # dev.oute.pro → Cloud Run dev
  log "Creating domain mapping for dev.oute.pro..."
  if gcloud run domain-mappings describe --domain=dev.oute.pro --region="$REGION" &>/dev/null 2>&1; then
    warn "Domain mapping 'dev.oute.pro' already exists, skipping."
  else
    gcloud run domain-mappings create \
      --service=oute-web-dev \
      --domain=dev.oute.pro \
      --region="$REGION"
  fi

  echo ""
  warn "DNS records needed (configure at Hostinger):"
  echo "  CNAME oute.pro → ghs.googlehosted.com"
  echo "  CNAME dev      → ghs.googlehosted.com"

  log "Phase 3 complete."
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
  preflight

  local phase="${1:-all}"

  # Parse --phase flag
  if [[ "$phase" == "--phase" ]]; then
    phase="${2:-all}"
  fi

  case "$phase" in
    1)   phase1 ;;
    2)   phase2 ;;
    3)   phase3 ;;
    all)
      phase1
      phase2
      phase3
      ;;
    *)
      err "Unknown phase: ${phase}. Use 1, 2, 3, or omit for all."
      exit 1
      ;;
  esac

  echo ""
  log "Setup complete!"
}

main "$@"
