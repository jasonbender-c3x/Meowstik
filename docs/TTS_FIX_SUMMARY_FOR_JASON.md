# TTS Permission Fix - Summary for Jason

## What Was Done ✅

I've implemented comprehensive improvements to help diagnose and fix the "Insufficient Permission" error you're experiencing with the Text-to-Speech service.

### 1. Enhanced Error Messages
**File**: `server/integrations/expressive-tts.ts`

- Added logging to display service account details on startup:
  ```
  [TTS] Service Account: 211445981702-compute@developer.gserviceaccount.com
  [TTS] Project: ai-stack-e2a5f
  ```

- Improved permission error messages to be explicit about IAM roles:
  ```
  [TTS] Permission denied: [error details]
  [TTS] This usually means the service account lacks the required IAM role
  [TTS] Required: roles/texttospeech.user (Cloud Text-to-Speech User)
  [TTS] See: https://console.cloud.google.com/iam-admin/iam
  ```

- The error message returned to the frontend now says:
  ```
  TTS service account lacks required IAM permissions. The service account needs 
  the 'Cloud Text-to-Speech User' role (roles/texttospeech.user) in Google Cloud 
  IAM. Please contact your administrator.
  ```

### 2. New Diagnostic Tool
**File**: `scripts/diagnose-tts-iam.cjs`

Run this command to diagnose the exact issue:
```bash
npm run diagnose:tts-iam
```

This tool will:
- ✅ Verify the service account file exists and is valid
- ✅ Check if the Text-to-Speech API is enabled (if gcloud CLI is available)
- ✅ Check current IAM role assignments (if gcloud CLI is available)
- ✅ Attempt a live TTS API call to confirm permissions
- ✅ Provide specific, actionable error messages and fix instructions

### 3. Comprehensive Documentation
**New File**: `docs/TTS_IAM_PERMISSION_FIX.md`

A step-by-step guide to fix the IAM permission issue, including:
- Exact commands to run
- Links to Google Cloud Console pages
- Verification steps
- Common troubleshooting scenarios

**Updated File**: `docs/VOICE_SYNTHESIS_SETUP.md`
- Added detailed IAM setup instructions with gcloud commands
- Enhanced troubleshooting section for permission errors
- Added reference to diagnostic tools

**Updated File**: `README.md`
- Added troubleshooting link for "Insufficient Permission" errors

### 4. Script Updates
**Updated File**: `scripts/test-tts-auth.cjs`
- Fixed to use the correct service account filename

**Updated File**: `package.json`
- Added new command: `npm run diagnose:tts-iam`

## What You Need to Do 🔧

The code changes are ready and deployed, but **you need to fix the IAM permissions in Google Cloud** to resolve the issue.

### Quick Fix (Choose One Method):

#### Method A: Using gcloud CLI (If you have it installed)

```bash
gcloud projects add-iam-policy-binding ai-stack-e2a5f \
  --member="serviceAccount:211445981702-compute@developer.gserviceaccount.com" \
  --role="roles/texttospeech.user"
```

#### Method B: Using Google Cloud Console (Web UI)

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=ai-stack-e2a5f
2. Find the service account: `211445981702-compute@developer.gserviceaccount.com`
3. Click the **Edit** button (pencil icon)
4. Click **+ ADD ANOTHER ROLE**
5. Search for and select: **Cloud Text-to-Speech User**
6. Click **Save**

### Also Ensure the API is Enabled:

1. Go to: https://console.cloud.google.com/apis/library/texttospeech.googleapis.com?project=ai-stack-e2a5f
2. Click "Enable" if it's not already enabled

### After Making Changes:

1. Wait 1-2 minutes for IAM changes to propagate
2. Restart your application
3. Run `npm run diagnose:tts-iam` to verify the fix

## Why This Happened

The service account JSON key exists and is valid, but **the service account identity lacks the IAM role** that grants permission to use the Text-to-Speech API. This is a Google Cloud IAM configuration issue, not a code issue.

Think of it like having a valid ID card (the JSON key) but not having the access badge (IAM role) to enter a specific building (TTS API).

## Files Changed

1. ✅ `server/integrations/expressive-tts.ts` - Enhanced error messages
2. ✅ `scripts/diagnose-tts-iam.cjs` - New diagnostic tool
3. ✅ `scripts/test-tts-auth.cjs` - Fixed path
4. ✅ `docs/TTS_IAM_PERMISSION_FIX.md` - New quick fix guide
5. ✅ `docs/VOICE_SYNTHESIS_SETUP.md` - Enhanced documentation
6. ✅ `README.md` - Added troubleshooting link
7. ✅ `package.json` - Added new npm script

## Testing

Once you grant the IAM role, you can test by:

```bash
# 1. Run diagnostics (should pass all checks)
npm run diagnose:tts-iam

# 2. Start the server
npm run dev

# 3. Test the API
curl -X POST http://localhost:5000/api/speech/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from Meowstik!", "speakers": [{"voice": "Kore"}]}'
```

## Questions?

If you continue to have issues after granting the IAM role:
1. Run `npm run diagnose:tts-iam` and share the output
2. Check the server logs for `[TTS]` messages
3. Verify the API is enabled in Google Cloud Console

---

**Ready for your review!** The code is deployed and waiting for the IAM permission fix on your end.
