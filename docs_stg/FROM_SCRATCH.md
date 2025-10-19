# Nukune App Hosting Setup Guide - From Scratch

This guide will help you set up the Nukune dating/matching application on Firebase App Hosting from scratch, starting with a new GCP project.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Region Selection](#region-selection)
4. [Step-by-Step Setup](#step-by-step-setup)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)

---

## Overview

**What you'll build:**
- New GCP Project with Firebase
- Firebase App Hosting (Cloud Run based)
- Cloud SQL (MySQL) for database
- VPC network with fixed IP (Cloud NAT)
- Automatic deployment from Git

**Architecture:**
```
GitHub (staging branch)
    ↓
Firebase App Hosting (Build)
    ↓
Cloud Run (asia-east1 or us-central1)
    ↓
VPC Network → Cloud NAT → Fixed IP
    ↓
Cloud SQL MySQL (same region)
```

**Estimated Time:** 2-3 hours

**Estimated Cost:** $50-90/month (staging with minInstances=0)

---

## Prerequisites

### Required Accounts
- [ ] Google Account with billing enabled
- [ ] GitHub account with repository access
- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] gcloud CLI installed ([Install Guide](https://cloud.google.com/sdk/docs/install))

### Required API Keys
- [ ] Google Genkit API Key (for AI features)
- [ ] Transaction Hub API Key (for payment processing)

### Local Tools
```bash
# Check if tools are installed
node --version  # v18.0.0 or higher
npm --version
firebase --version
gcloud --version
git --version
```

---

## Region Selection

Firebase App Hosting supports the following regions (as of October 2025):

### Recommended Regions for This Project:

| Region | Location | Latency to Japan | Best For |
|--------|----------|------------------|----------|
| **asia-east1** | Taiwan | ~50ms | **Asia users (Recommended)** |
| us-central1 | Iowa, USA | ~150ms | US users |
| asia-southeast1 | Singapore | ~70ms | Southeast Asia |
| europe-west4 | Netherlands | ~200ms | Europe users |

**Important:**
- `asia-northeast1` (Tokyo) is **NOT supported** by Firebase App Hosting
- All resources (Cloud Run, Cloud SQL, VPC) must be in the **same region**
- Once deployed, changing regions requires rebuilding everything

**For this guide, we'll use `asia-east1` (Taiwan) as the default** for optimal performance in Asia.

---

## Step-by-Step Setup

### Step 1: Create New GCP Project

#### 1.1 Create Project via Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "Select a project" → "New Project"
3. Enter details:
   - **Project name:** `nukune-staging` (or your choice)
   - **Project ID:** Will be auto-generated (e.g., `nukune-staging-123456`)
   - **Billing account:** Select your billing account
4. Click "CREATE"
5. **Save your Project ID** - you'll need it throughout this guide

#### 1.2 Enable Billing

1. Go to [Billing](https://console.cloud.google.com/billing)
2. Link the project to your billing account
3. Verify billing is enabled

---

### Step 2: Initialize Firebase Project

#### 2.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Select your existing GCP project (`nukune-staging`)
4. Enable Google Analytics (optional but recommended)
5. Click "Continue"

#### 2.2 Enable Firebase Services

**Authentication:**
1. Firebase Console → Authentication → "Get started"
2. Sign-in method → Enable "Email/Password"
3. Click "Save"

**Firestore:**
1. Firebase Console → Firestore Database → "Create database"
2. Start in **production mode**
3. Location: **asia-east1** (or your chosen region)
4. Click "Enable"

**Storage:**
1. Firebase Console → Storage → "Get started"
2. Start in **production mode** (rules will be configured later)
3. Location: **asia-east1** (same as Firestore)
4. Click "Done"

#### 2.3 Register Web App

1. Firebase Console → Project settings → Your apps
2. Click the web icon (`</>`)
3. App nickname: `Nukune Staging`
4. Don't check "Firebase Hosting"
5. Click "Register app"
6. **Copy the Firebase config** - you'll need these values:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:...",
     measurementId: "G-..."
   };
   ```

---

### Step 3: Create Cloud SQL Instance

#### 3.1 Enable Cloud SQL API

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable sqladmin.googleapis.com
gcloud services enable servicenetworking.googleapis.com
```

#### 3.2 Create MySQL Instance

**Via Console:**
1. GCP Console → SQL → "Create Instance"
2. Choose "MySQL"
3. Instance ID: `nukune-mysql`
4. Password: Generate a strong password (save it!)
5. Version: MySQL 8.0
6. Region: **asia-east1** (or your chosen region)
7. Zone: Single zone (for staging)
8. Machine type: `db-n1-standard-2` (or smaller for staging)
9. Storage: 10 GB SSD, enable auto-resize
10. Click "CREATE INSTANCE"

**Wait 5-10 minutes** for the instance to be created.

#### 3.3 Create Database and User

```bash
# Set your instance name
INSTANCE_NAME=nukune-mysql
PROJECT_ID=YOUR_PROJECT_ID

# Create database
gcloud sql databases create nukune_db \
  --instance=$INSTANCE_NAME

# Create user
gcloud sql users create nukune_app \
  --instance=$INSTANCE_NAME \
  --password=YOUR_SECURE_PASSWORD

# Note the connection name (you'll need this later)
gcloud sql instances describe $INSTANCE_NAME \
  --format="value(connectionName)"
# Output: your-project-id:asia-east1:nukune-mysql
```

---

### Step 4: Set Up VPC and Fixed IP

#### 4.1 Create VPC Connector

```bash
# Replace REGION with your chosen region (asia-east1 or us-central1)
REGION=asia-east1
PROJECT_ID=YOUR_PROJECT_ID

gcloud compute networks vpc-access connectors create nukune-connector \
  --region=$REGION \
  --subnet-range=10.8.0.0/28 \
  --network=default \
  --min-instances=2 \
  --max-instances=10 \
  --project=$PROJECT_ID
```

#### 4.2 Reserve Static IP

```bash
gcloud compute addresses create nukune-nat-ip \
  --region=$REGION \
  --project=$PROJECT_ID

# Get the reserved IP (save this!)
gcloud compute addresses describe nukune-nat-ip \
  --region=$REGION \
  --format="value(address)"
```

#### 4.3 Create Cloud Router

```bash
gcloud compute routers create nukune-router \
  --network=default \
  --region=$REGION \
  --project=$PROJECT_ID
```

#### 4.4 Create Cloud NAT

```bash
gcloud compute routers nats create nukune-nat \
  --router=nukune-router \
  --region=$REGION \
  --nat-external-ip-pool=nukune-nat-ip \
  --nat-all-subnet-ip-ranges \
  --project=$PROJECT_ID
```

---

### Step 5: Configure Secret Manager

#### 5.1 Enable Secret Manager API

```bash
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID
```

#### 5.2 Create Secrets

You'll need to create the following secrets. See `CLI_ALL_IN_ONE.md` for the complete script.

**Required Secrets:**
1. `firebase-admin-client-email` - From Firebase service account
2. `firebase-admin-private-key` - From Firebase service account
3. `db-password` - MySQL password
4. `transaction-hub-api-key` - Payment API key
5. `google-genkit-api-key` - AI API key
6. `api-register-password` - Registration API password
7. `jwt-secret` - JWT signing secret

**Get Firebase Admin credentials:**
1. Firebase Console → Project settings → Service accounts
2. Click "Generate new private key"
3. Save the JSON file
4. Extract `client_email` and `private_key` from the JSON

---

### Step 6: Configure App Hosting

#### 6.1 Connect GitHub Repository

1. Firebase Console → App Hosting → "Get started"
2. "Connect to GitHub"
3. Authorize Firebase
4. Select your repository
5. Grant access

#### 6.2 Create Backend

1. Click "Create backend"
2. Settings:
   - **Backend ID:** `nukune-staging` (or your choice)
   - **Branch:** `staging`
   - **Root directory:** `/`
3. Click "Next"

#### 6.3 Create apphosting.staging.yaml

Create `apphosting.staging.yaml` in your repository root:

```yaml
# apphosting.staging.yaml
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
      - network: projects/YOUR_PROJECT_ID/global/networks/default
        subnetwork: projects/YOUR_PROJECT_ID/regions/asia-east1/subnetworks/default

env:
  # Firebase Client SDK (Public)
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: YOUR_API_KEY
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: YOUR_PROJECT.firebaseapp.com
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: YOUR_PROJECT_ID
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    value: YOUR_PROJECT.appspot.com
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    value: "YOUR_SENDER_ID"
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_APP_ID
    value: YOUR_APP_ID
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    value: YOUR_MEASUREMENT_ID
    availability: [BUILD, RUNTIME]

  # Firebase Admin SDK (Secrets)
  - variable: FIREBASE_ADMIN_PROJECT_ID
    value: YOUR_PROJECT_ID
    availability: [BUILD, RUNTIME]

  - variable: FIREBASE_ADMIN_CLIENT_EMAIL
    secret: firebase-admin-client-email
    availability: [BUILD, RUNTIME]

  - variable: FIREBASE_ADMIN_PRIVATE_KEY
    secret: firebase-admin-private-key
    availability: [BUILD, RUNTIME]

  # MySQL Configuration
  - variable: DB_HOST
    value: /cloudsql/YOUR_PROJECT_ID:asia-east1:nukune-mysql
    availability: [RUNTIME]

  - variable: DB_USER
    value: nukune_app
    availability: [RUNTIME]

  - variable: DB_PASSWORD
    secret: db-password
    availability: [RUNTIME]

  - variable: DB_NAME
    value: nukune_db
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

# Cloud SQL Connection
cloudSqlInstances:
  - connectionName: YOUR_PROJECT_ID:asia-east1:nukune-mysql
```

#### 6.4 Grant Secret Access

```bash
# Get your backend ID
BACKEND_ID=nukune-staging  # Or whatever you named it

# Grant access to all secrets
firebase apphosting:secrets:grantaccess firebase-admin-client-email --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess firebase-admin-private-key --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess db-password --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess transaction-hub-api-key --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess google-genkit-api-key --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess api-register-password --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess jwt-secret --backend $BACKEND_ID --project $PROJECT_ID
```

#### 6.5 Deploy

```bash
# Commit and push
git checkout staging
git add apphosting.staging.yaml
git commit -m "feat: add App Hosting configuration"
git push origin staging
```

Firebase App Hosting will automatically detect the push and start building.

---

## Verification

### Check Build Status

1. Firebase Console → App Hosting → Rollouts
2. Watch the build progress
3. Build should complete in 10-15 minutes

### Verify Deployment

```bash
# Check Cloud Run service
gcloud run services list --platform managed --region=$REGION

# Check logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50 --format=json
```

### Test Fixed IP

```bash
# The outbound IP should match your reserved NAT IP
gcloud compute addresses list --filter="name=nukune-nat-ip"
```

---

## Troubleshooting

### Build Fails with "Permission Denied" on Secrets

**Cause:** Service accounts don't have Secret Manager access

**Solution:**
```bash
# Grant project-level access to Cloud Build service account
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None

# Also grant to the service agent
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:service-YOUR_PROJECT_NUMBER@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None
```

### Cloud Run Fails with Region Mismatch

**Cause:** VPC subnet region doesn't match deployment region

**Solution:** Ensure all resources are in the same region:
- Cloud Run deployment region (determined by App Hosting backend location)
- VPC subnet region
- Cloud SQL region

### Database Connection Fails

**Cause:** Cloud SQL instance not accessible or wrong connection string

**Solution:**
```bash
# Verify Cloud SQL instance is running
gcloud sql instances list

# Check connection name format
# Should be: PROJECT_ID:REGION:INSTANCE_NAME
gcloud sql instances describe nukune-mysql --format="value(connectionName)"
```

---

## Next Steps

1. Configure Firebase Security Rules (Firestore, Storage)
2. Set up monitoring and alerts
3. Configure custom domain (optional)
4. Set up automated backups
5. Test your application functionality

---

## Related Documentation

- [FROM_SCRATCH_CLI.md](./FROM_SCRATCH_CLI.md) - Complete CLI setup script
- [SECRET_MANAGER_SETUP.md](./SECRET_MANAGER_SETUP.md) - Detailed secret setup
- [INFRASTRUCTURE_OVERVIEW.md](./INFRASTRUCTURE_OVERVIEW.md) - Architecture details
- [TEARDOWN.md](./TEARDOWN.md) - How to delete everything and stop costs

---

## Cost Optimization

For staging environments:

```yaml
# In apphosting.staging.yaml
runConfig:
  minInstances: 0      # Scale to zero when not in use
  maxInstances: 5      # Limit max scale
  cpu: 1               # Lower CPU
  memoryMiB: 2048      # Lower memory
```

**Cloud SQL:**
- Use smaller machine type (`db-f1-micro` or `db-g1-small`)
- Schedule automatic shutdown during off-hours
- Disable automated backups (use manual backups instead)

**Estimated monthly cost with optimizations:** $20-40

---

**Last Updated:** 2025-10-20
