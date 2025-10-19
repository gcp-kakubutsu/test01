# Infrastructure Teardown Guide

This guide provides instructions for safely tearing down your Nukune staging environment to avoid ongoing costs.

## ⚠️ WARNING

**This process is IRREVERSIBLE.** Once you delete resources, all data will be permanently lost.

**Before proceeding:**
- [ ] Export any data you need to keep
- [ ] Create backups of your databases
- [ ] Download any important files from Storage
- [ ] Verify you're deleting the correct project
- [ ] Inform your team about the teardown

---

## Table of Contents

1. [Quick Teardown (Delete Entire Project)](#quick-teardown-delete-entire-project)
2. [Selective Teardown (Keep Project)](#selective-teardown-keep-project)
3. [Teardown Order (Manual)](#teardown-order-manual)
4. [Automated Teardown Scripts](#automated-teardown-scripts)
5. [Verification](#verification)
6. [Cost After Teardown](#cost-after-teardown)

---

## Quick Teardown (Delete Entire Project)

**Fastest method**: Delete the entire GCP project. This removes everything.

### Via Console

1. Go to [GCP Console](https://console.cloud.google.com)
2. Select your project (e.g., `nukune-staging`)
3. Go to IAM & Admin → Settings
4. Click "SHUT DOWN" at the top
5. Type the Project ID to confirm
6. Click "SHUT DOWN" again

**Timeline:**
- Scheduled for deletion immediately
- Actually deleted after 30 days (recoverable during this period)
- Billing stops immediately

### Via CLI

```bash
# Set the project to delete
PROJECT_ID="your-project-id"

# Verify you have the correct project
gcloud config get-value project
echo "About to delete project: $PROJECT_ID"
echo "Type 'DELETE' to confirm:"
read CONFIRM

if [ "$CONFIRM" = "DELETE" ]; then
  gcloud projects delete $PROJECT_ID
  echo "✅ Project scheduled for deletion"
else
  echo "❌ Aborted"
fi
```

---

## Selective Teardown (Keep Project)

If you want to keep the GCP project but remove expensive resources:

### Option 1: Stop Expensive Services Only

```bash
PROJECT_ID="your-project-id"
REGION="asia-east1"  # or us-central1

# Stop Cloud SQL (biggest cost saver)
CLOUD_SQL_INSTANCE="nukune-mysql"
gcloud sql instances patch $CLOUD_SQL_INSTANCE \
  --activation-policy=NEVER \
  --project=$PROJECT_ID

# Scale Cloud Run to zero
gcloud run services update SERVICE_NAME \
  --min-instances=0 \
  --max-instances=0 \
  --region=$REGION \
  --project=$PROJECT_ID
```

**Estimated cost after stopping:** $5-10/month (storage only)

### Option 2: Delete All Resources

See [Teardown Order](#teardown-order-manual) or [Automated Scripts](#automated-teardown-scripts)

---

## Teardown Order (Manual)

**Delete resources in this order to avoid dependency errors:**

### 1. Stop Auto-Deployment

**Disconnect GitHub to prevent accidental deployments:**

```bash
# Via Firebase Console
# 1. Go to: https://console.firebase.google.com/project/YOUR_PROJECT/apphosting
# 2. Select your backend
# 3. Click "Backend settings" → "Disconnect repository"
```

### 2. Delete Cloud Run Services

```bash
PROJECT_ID="your-project-id"
REGION="asia-east1"

# List all Cloud Run services
gcloud run services list --platform=managed --region=$REGION --project=$PROJECT_ID

# Delete each service
gcloud run services delete SERVICE_NAME \
  --platform=managed \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet
```

### 3. Delete Firebase App Hosting Backend

```bash
BACKEND_ID="nukune-staging"

# Via Firebase Console:
# 1. https://console.firebase.google.com/project/YOUR_PROJECT/apphosting
# 2. Select backend → Settings → Delete backend

# Or via CLI (if available):
# firebase apphosting:backends:delete $BACKEND_ID --project=$PROJECT_ID
```

### 4. Delete Cloud NAT and Networking

```bash
NAT_GATEWAY_NAME="nukune-nat"
CLOUD_ROUTER_NAME="nukune-router"
NAT_IP_NAME="nukune-nat-ip"
VPC_CONNECTOR_NAME="nukune-connector"

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

# Release Static IP
gcloud compute addresses delete $NAT_IP_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet

# Delete VPC Connector
gcloud compute networks vpc-access connectors delete $VPC_CONNECTOR_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet
```

### 5. Delete Cloud SQL Instance

```bash
CLOUD_SQL_INSTANCE="nukune-mysql"

# Create final backup (optional but recommended)
gcloud sql backups create \
  --instance=$CLOUD_SQL_INSTANCE \
  --description="Final backup before deletion" \
  --project=$PROJECT_ID

# Delete Cloud SQL instance
gcloud sql instances delete $CLOUD_SQL_INSTANCE \
  --project=$PROJECT_ID \
  --quiet
```

### 6. Delete Secret Manager Secrets

```bash
# List all secrets
gcloud secrets list --project=$PROJECT_ID

# Delete all secrets
for secret in firebase-admin-client-email firebase-admin-private-key db-password transaction-hub-api-key google-genkit-api-key api-register-password jwt-secret; do
  echo "Deleting secret: $secret"
  gcloud secrets delete $secret --project=$PROJECT_ID --quiet
done
```

### 7. Delete Firebase Data

**Firestore:**

```bash
# Via Firebase Console:
# 1. Go to: https://console.firebase.google.com/project/YOUR_PROJECT/firestore
# 2. Delete collections manually (no bulk delete available)

# Or use Firebase CLI with a script (see automated section below)
```

**Storage:**

```bash
# Via Firebase Console:
# 1. Go to: https://console.firebase.google.com/project/YOUR_PROJECT/storage
# 2. Delete all files/folders

# Or via gsutil:
gsutil -m rm -r gs://YOUR_PROJECT.appspot.com/**
```

**Authentication:**

```bash
# Delete all users via Firebase Console:
# https://console.firebase.google.com/project/YOUR_PROJECT/authentication/users

# Note: There's no bulk delete in console, must delete individually
# For many users, use Firebase Admin SDK script
```

### 8. Delete Build Artifacts

```bash
# Delete Cloud Build history and artifacts
gcloud builds list --project=$PROJECT_ID --limit=100 --format="value(id)" | \
  xargs -I {} gcloud builds cancel {} --project=$PROJECT_ID --quiet

# Delete container images
gcloud container images list --project=$PROJECT_ID
# Manually delete from: https://console.cloud.google.com/gcr
```

---

## Automated Teardown Scripts

### Complete Teardown Script

**Save this as `teardown.sh`:**

```bash
#!/bin/bash
set -e

# ===========================================
# CONFIGURATION
# ===========================================
PROJECT_ID="your-project-id"
REGION="asia-east1"
CLOUD_SQL_INSTANCE="nukune-mysql"
VPC_CONNECTOR_NAME="nukune-connector"
CLOUD_ROUTER_NAME="nukune-router"
NAT_GATEWAY_NAME="nukune-nat"
NAT_IP_NAME="nukune-nat-ip"
BACKEND_ID="nukune-staging"

# ===========================================
# CONFIRMATION
# ===========================================
echo "=========================================="
echo "⚠️  WARNING: INFRASTRUCTURE TEARDOWN"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""
echo "This will DELETE:"
echo "  - All Cloud Run services"
echo "  - Cloud SQL instance: $CLOUD_SQL_INSTANCE"
echo "  - All VPC resources"
echo "  - All Secret Manager secrets"
echo "  - Fixed IP: $NAT_IP_NAME"
echo ""
echo "Type 'DELETE EVERYTHING' to confirm:"
read CONFIRM

if [ "$CONFIRM" != "DELETE EVERYTHING" ]; then
  echo "❌ Aborted"
  exit 1
fi

echo ""
echo "Starting teardown..."
echo ""

# ===========================================
# STEP 1: Cloud Run Services
# ===========================================
echo "🗑️  Step 1: Deleting Cloud Run services..."

gcloud run services list \
  --platform=managed \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(metadata.name)" | \
while read service; do
  echo "  Deleting Cloud Run service: $service"
  gcloud run services delete $service \
    --platform=managed \
    --region=$REGION \
    --project=$PROJECT_ID \
    --quiet
done

echo "✅ Cloud Run services deleted"
echo ""

# ===========================================
# STEP 2: Cloud NAT
# ===========================================
echo "🗑️  Step 2: Deleting Cloud NAT..."

gcloud compute routers nats delete $NAT_GATEWAY_NAME \
  --router=$CLOUD_ROUTER_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet 2>/dev/null || echo "  NAT not found, skipping"

echo "✅ Cloud NAT deleted"
echo ""

# ===========================================
# STEP 3: Cloud Router
# ===========================================
echo "🗑️  Step 3: Deleting Cloud Router..."

gcloud compute routers delete $CLOUD_ROUTER_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet 2>/dev/null || echo "  Router not found, skipping"

echo "✅ Cloud Router deleted"
echo ""

# ===========================================
# STEP 4: Static IP
# ===========================================
echo "🗑️  Step 4: Releasing Static IP..."

gcloud compute addresses delete $NAT_IP_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet 2>/dev/null || echo "  IP not found, skipping"

echo "✅ Static IP released"
echo ""

# ===========================================
# STEP 5: VPC Connector
# ===========================================
echo "🗑️  Step 5: Deleting VPC Connector..."

gcloud compute networks vpc-access connectors delete $VPC_CONNECTOR_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet 2>/dev/null || echo "  VPC Connector not found, skipping"

echo "✅ VPC Connector deleted"
echo ""

# ===========================================
# STEP 6: Cloud SQL (with backup)
# ===========================================
echo "🗑️  Step 6: Deleting Cloud SQL..."

echo "  Creating final backup..."
gcloud sql backups create \
  --instance=$CLOUD_SQL_INSTANCE \
  --description="Final backup before deletion $(date +%Y-%m-%d)" \
  --project=$PROJECT_ID 2>/dev/null || echo "  Backup failed, continuing..."

echo "  Deleting Cloud SQL instance..."
gcloud sql instances delete $CLOUD_SQL_INSTANCE \
  --project=$PROJECT_ID \
  --quiet 2>/dev/null || echo "  SQL instance not found, skipping"

echo "✅ Cloud SQL deleted"
echo ""

# ===========================================
# STEP 7: Secret Manager
# ===========================================
echo "🗑️  Step 7: Deleting Secret Manager secrets..."

SECRETS="firebase-admin-client-email firebase-admin-private-key db-password transaction-hub-api-key google-genkit-api-key api-register-password jwt-secret"

for secret in $SECRETS; do
  echo "  Deleting secret: $secret"
  gcloud secrets delete $secret \
    --project=$PROJECT_ID \
    --quiet 2>/dev/null || echo "  Secret not found, skipping"
done

echo "✅ Secrets deleted"
echo ""

# ===========================================
# STEP 8: Storage Buckets (optional)
# ===========================================
echo "🗑️  Step 8: Cleaning up storage buckets..."

# List storage buckets
echo "  Storage buckets in project:"
gsutil ls -p $PROJECT_ID

echo ""
echo "  ⚠️  Manual action required:"
echo "  Delete storage buckets manually if needed:"
echo "  https://console.cloud.google.com/storage/browser?project=$PROJECT_ID"
echo ""

# ===========================================
# TEARDOWN COMPLETE
# ===========================================
echo "=========================================="
echo "✅ Teardown Complete!"
echo "=========================================="
echo ""
echo "Remaining cleanup (manual):"
echo "  1. Delete Firebase App Hosting backend in console"
echo "  2. Delete Firestore collections in console"
echo "  3. Delete Storage buckets/files in console"
echo "  4. Delete Auth users in console"
echo "  5. (Optional) Delete the entire project"
echo ""
echo "Firebase Console: https://console.firebase.google.com/project/$PROJECT_ID"
echo "GCP Console: https://console.cloud.google.com/home/dashboard?project=$PROJECT_ID"
echo ""
echo "To delete the entire project:"
echo "  gcloud projects delete $PROJECT_ID"
echo "=========================================="
```

### Make it Executable

```bash
chmod +x teardown.sh
./teardown.sh
```

---

## Verification

### Verify Resources Are Deleted

```bash
PROJECT_ID="your-project-id"
REGION="asia-east1"

# Check Cloud Run
gcloud run services list --platform=managed --region=$REGION --project=$PROJECT_ID
# Expected: Empty list

# Check Cloud SQL
gcloud sql instances list --project=$PROJECT_ID
# Expected: Empty list

# Check VPC Connectors
gcloud compute networks vpc-access connectors list --region=$REGION --project=$PROJECT_ID
# Expected: Empty list

# Check Static IPs
gcloud compute addresses list --project=$PROJECT_ID
# Expected: Empty list

# Check Secrets
gcloud secrets list --project=$PROJECT_ID
# Expected: Empty list

# Check Cloud Routers
gcloud compute routers list --project=$PROJECT_ID
# Expected: Empty list
```

### Verify Billing

1. Go to [Billing Console](https://console.cloud.google.com/billing)
2. Select your billing account
3. View "Reports" for the project
4. Verify charges drop to $0 (or near $0)

**Note:** Some charges may take 24-48 hours to reflect in billing reports.

---

## Cost After Teardown

### Complete Teardown (All Resources Deleted)

**Expected cost:** $0-2/month

Remaining charges:
- Cloud Build history storage: ~$0.50/month
- Container Registry images: ~$0.50/month
- Firestore/Storage if not deleted: varies

### Partial Teardown (Project Kept, Major Services Stopped)

**Expected cost:** $5-10/month

Remaining charges:
- Storage (Firestore, Cloud Storage, backups): $2-5/month
- Networking (if VPC not fully deleted): $1-3/month
- Small Cloud SQL backups: $1-2/month
- Logging/Monitoring data: $1-2/month

---

## Recovery Options

### Within 30 Days (Project Deletion)

```bash
# List deleted projects
gcloud projects list --filter="lifecycleState:DELETE_REQUESTED"

# Restore a project
gcloud projects undelete PROJECT_ID
```

### After Resource Deletion

- **Cloud SQL:** Restore from automated backups (7-365 days retention)
- **Firestore:** Restore from exports (if created beforehand)
- **Storage:** No recovery unless versioning was enabled
- **Secrets:** No recovery, must recreate

---

## Preventing Accidental Deletion

### Set Up Deletion Protection

**Cloud SQL:**
```bash
gcloud sql instances patch INSTANCE_NAME \
  --deletion-protection \
  --project=$PROJECT_ID
```

**Project-level:**
```bash
# Add a lien to prevent deletion
gcloud resource-manager liens create \
  --restrictions=resourcemanager.projects.delete \
  --reason="Prevent accidental deletion" \
  --project=$PROJECT_ID
```

### Budget Alerts

Set up billing alerts to notify before costs get too high:

1. [Billing Console](https://console.cloud.google.com/billing) → Budgets & alerts
2. Create budget alert at $50, $100, etc.
3. Get email notifications

---

## Related Documentation

- [FROM_SCRATCH.md](./FROM_SCRATCH.md) - Setup guide (reverse of this doc)
- [FROM_SCRATCH_CLI.md](./FROM_SCRATCH_CLI.md) - Automated setup scripts
- [README.md](./README.md) - Documentation index

---

## Quick Reference

### Stop Services (Pause, Don't Delete)

```bash
# Stop Cloud SQL
gcloud sql instances patch INSTANCE_NAME --activation-policy=NEVER

# Scale Cloud Run to zero
gcloud run services update SERVICE_NAME --max-instances=0

# Disable APIs (stops billing for those services)
gcloud services disable run.googleapis.com sqladmin.googleapis.com
```

### Delete Entire Project

```bash
gcloud projects delete PROJECT_ID
```

### Check What's Running (Audit)

```bash
# All Cloud Run services
gcloud run services list --platform=managed

# All Cloud SQL instances
gcloud sql instances list

# All Compute Engine resources
gcloud compute instances list
gcloud compute addresses list
gcloud compute disks list

# All storage buckets
gsutil ls

# All secrets
gcloud secrets list
```

---

**Last Updated:** 2025-10-20
