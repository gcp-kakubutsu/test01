# Staging Environment Setup Documentation

This directory contains documentation for setting up the Nukune application's staging environment on Firebase App Hosting from scratch.

## 🚀 Quick Start

**New to this project?** Start here:

1. **[FROM_SCRATCH.md](./FROM_SCRATCH.md)** ⭐ - Complete setup guide starting with a new GCP project
2. **[FROM_SCRATCH_CLI.md](./FROM_SCRATCH_CLI.md)** ⭐ - Automated CLI scripts for the entire setup

**Estimated time:** 2-3 hours
**Estimated cost:** $50-90/month (optimized for staging)

---

## 📚 Documentation Index

### Core Documentation (Start Here)

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[FROM_SCRATCH.md](./FROM_SCRATCH.md)** | Step-by-step guide starting with a new GCP project | Setting up a new environment from zero |
| **[FROM_SCRATCH_CLI.md](./FROM_SCRATCH_CLI.md)** | Complete CLI scripts for automated setup | Quick automated setup, account switching |

### Supplementary Documentation

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [SECRET_MANAGER_SETUP.md](./SECRET_MANAGER_SETUP.md) | Detailed Secret Manager configuration | Troubleshooting secret issues |
| [INFRASTRUCTURE_OVERVIEW.md](./INFRASTRUCTURE_OVERVIEW.md) | Architecture and infrastructure details | Understanding the system architecture |
| [BUILD_ERROR_FIX.md](./BUILD_ERROR_FIX.md) | Common build errors and solutions | When builds fail |
| [TEARDOWN.md](./TEARDOWN.md) | Infrastructure teardown and cleanup | Deleting resources to stop costs |

### Legacy Documentation (For Reference Only)

**All legacy documents have been moved to `obsolete/` directory.**

| Document | Status | Notes |
|----------|--------|-------|
| [obsolete/STG_ORDER.md](./obsolete/STG_ORDER.md) | ⚠️ Legacy | Original requirements document |
| [obsolete/STAGING_PREREQUISITES.md](./obsolete/STAGING_PREREQUISITES.md) | ⚠️ Obsolete | Replaced by FROM_SCRATCH.md |
| [obsolete/STAGING_SETUP.md](./obsolete/STAGING_SETUP.md) | ⚠️ Obsolete | Replaced by FROM_SCRATCH.md |
| [obsolete/MYSQL_TESTING_WITHOUT_DATA.md](./obsolete/MYSQL_TESTING_WITHOUT_DATA.md) | ⚠️ Obsolete | Testing guidance included in main docs |

**Note:** Legacy documents contain outdated information (e.g., references to `asia-northeast1` which is not supported by Firebase App Hosting). Use the new documentation instead.

---

## 🌍 Supported Regions

Firebase App Hosting supports the following regions (as of October 2025):

### Recommended for This Project

| Region | Location | Best For | Latency to Japan |
|--------|----------|----------|------------------|
| **asia-east1** ⭐ | Taiwan | Asia/Japan users | ~50ms |
| us-central1 | Iowa, USA | US users | ~150ms |
| asia-southeast1 | Singapore | Southeast Asia | ~70ms |
| europe-west4 | Netherlands | Europe | ~200ms |

**Important:**
- ❌ `asia-northeast1` (Tokyo) is **NOT supported** by Firebase App Hosting
- ✅ All resources must be in the **same region** (Cloud Run, Cloud SQL, VPC)
- ✅ **Use `asia-east1`** for best performance in Asia

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│ GitHub Repository (staging branch)                   │
└────────────────┬────────────────────────────────────┘
                 │ git push
                 ↓
┌─────────────────────────────────────────────────────┐
│ Firebase App Hosting (Build)                         │
│  - Buildpacks auto-detect Next.js                    │
│  - Secret Manager integration                        │
└────────────────┬────────────────────────────────────┘
                 │ deploy
                 ↓
┌─────────────────────────────────────────────────────┐
│ Cloud Run (asia-east1 or us-central1)               │
│  - Next.js 15 App                                    │
│  - Auto-scaling (minInstances=0 for staging)         │
└────┬──────────────────┬─────────────────────────────┘
     │                  │
     │                  ↓
     │            ┌──────────────────────────┐
     │            │ Cloud SQL MySQL           │
     │            │  - User data storage      │
     │            │  - Same region            │
     │            └──────────────────────────┘
     ↓
