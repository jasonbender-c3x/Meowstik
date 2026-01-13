# TTS IAM Permission Fix Guide

## Problem
Text-to-Speech API returns **"Insufficient Permission"** or **"PERMISSION_DENIED"** error.

## Root Cause
The Google Cloud service account lacks the required IAM role to use the Text-to-Speech API.

## Quick Fix

### Step 1: Identify Your Service Account

Your service account email can be found in the service account JSON file:
```bash
cat attached_assets/ai-stack-e2a5f-72c8fed5d463_1767324141242.json | grep client_email
```

For this project:
- **Service Account**: `211445981702-compute@developer.gserviceaccount.com`
- **Project ID**: `ai-stack-e2a5f`

### Step 2: Grant the Required IAM Role

Choose one of the following methods:

#### Method A: Using gcloud CLI (Recommended)

```bash
gcloud projects add-iam-policy-binding ai-stack-e2a5f \
  --member="serviceAccount:211445981702-compute@developer.gserviceaccount.com" \
  --role="roles/texttospeech.user"
```

#### Method B: Using Google Cloud Console (Web UI)

1. Go to [IAM & Admin](https://console.cloud.google.com/iam-admin/iam?project=ai-stack-e2a5f)
2. Find the service account: `211445981702-compute@developer.gserviceaccount.com`
3. Click the **Edit** button (pencil icon)
4. Click **+ ADD ANOTHER ROLE**
5. Search for and select: **Cloud Text-to-Speech User** (`roles/texttospeech.user`)
6. Click **Save**

### Step 3: Enable Text-to-Speech API

Ensure the API is enabled in your project:

```bash
gcloud services enable texttospeech.googleapis.com --project=ai-stack-e2a5f
```

Or via [API Library](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com?project=ai-stack-e2a5f).

### Step 4: Verify the Fix

Wait 1-2 minutes for IAM changes to propagate, then run:

```bash
npm run diagnose:tts-iam
```

This will test the actual TTS API and confirm permissions are working.

### Step 5: Restart Application

After confirming permissions are correct, restart your application:

```bash
npm run dev
```

## Understanding IAM Roles

### Minimum Required Role
- **Cloud Text-to-Speech User** (`roles/texttospeech.user`)
  - Grants: `texttospeech.*` permissions
  - Best practice: Use this role for security

### Alternative Roles (Broader Permissions)
- **Editor** (`roles/editor`)
  - Grants: Most Google Cloud service permissions
  - Includes Text-to-Speech access
  - Use only if service account needs multiple services

- **Owner** (`roles/owner`)
  - Grants: Full project access
  - Not recommended for service accounts

## Common Issues

### Issue: "API is not enabled"
**Solution**: Enable the Text-to-Speech API (Step 3 above)

### Issue: "IAM changes not taking effect"
**Solution**: Wait 1-2 minutes for propagation, then test again

### Issue: "Service account not found"
**Solution**: Verify the service account email is correct and exists in your project

### Issue: "Permission still denied after granting role"
**Solution**: 
1. Verify the role was added correctly: `gcloud projects get-iam-policy ai-stack-e2a5f --flatten="bindings[].members" --filter="bindings.members:serviceAccount:211445981702-compute@developer.gserviceaccount.com"`
2. Check if API is enabled: `gcloud services list --enabled --project=ai-stack-e2a5f | grep texttospeech`
3. Ensure service account JSON file is valid
4. Restart the application

## Verification Commands

### Check current IAM roles:
```bash
gcloud projects get-iam-policy ai-stack-e2a5f \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:211445981702-compute@developer.gserviceaccount.com" \
  --format="table(bindings.role)"
```

### Check if API is enabled:
```bash
gcloud services list --enabled --project=ai-stack-e2a5f --filter="name:texttospeech.googleapis.com"
```

### Test authentication:
```bash
npm run test:tts-auth
```

### Full diagnostic:
```bash
npm run diagnose:tts-iam
```

## Additional Resources

- [Google Cloud Text-to-Speech Documentation](https://cloud.google.com/text-to-speech/docs)
- [IAM Roles Reference](https://cloud.google.com/iam/docs/understanding-roles)
- [Service Account Best Practices](https://cloud.google.com/iam/docs/best-practices-service-accounts)

## Contact

If you continue to experience issues after following this guide, please:
1. Run `npm run diagnose:tts-iam` and save the output
2. Check server logs for detailed error messages
3. Report the issue with the diagnostic output
