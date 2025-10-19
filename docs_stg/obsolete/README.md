# Obsolete Documentation

⚠️ **WARNING: These documents are outdated and should not be used.**

## Why are these documents obsolete?

These documents were created during the initial staging environment setup but contain outdated or incorrect information:

1. **Incorrect Region Information**
   - Documents reference `asia-northeast1` (Tokyo) which is **NOT supported** by Firebase App Hosting
   - Firebase App Hosting only supports: `asia-east1`, `us-central1`, `asia-southeast1`, `europe-west4`, etc.

2. **Incomplete Setup Instructions**
   - Missing critical steps for Secret Manager permissions
   - Outdated VPC configuration guidance
   - Missing service account permission setup

3. **Superseded by Better Documentation**
   - Replaced by comprehensive `FROM_SCRATCH.md` guide
   - Automated setup scripts in `CLI_ALL_IN_ONE.md`

## Use the Current Documentation Instead

✅ **For new setups:** Use [FROM_SCRATCH.md](../FROM_SCRATCH.md)

✅ **For automated setup:** Use [CLI_ALL_IN_ONE.md](../CLI_ALL_IN_ONE.md)

✅ **For navigation:** See [README.md](../README.md)

---

## Contents of This Directory

| File | Original Purpose | Why Obsolete |
|------|-----------------|--------------|
| STG_ORDER.md | Original requirements | Reference only - requirements fulfilled |
| STAGING_PREREQUISITES.md | Prerequisites checklist | Replaced by FROM_SCRATCH.md prerequisites section |
| STAGING_SETUP.md | Main setup guide | Contains incorrect region info, replaced by FROM_SCRATCH.md |
| MYSQL_TESTING_WITHOUT_DATA.md | MySQL testing guide | Testing info integrated into main docs |

---

## Historical Context

These documents were created on **2025-10-18** during the initial exploration of Firebase App Hosting for the staging environment. During implementation, we discovered:

- The target region (asia-northeast1) was not supported
- Additional permissions were needed for Cloud Build service accounts
- VPC subnet regions must match the App Hosting deployment region

The new documentation (created 2025-10-20) addresses all these issues with correct, tested procedures.

---

**Last Updated:** 2025-10-20
