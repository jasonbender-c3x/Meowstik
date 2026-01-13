# Credential Management Guide for Meowstik

## Overview

Meowstik uses Google Cloud service accounts for authenticating with Google Cloud services (Text-to-Speech, Cloud Vision, etc.). This guide explains how to properly configure and manage these credentials in both Replit and local development environments.

## Current Configuration

### Production (Replit)

The `.replit` file contains the credential configuration in the `[userenv.shared]` section:

```toml
[userenv.shared]
GOOGLE_APPLICATION_CREDENTIALS = "attached_assets/ai-stack-e2a5f-72c8fed5d463_1767324141242.json"
GOOGLE_REDIRECT_URI = "https://meowstik.com/api/auth/google/callback"
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium"
```

**Key Points:**
- The path is **relative** to the repository root
- The service account key file is stored in `attached_assets/` directory
- This method has proven to be the most reliable for Replit deployments

### Local Development

For local development, use the `.env` file (copy from `.env.example`):

```bash
# Google Cloud Service Account (for TTS and other Google Cloud services)
# Point this to your service account JSON key file
GOOGLE_APPLICATION_CREDENTIALS=./attached_assets/your-service-account-key.json
```

## Credential Management Best Practices

### 1. Service Account Key Location

**✅ RECOMMENDED: Use `attached_assets/` directory**

Reasons:
- Proven reliability in Replit environment
- Easy to reference with relative path
- Keeps credentials organized
- Works consistently across deployments

**⚠️ NOT RECOMMENDED: Replit Secrets for JSON files**

Issues encountered:
- Replit Secrets work best for simple key-value pairs
- JSON files with newlines and special characters cause parsing issues
- Leads to intermittent authentication failures
- More complex to debug when issues arise

### 2. Security Considerations

**DO:**
- ✅ Store service account keys in `attached_assets/` for production
- ✅ Add `attached_assets/*.json` to `.gitignore` (except example files)
- ✅ Use dedicated service accounts with minimal required permissions
- ✅ Rotate service account keys periodically (every 90 days recommended)
- ✅ Monitor service account usage in Google Cloud Console
- ✅ Use different service accounts for production vs development

**DON'T:**
- ❌ Commit real service account keys to git (use `.gitignore`)
- ❌ Share service account keys via insecure channels
- ❌ Grant overly broad permissions to service accounts
- ❌ Reuse service accounts across multiple projects
- ❌ Store credentials in environment variables for Replit (use `.replit` file instead)

### 3. Path Configuration

**For Replit (`.replit` file):**
```toml
GOOGLE_APPLICATION_CREDENTIALS = "attached_assets/service-account-key.json"
```
- Use **relative path** from repository root
- No leading `/` or `./`

**For Local (.env file):**
```bash
GOOGLE_APPLICATION_CREDENTIALS=./attached_assets/service-account-key.json
```
- Use relative path with `./` prefix
- Or use absolute path if preferred

## Service Account Setup

### Creating a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **IAM & Admin** > **Service Accounts**
3. Click **Create Service Account**
4. Fill in details:
   - **Name:** `meowstik-ai-assistant` (or similar)
   - **Description:** "Service account for Meowstik AI assistant"
5. Grant required roles:
   - **Cloud Text-to-Speech User** (for TTS)
   - Or use **Editor** role for development (reduce to minimal permissions in production)
6. Click **Create Key** > **JSON**
7. Download the key file

### Installing the Service Account Key

**For Replit:**
1. Upload the JSON file to the `attached_assets/` directory via Replit UI
2. Note the filename (e.g., `ai-stack-e2a5f-72c8fed5d463_1767324141242.json`)
3. Update the `.replit` file with the correct filename:
   ```toml
   [userenv.shared]
   GOOGLE_APPLICATION_CREDENTIALS = "attached_assets/YOUR-KEY-FILENAME.json"
   ```
4. Replit will automatically load this environment variable on deployment

**For Local Development:**
1. Copy the JSON file to `attached_assets/` directory
2. Create/update `.env` file:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=./attached_assets/YOUR-KEY-FILENAME.json
   ```
3. Ensure `.env` is in `.gitignore`

## Testing Credentials

### Test Script

Run the authentication test script:

```bash
npm run test:tts-auth
```

This will verify:
- ✅ Environment variable is set correctly
- ✅ File exists at the specified path
- ✅ JSON format is valid
- ✅ All required fields are present
- ✅ Configuration matches what the code expects

### Expected Output

```
✅ SUCCESS: TTS Authentication Configured Correctly!

📋 Summary:
   • Service account file is valid
   • All required credentials are present
   • Ready for Text-to-Speech API calls
