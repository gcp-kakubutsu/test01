# From Scratch - CLI Setup Scripts

This document provides complete CLI commands to set up the Nukune application infrastructure from scratch. Copy and paste these scripts to automate the setup process.

**Companion to:** [FROM_SCRATCH.md](./FROM_SCRATCH.md) - The step-by-step manual guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Configuration Variables](#configuration-variables)
3. [Account Setup](#account-setup)
4. [Complete Setup Script](#complete-setup-script)
5. [Secret Creation Script](#secret-creation-script)
6. [Verification Script](#verification-script)
7. [Cleanup Script](#cleanup-script)

---

## Prerequisites

### Install Required Tools

```bash
# Install gcloud CLI (if not already installed)
# https://cloud.google.com/sdk/docs/install

# Install Firebase CLI
npm install -g firebase-tools

# Login to gcloud
gcloud auth login

# Login to Firebase
firebase login

# Verify installations
gcloud --version
firebase --version
node --version  # Should be v18+
```

---

## Configuration Variables

**Copy this section and modify the values for your environment:**

```bash
#!/bin/bash

# ===========================================
# PROJECT CONFIGURATION
# ===========================================

# Project Settings
export PROJECT_ID="nukune-staging-$(date +%s)"  # Or use your own ID
export PROJECT_NAME="Nukune Staging"
export BILLING_ACCOUNT_ID="YOUR_BILLING_ACCOUNT_ID"  # Find at: https://console.cloud.google.com/billing

# Region Selection (choose ONE)
# Option 1: Asia (Taiwan) - Recommended for Asian users
export REGION="asia-east1"
export CLOUD_SQL_REGION="asia-east1"

# Option 2: US Central
# export REGION="us-central1"
# export CLOUD_SQL_REGION="us-central1"

# GitHub Settings
export GITHUB_REPO_OWNER="your-github-username"
export GITHUB_REPO_NAME="Nukune"
export GIT_BRANCH="staging"

# Infrastructure Names
export CLOUD_SQL_INSTANCE="nukune-mysql"
export DATABASE_NAME="nukune_db"
export DATABASE_USER="nukune_app"
export DATABASE_PASSWORD="$(openssl rand -base64 32)"  # Auto-generate secure password

export VPC_CONNECTOR_NAME="nukune-connector"
export CLOUD_ROUTER_NAME="nukune-router"
export NAT_IP_NAME="nukune-nat-ip"
export NAT_GATEWAY_NAME="nukune-nat"

export BACKEND_ID="nukune-staging"

# API Keys (you need to provide these)
export GOOGLE_GENKIT_API_KEY="your-genkit-api-key"
export TRANSACTION_HUB_API_KEY="your-transaction-hub-api-key"
export API_REGISTER_PASSWORD="$(openssl rand -base64 24)"
export JWT_SECRET="$(openssl rand -base64 48)"

# Save configuration to file
echo "PROJECT_ID=$PROJECT_ID" > .env.setup
echo "DATABASE_PASSWORD=$DATABASE_PASSWORD" >> .env.setup
echo "API_REGISTER_PASSWORD=$API_REGISTER_PASSWORD" >> .env.setup
echo "JWT_SECRET=$JWT_SECRET" >> .env.setup
echo ""
echo "✅ Configuration saved to .env.setup"
echo "🔐 IMPORTANT: Save these credentials securely!"
cat .env.setup
```

---

## Account Setup

### Switch GCP Account (if needed)

```bash
# List available accounts
gcloud auth list

# Switch to a different account
gcloud auth login --account=YOUR_EMAIL@gmail.com

# Or add a new account
gcloud auth login --no-launch-browser

# Verify current account
gcloud config get-value account
```

### Set Active Project

```bash
# List all projects
gcloud projects list

# Switch to a different project
gcloud config set project YOUR_PROJECT_ID

# Verify current project
gcloud config get-value project
```

---

## Complete Setup Script

**This script creates the entire infrastructure. Run it after configuring the variables above.**

```bash
#!/bin/bash
set -e  # Exit on error

# Source configuration (if saved to file)
source .env.setup 2>/dev/null || echo "Using environment variables"

echo "=========================================="
echo "Nukune Infrastructure Setup"
echo "=========================================="
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "=========================================="
echo ""

# ===========================================
# STEP 1: Create GCP Project
# ===========================================
echo "📦 Step 1: Creating GCP Project..."

gcloud projects create $PROJECT_ID \
  --name="$PROJECT_NAME" \
  --set-as-default

# Link billing account
gcloud billing projects link $PROJECT_ID \
  --billing-account=$BILLING_ACCOUNT_ID

echo "✅ Project created and billing enabled"
echo ""

# ===========================================
# STEP 2: Enable Required APIs
# ===========================================
echo "🔌 Step 2: Enabling APIs (this may take a few minutes)..."

gcloud services enable \
  sqladmin.googleapis.com \
  servicenetworking.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com \
  vpcaccess.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firebase.googleapis.com \
  firestore.googleapis.com \
  --project=$PROJECT_ID

echo "✅ APIs enabled"
echo ""

# ===========================================
# STEP 3: Create Cloud SQL Instance
# ===========================================
echo "🗄️  Step 3: Creating Cloud SQL Instance..."

gcloud sql instances create $CLOUD_SQL_INSTANCE \
  --database-version=MYSQL_8_0 \
  --tier=db-n1-standard-2 \
  --region=$CLOUD_SQL_REGION \
  --root-password="$DATABASE_PASSWORD" \
  --storage-type=SSD \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --project=$PROJECT_ID

echo "⏳ Waiting for Cloud SQL instance to be ready..."
gcloud sql operations wait \
  $(gcloud sql operations list --instance=$CLOUD_SQL_INSTANCE --limit=1 --format="value(name)") \
  --project=$PROJECT_ID

# Create database
gcloud sql databases create $DATABASE_NAME \
  --instance=$CLOUD_SQL_INSTANCE \
  --project=$PROJECT_ID

# Create user
gcloud sql users create $DATABASE_USER \
  --instance=$CLOUD_SQL_INSTANCE \
  --password="$DATABASE_PASSWORD" \
  --project=$PROJECT_ID

# Get connection name
export CLOUD_SQL_CONNECTION_NAME=$(gcloud sql instances describe $CLOUD_SQL_INSTANCE \
  --format="value(connectionName)" \
  --project=$PROJECT_ID)

echo "✅ Cloud SQL Instance created"
echo "   Connection Name: $CLOUD_SQL_CONNECTION_NAME"
echo ""

# ===========================================
# STEP 4: Set Up VPC Network
# ===========================================
echo "🌐 Step 4: Setting up VPC Network..."

# Create VPC Connector
gcloud compute networks vpc-access connectors create $VPC_CONNECTOR_NAME \
  --region=$REGION \
  --subnet-range=10.8.0.0/28 \
  --network=default \
  --min-instances=2 \
  --max-instances=10 \
  --project=$PROJECT_ID

echo "✅ VPC Connector created"
echo ""

# ===========================================
# STEP 5: Configure Fixed IP with Cloud NAT
# ===========================================
echo "🔒 Step 5: Configuring Fixed IP..."

# Reserve static IP
gcloud compute addresses create $NAT_IP_NAME \
  --region=$REGION \
  --project=$PROJECT_ID

# Get the reserved IP
export STATIC_IP=$(gcloud compute addresses describe $NAT_IP_NAME \
  --region=$REGION \
  --format="value(address)" \
  --project=$PROJECT_ID)

echo "   Reserved IP: $STATIC_IP"

# Create Cloud Router
gcloud compute routers create $CLOUD_ROUTER_NAME \
  --network=default \
  --region=$REGION \
  --project=$PROJECT_ID

# Create Cloud NAT
gcloud compute routers nats create $NAT_GATEWAY_NAME \
  --router=$CLOUD_ROUTER_NAME \
  --region=$REGION \
  --nat-external-ip-pool=$NAT_IP_NAME \
  --nat-all-subnet-ip-ranges \
  --project=$PROJECT_ID

echo "✅ Fixed IP configured: $STATIC_IP"
echo ""

# ===========================================
# STEP 6: Get Firebase Admin Credentials
# ===========================================
echo "🔥 Step 6: Setting up Firebase..."
echo ""
echo "⚠️  MANUAL STEP REQUIRED:"
echo "1. Go to: https://console.firebase.google.com"
echo "2. Add Firebase to project: $PROJECT_ID"
echo "3. Go to Project Settings → Service Accounts"
echo "4. Click 'Generate new private key'"
echo "5. Save the JSON file as 'firebase-admin-key.json' in this directory"
echo ""
echo "Press Enter when you've completed this step..."
read

# Extract credentials from the service account key
if [ -f "firebase-admin-key.json" ]; then
  export FIREBASE_ADMIN_CLIENT_EMAIL=$(cat firebase-admin-key.json | jq -r '.client_email')
  export FIREBASE_ADMIN_PRIVATE_KEY=$(cat firebase-admin-key.json | jq -r '.private_key')
  echo "✅ Firebase credentials extracted"
else
  echo "❌ Error: firebase-admin-key.json not found"
  exit 1
fi
echo ""

# ===========================================
# STEP 7: Create Secret Manager Secrets
# ===========================================
echo "🔐 Step 7: Creating secrets in Secret Manager..."

# Create secrets
echo -n "$FIREBASE_ADMIN_CLIENT_EMAIL" | \
  gcloud secrets create firebase-admin-client-email \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID

echo -n "$FIREBASE_ADMIN_PRIVATE_KEY" | \
  gcloud secrets create firebase-admin-private-key \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID

echo -n "$DATABASE_PASSWORD" | \
  gcloud secrets create db-password \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID

echo -n "$TRANSACTION_HUB_API_KEY" | \
  gcloud secrets create transaction-hub-api-key \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID

echo -n "$GOOGLE_GENKIT_API_KEY" | \
  gcloud secrets create google-genkit-api-key \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID

echo -n "$API_REGISTER_PASSWORD" | \
  gcloud secrets create api-register-password \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID

echo -n "$JWT_SECRET" | \
  gcloud secrets create jwt-secret \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID

echo "✅ All secrets created"
echo ""

# ===========================================
# STEP 8: Grant Secret Access to Service Accounts
# ===========================================
echo "🔑 Step 8: Granting secret access..."

# Get project number
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant access to Cloud Build service accounts
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None

echo "✅ Service accounts granted secret access"
echo ""

# ===========================================
# STEP 9: Get Firebase Config
# ===========================================
echo "🔥 Step 9: Getting Firebase Configuration..."
echo ""
echo "⚠️  MANUAL STEP REQUIRED:"
echo "1. Go to: https://console.firebase.google.com/project/$PROJECT_ID/settings/general"
echo "2. Under 'Your apps', add a Web app"
echo "3. Copy the firebaseConfig object"
echo "4. Paste it into: firebase-config.json"
echo ""
echo "Press Enter when you've completed this step..."
read

if [ -f "firebase-config.json" ]; then
  export FIREBASE_API_KEY=$(cat firebase-config.json | jq -r '.apiKey')
  export FIREBASE_AUTH_DOMAIN=$(cat firebase-config.json | jq -r '.authDomain')
  export FIREBASE_PROJECT_ID=$(cat firebase-config.json | jq -r '.projectId')
  export FIREBASE_STORAGE_BUCKET=$(cat firebase-config.json | jq -r '.storageBucket')
  export FIREBASE_MESSAGING_SENDER_ID=$(cat firebase-config.json | jq -r '.messagingSenderId')
  export FIREBASE_APP_ID=$(cat firebase-config.json | jq -r '.appId')
  export FIREBASE_MEASUREMENT_ID=$(cat firebase-config.json | jq -r '.measurementId')
  echo "✅ Firebase config extracted"
else
  echo "❌ Error: firebase-config.json not found"
  exit 1
fi
echo ""

# ===========================================
# STEP 10: Generate apphosting.staging.yaml
# ===========================================
echo "📝 Step 10: Generating apphosting.staging.yaml..."

cat > apphosting.staging.yaml <<EOF
# apphosting.staging.yaml
# Generated on $(date)
runConfig:
  minInstances: 0
  maxInstances: 10
  concurrency: 100
  cpu: 1
  memoryMiB: 4096
  # VPC configuration for fixed IP
  vpcAccess:
    egress: ALL_TRAFFIC
    networkInterfaces:
      - network: projects/$PROJECT_ID/global/networks/default
        subnetwork: projects/$PROJECT_ID/regions/$REGION/subnetworks/default

env:
  # Firebase Client SDK (Public)
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: $FIREBASE_API_KEY
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: $FIREBASE_AUTH_DOMAIN
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: $FIREBASE_PROJECT_ID
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    value: $FIREBASE_STORAGE_BUCKET
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    value: "$FIREBASE_MESSAGING_SENDER_ID"
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_APP_ID
    value: $FIREBASE_APP_ID
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    value: $FIREBASE_MEASUREMENT_ID
    availability: [BUILD, RUNTIME]

  # Firebase Admin SDK (Secrets)
  - variable: FIREBASE_ADMIN_PROJECT_ID
    value: $PROJECT_ID
    availability: [BUILD, RUNTIME]

  - variable: FIREBASE_ADMIN_CLIENT_EMAIL
    secret: firebase-admin-client-email
    availability: [BUILD, RUNTIME]

  - variable: FIREBASE_ADMIN_PRIVATE_KEY
    secret: firebase-admin-private-key
    availability: [BUILD, RUNTIME]

  # MySQL Configuration
  - variable: DB_HOST
    value: /cloudsql/$CLOUD_SQL_CONNECTION_NAME
    availability: [RUNTIME]

  - variable: DB_USER
    value: $DATABASE_USER
    availability: [RUNTIME]

  - variable: DB_PASSWORD
    secret: db-password
    availability: [RUNTIME]

  - variable: DB_NAME
    value: $DATABASE_NAME
    availability: [RUNTIME]

  - variable: DB_PORT
    value: "3306"
    availability: [RUNTIME]

  # API Keys
  - variable: TRANSACTION_HUB_API_KEY
    secret: transaction-hub-api-key
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_TRANSACTION_HUB_API_KEY
    secret: transaction-hub-api-key
    availability: [BUILD, RUNTIME]

  - variable: GOOGLE_GENKIT_API_KEY
    secret: google-genkit-api-key
    availability: [BUILD, RUNTIME]

  # Security
  - variable: API_REGISTER_PASSWORD
    secret: api-register-password
    availability: [RUNTIME]

  - variable: JWT_SECRET
    secret: jwt-secret
    availability: [RUNTIME]

  # Other
  - variable: NODE_ENV
    value: production
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_RESERVATION_SITE_URL
    value: https://stg.nukipedia.jp
    availability: [BUILD, RUNTIME]

# Cloud SQL Connection
cloudSqlInstances:
  - connectionName: $CLOUD_SQL_CONNECTION_NAME
EOF

echo "✅ apphosting.staging.yaml created"
echo ""

# ===========================================
# STEP 11: Setup Firebase App Hosting
# ===========================================
echo "🚀 Step 11: Setting up Firebase App Hosting..."
echo ""
echo "⚠️  MANUAL STEP REQUIRED:"
echo "1. Go to: https://console.firebase.google.com/project/$PROJECT_ID/apphosting"
echo "2. Click 'Get started' and connect to GitHub"
echo "3. Select repository: $GITHUB_REPO_OWNER/$GITHUB_REPO_NAME"
echo "4. Create backend with:"
echo "   - Backend ID: $BACKEND_ID"
echo "   - Branch: $GIT_BRANCH"
echo "   - Root directory: /"
echo ""
echo "Press Enter when you've completed this step..."
read

# Grant secret access to the App Hosting backend
echo "🔑 Granting secret access to App Hosting backend..."

firebase apphosting:secrets:grantaccess firebase-admin-client-email --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess firebase-admin-private-key --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess db-password --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess transaction-hub-api-key --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess google-genkit-api-key --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess api-register-password --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess jwt-secret --backend $BACKEND_ID --project $PROJECT_ID

echo "✅ Secret access granted"
echo ""

# ===========================================
# SETUP COMPLETE
# ===========================================
echo "=========================================="
echo "🎉 Setup Complete!"
echo "=========================================="
echo ""
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Fixed IP: $STATIC_IP"
echo "Cloud SQL: $CLOUD_SQL_CONNECTION_NAME"
echo ""
echo "Next steps:"
echo "1. Copy apphosting.staging.yaml to your repository"
echo "2. Commit and push to the $GIT_BRANCH branch:"
echo "   git checkout $GIT_BRANCH"
echo "   git add apphosting.staging.yaml"
echo "   git commit -m 'feat: add App Hosting configuration'"
echo "   git push origin $GIT_BRANCH"
echo "3. Firebase App Hosting will automatically build and deploy"
echo ""
echo "📊 Monitor deployment:"
echo "   https://console.firebase.google.com/project/$PROJECT_ID/apphosting"
echo ""
echo "🔐 Credentials saved in: .env.setup"
echo "=========================================="
```

---

## Secret Creation Script

**If you only need to create/update secrets:**

```bash
#!/bin/bash

# Load configuration
source .env.setup

# Function to create or update a secret
create_or_update_secret() {
  local SECRET_NAME=$1
  local SECRET_VALUE=$2

  # Check if secret exists
  if gcloud secrets describe $SECRET_NAME --project=$PROJECT_ID &>/dev/null; then
    echo "Updating secret: $SECRET_NAME"
    echo -n "$SECRET_VALUE" | gcloud secrets versions add $SECRET_NAME \
      --data-file=- \
      --project=$PROJECT_ID
  else
    echo "Creating secret: $SECRET_NAME"
    echo -n "$SECRET_VALUE" | gcloud secrets create $SECRET_NAME \
      --data-file=- \
      --replication-policy=automatic \
      --project=$PROJECT_ID
  fi
}

# Create/update all secrets
create_or_update_secret "firebase-admin-client-email" "$FIREBASE_ADMIN_CLIENT_EMAIL"
create_or_update_secret "firebase-admin-private-key" "$FIREBASE_ADMIN_PRIVATE_KEY"
create_or_update_secret "db-password" "$DATABASE_PASSWORD"
create_or_update_secret "transaction-hub-api-key" "$TRANSACTION_HUB_API_KEY"
create_or_update_secret "google-genkit-api-key" "$GOOGLE_GENKIT_API_KEY"
create_or_update_secret "api-register-password" "$API_REGISTER_PASSWORD"
create_or_update_secret "jwt-secret" "$JWT_SECRET"

echo "✅ All secrets created/updated"
```

---

## Verification Script

**Run this to verify your setup:**

```bash
#!/bin/bash

source .env.setup

echo "=========================================="
echo "Infrastructure Verification"
echo "=========================================="
echo ""

# Check project
echo "📦 Project:"
gcloud projects describe $PROJECT_ID --format="value(name,projectId,projectNumber)"
echo ""

# Check Cloud SQL
echo "🗄️  Cloud SQL:"
gcloud sql instances list --project=$PROJECT_ID
echo ""

# Check VPC Connector
echo "🌐 VPC Connector:"
gcloud compute networks vpc-access connectors list --region=$REGION --project=$PROJECT_ID
echo ""

# Check Static IP
echo "🔒 Static IP:"
gcloud compute addresses list --filter="name=$NAT_IP_NAME" --project=$PROJECT_ID
echo ""

# Check Cloud NAT
echo "🌍 Cloud NAT:"
gcloud compute routers nats list --router=$CLOUD_ROUTER_NAME --region=$REGION --project=$PROJECT_ID
echo ""

# Check Secrets
echo "🔐 Secrets:"
gcloud secrets list --project=$PROJECT_ID
echo ""

# Check Cloud Run services
echo "🚀 Cloud Run Services:"
gcloud run services list --platform=managed --region=$REGION --project=$PROJECT_ID
echo ""

echo "=========================================="
echo "✅ Verification Complete"
echo "=========================================="
```

---

## Cleanup Script

**⚠️ WARNING: This will delete ALL resources. Use with caution!**

```bash
#!/bin/bash

source .env.setup

echo "=========================================="
echo "⚠️  WARNING: Resource Cleanup"
echo "=========================================="
echo "This will delete:"
echo "- Project: $PROJECT_ID"
echo "- All Cloud SQL databases"
echo "- All VPC resources"
echo "- All secrets"
echo "- All Cloud Run services"
echo ""
echo "Type 'DELETE' to confirm:"
read CONFIRM

if [ "$CONFIRM" != "DELETE" ]; then
  echo "Aborted."
  exit 1
fi

echo "Deleting resources..."

# Delete Cloud Run services
gcloud run services list --platform=managed --region=$REGION --project=$PROJECT_ID --format="value(name)" | \
  xargs -I {} gcloud run services delete {} --platform=managed --region=$REGION --project=$PROJECT_ID --quiet

# Delete Cloud NAT
gcloud compute routers nats delete $NAT_GATEWAY_NAME \
  --router=$CLOUD_ROUTER_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet

# Delete Cloud Router
gcloud compute routers delete $CLOUD_ROUTER_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet

# Delete Static IP
gcloud compute addresses delete $NAT_IP_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet

# Delete VPC Connector
gcloud compute networks vpc-access connectors delete $VPC_CONNECTOR_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet

# Delete Cloud SQL Instance
gcloud sql instances delete $CLOUD_SQL_INSTANCE \
  --project=$PROJECT_ID \
  --quiet

# Delete Secrets
gcloud secrets delete firebase-admin-client-email --project=$PROJECT_ID --quiet
gcloud secrets delete firebase-admin-private-key --project=$PROJECT_ID --quiet
gcloud secrets delete db-password --project=$PROJECT_ID --quiet
gcloud secrets delete transaction-hub-api-key --project=$PROJECT_ID --quiet
gcloud secrets delete google-genkit-api-key --project=$PROJECT_ID --quiet
gcloud secrets delete api-register-password --project=$PROJECT_ID --quiet
gcloud secrets delete jwt-secret --project=$PROJECT_ID --quiet

echo "✅ All resources deleted"
echo ""
echo "To delete the entire project:"
echo "gcloud projects delete $PROJECT_ID"
```

---

## Common Operations

### View Logs

```bash
# Cloud Run logs
gcloud run services logs read --platform=managed --region=$REGION --limit=50

# Cloud SQL logs
gcloud logging read "resource.type=cloudsql_database" --limit=50

# Build logs
gcloud builds list --limit=10
gcloud builds log BUILD_ID
```

### Update Secrets

```bash
# Update a secret value
echo -n "new-secret-value" | gcloud secrets versions add SECRET_NAME --data-file=-

# List secret versions
gcloud secrets versions list SECRET_NAME

# Access a secret (for debugging)
gcloud secrets versions access latest --secret=SECRET_NAME
```

### Database Operations

```bash
# Connect to Cloud SQL via Cloud Shell
gcloud sql connect $CLOUD_SQL_INSTANCE --user=root

# Or via local MySQL client
gcloud sql connect $CLOUD_SQL_INSTANCE --user=$DATABASE_USER

# Create backup
gcloud sql backups create --instance=$CLOUD_SQL_INSTANCE

# List backups
gcloud sql backups list --instance=$CLOUD_SQL_INSTANCE
```

---

**Last Updated:** 2025-10-20