┌─────────────────────────────────────────────────────┐
│ VPC Network + Cloud NAT                              │
│  - Fixed outbound IP address                         │
│  - Private Cloud SQL connection                      │
└─────────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────────┐
│ Firebase Services                                    │
│  - Authentication (Email/Password)                   │
│  - Firestore (User profiles, messages)               │
│  - Storage (Images)                                  │
└─────────────────────────────────────────────────────┘
```

---

## 📋 Setup Checklist

Use this checklist to track your progress:

### Prerequisites
- [ ] Google Account with billing enabled
- [ ] GitHub repository access
- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] gcloud CLI installed
- [ ] API keys obtained (Genkit, Transaction Hub)

### Infrastructure Setup
- [ ] GCP Project created
- [ ] Firebase Project initialized
- [ ] Cloud SQL instance running
- [ ] Database and user created
- [ ] VPC Connector configured
- [ ] Static IP reserved
- [ ] Cloud NAT configured

### Secret Manager
- [ ] Firebase Admin credentials created
- [ ] All 7 secrets created in Secret Manager
- [ ] Service accounts granted access
- [ ] Secrets tested and verified

### App Hosting
- [ ] GitHub repository connected
- [ ] Backend created and configured
- [ ] `apphosting.staging.yaml` created
- [ ] Secrets granted to backend
- [ ] Initial build succeeded
- [ ] App deployed and accessible

### Verification
- [ ] Fixed IP verified
- [ ] Database connection working
- [ ] Firebase Auth working
- [ ] Git auto-deploy working

---

## 🛠️ Common Operations

### Viewing Logs

```bash
# Cloud Run logs
gcloud run services logs read --platform=managed --region=asia-east1 --limit=50

# Build logs
gcloud builds list --limit=10

# Specific build
gcloud builds log BUILD_ID
```

### Managing Secrets

```bash
# List all secrets
gcloud secrets list

# Update a secret
echo -n "new-value" | gcloud secrets versions add SECRET_NAME --data-file=-

# View secret (for debugging only!)
gcloud secrets versions access latest --secret=SECRET_NAME
```

### Database Operations

```bash
# Connect to Cloud SQL
gcloud sql connect INSTANCE_NAME --user=root

# Create backup
gcloud sql backups create --instance=INSTANCE_NAME
```

### Switching GCP Accounts

```bash
# List accounts
gcloud auth list

# Switch account
gcloud auth login --account=EMAIL@gmail.com

# Set active project
gcloud config set project PROJECT_ID
```

---

## 💰 Cost Optimization

### For Staging Environments

```yaml
# In apphosting.staging.yaml
runConfig:
  minInstances: 0      # Scale to zero when idle
  maxInstances: 5      # Limit scaling
  cpu: 1               # Lower CPU
  memoryMiB: 2048      # Lower memory
```

**Additional Tips:**
- Use smaller Cloud SQL instance (`db-f1-micro` or `db-g1-small`)
- Schedule Cloud SQL shutdown during off-hours
- Disable automated backups (use manual backups)
- Monitor usage in GCP Console → Billing

**Estimated monthly cost with optimizations:** $20-40

---

## 🐛 Troubleshooting

### Build Fails with "Permission Denied" on Secrets

**Solution:** Grant Secret Manager access to Cloud Build service accounts

```bash
PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format="value(projectNumber)")

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None
```

See [BUILD_ERROR_FIX.md](./BUILD_ERROR_FIX.md) for more solutions.

### Cloud Run Fails with Region Mismatch

**Error:** "The target region X must be the same as the region Y where the subnetwork resides"

**Solution:** Ensure all resources are in the **same region**:
- Check your `apphosting.staging.yaml` VPC subnet region
- Verify it matches your App Hosting deployment region
- Update the subnet region if needed

### Database Connection Fails

**Check:**
1. Cloud SQL instance is running: `gcloud sql instances list`
2. Connection name is correct in `apphosting.staging.yaml`
3. Database user and password are correct
4. Cloud SQL connection is configured in App Hosting

---

## 🔗 Useful Links

- [Firebase App Hosting Documentation](https://firebase.google.com/docs/app-hosting)
- [Cloud Run VPC Access](https://cloud.google.com/run/docs/configuring/vpc-direct-vpc)
- [Cloud NAT Documentation](https://cloud.google.com/nat/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Cloud SQL Connection Guide](https://cloud.google.com/sql/docs/mysql/connect-run)

---

## 📞 Getting Help

If you encounter issues:

1. Check the troubleshooting section in the relevant doc
2. Review error messages in Cloud Console
3. Check [BUILD_ERROR_FIX.md](./BUILD_ERROR_FIX.md) for common errors
4. Consult Firebase App Hosting documentation

---

## 📝 Changelog

### 2025-10-20
- ✨ Added FROM_SCRATCH.md - Complete setup guide from new GCP project
- ✨ Added FROM_SCRATCH_CLI.md - Automated setup scripts
- ✨ Added TEARDOWN.md - Infrastructure teardown and cleanup guide
- ⚠️ Deprecated old documentation (STAGING_SETUP.md, STAGING_PREREQUISITES.md)
- ✅ Updated region guidance (removed asia-northeast1, added asia-east1/us-central1)
- 🔧 Added account switching guide
- 📚 Reorganized documentation structure
- 📁 Moved obsolete docs to obsolete/ directory

### 2025-10-18
- Initial staging documentation created
- Legacy docs: STG_ORDER.md, STAGING_SETUP.md, etc.

---

**Ready to get started?** → [FROM_SCRATCH.md](./FROM_SCRATCH.md) 🚀