```

### IAM Diagnostics

For more detailed IAM permission checking:

```bash
npm run diagnose:tts-iam
```

This will:
- Test actual API authentication
- Verify service account has required permissions
- Check if Text-to-Speech API is enabled
- Provide actionable troubleshooting steps

## Troubleshooting

### Error: "GOOGLE_APPLICATION_CREDENTIALS not set"

**Cause:** Environment variable is not configured

**Solutions:**
1. For Replit: Verify `.replit` file has correct path in `[userenv.shared]` section
2. For Local: Verify `.env` file exists and has correct path
3. Restart the server after making changes

### Error: "Service account file not found"

**Cause:** File path is incorrect or file doesn't exist

**Solutions:**
1. Check the file exists: `ls -la attached_assets/*.json`
2. Verify path in configuration matches actual filename
3. Use relative path without leading `/` in `.replit` file
4. For local dev, ensure path starts with `./` in `.env` file

### Error: "Authentication failed" or "Permission denied"

**Cause:** Service account lacks required permissions

**Solutions:**
1. Run `npm run diagnose:tts-iam` to check permissions
2. Go to [IAM Console](https://console.cloud.google.com/iam-admin/iam)
3. Find your service account email
4. Add required roles:
   - Cloud Text-to-Speech User
   - Or Cloud Text-to-Speech API User
5. Verify API is enabled: [Text-to-Speech API](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com)

### Intermittent Authentication Failures

**Cause:** Network issues or temporary API outages

**Solutions:**
1. The code implements automatic retry (2 retries with exponential backoff)
2. Check [Google Cloud Status Dashboard](https://status.cloud.google.com/)
3. Verify your internet connection
4. If persists, regenerate service account key

## Migration Guide

### From Replit Secrets to attached_assets/

If you were previously using Replit Secrets and experiencing issues:

1. **Export from Replit Secrets:**
   - Go to Replit Secrets tab
   - Copy the service account JSON content

2. **Create JSON file:**
   - Create a new file in `attached_assets/` directory
   - Name it descriptively: `meowstik-service-account-YYYYMMDD.json`
   - Paste the JSON content

3. **Update .replit:**
   ```toml
   [userenv.shared]
   GOOGLE_APPLICATION_CREDENTIALS = "attached_assets/meowstik-service-account-YYYYMMDD.json"
   ```

4. **Test:**
   ```bash
   npm run test:tts-auth
   ```

5. **Deploy:**
   - Commit and push changes
   - Replit will automatically use the new configuration

6. **Cleanup:**
   - Remove old secret from Replit Secrets (optional)

## Architecture Notes

### Authentication Flow

```
Application Startup
  ↓
Load .env (local) or .replit (production) environment variables
  ↓
server/integrations/expressive-tts.ts
  ↓
getServiceAccountAuth() reads GOOGLE_APPLICATION_CREDENTIALS
  ↓
Loads JSON file and creates GoogleAuth instance
  ↓
All Text-to-Speech API calls use this authentication
```

### Fallback Mechanism

The system implements a two-tier authentication strategy:

1. **Primary: Service Account** (via `GOOGLE_APPLICATION_CREDENTIALS`)
   - Application-level authentication
   - No user interaction required
   - 1M characters/month free tier for TTS
   - Used for all automated operations

2. **Fallback: OAuth2** (user tokens)
   - User-level authentication
   - Requires Google account connection
   - Used when service account is not available
   - Limited to user's own quotas

### Code Reference

See `server/integrations/expressive-tts.ts`:

```typescript
function getServiceAccountAuth(): Auth.GoogleAuth | null {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    console.warn('[TTS] GOOGLE_APPLICATION_CREDENTIALS not set');
    return null;
  }
  
  const resolvedPath = path.resolve(credentialsPath);
  if (!fs.existsSync(resolvedPath)) {
    console.warn(`[TTS] Service account file not found: ${resolvedPath}`);
    return null;
  }
  
  // Load and return GoogleAuth instance
}
```

## Additional Resources

- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Google Cloud Text-to-Speech API](https://cloud.google.com/text-to-speech/docs)
- [Voice Synthesis Setup Guide](./VOICE_SYNTHESIS_SETUP.md)
- [Voice Synthesis Fix Summary](./VOICE_SYNTHESIS_FIX_SUMMARY.md)

## Support

If you continue to experience credential issues after following this guide:

1. Run both diagnostic scripts:
   ```bash
   npm run test:tts-auth
   npm run diagnose:tts-iam
   ```

2. Check the logs for specific error messages

3. Verify your service account has not been disabled in Google Cloud Console

4. Consider creating a fresh service account with minimal required permissions

5. For persistent issues, check the [GitHub Issues](https://github.com/jasonbender-c3x/Meowstik/issues) or create a new issue with diagnostic output
