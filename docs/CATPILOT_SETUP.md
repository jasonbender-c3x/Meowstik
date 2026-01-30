# Catpilot Configuration - Quick Reference

## One-Step Setup via Settings UI

Navigate to **Settings > Custom Branding** and configure:

```
Agent Name:          Catpilot
Display Name:        Catpilot Pro
Canonical Domain:    catpilot.pro
Avatar URL:          https://catpilot.pro/avatar.png
Brand Color:         #FF6B35
GitHub Signature:    🐱 Automated by Catpilot
Email Signature:     Best regards,
                     Catpilot - Your AI Assistant
                     catpilot.pro
```

## One-Step Setup via API

```bash
curl -X PUT http://localhost:5000/api/branding \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "Catpilot",
    "displayName": "Catpilot Pro",
    "canonicalDomain": "catpilot.pro",
    "avatarUrl": "https://catpilot.pro/avatar.png",
    "brandColor": "#FF6B35",
    "githubSignature": "🐱 Automated by Catpilot",
    "emailSignature": "Best regards,\nCatpilot - Your AI Assistant\ncatpilot.pro"
  }'
```

## What Changes After Setup?

### In Chat
- AI refers to itself as "Catpilot" instead of "Meowstik"
- System prompts use "Catpilot" throughout
- Personality adapts to Catpilot identity

### In GitHub
- Commits signed with: "🐱 Automated by Catpilot"
- PRs include Catpilot attribution
- Evolution engine uses Catpilot signature

### In Emails (when implemented)
- Signature includes "Catpilot" branding
- Domain reference: catpilot.pro

## Files Modified by This Feature

### Backend
- `shared/schema.ts` - Added `userBranding` table
- `server/storage.ts` - Added branding CRUD methods
- `server/routes/branding.ts` - New API endpoints
- `server/routes/index.ts` - Registered branding routes
- `server/services/prompt-composer.ts` - Inject branding into prompts
- `server/services/evolution-engine.ts` - Use custom GitHub signatures

### Frontend
- `client/src/pages/settings.tsx` - Added Branding UI section

### Documentation
- `docs/BRANDING_GUIDE.md` - Complete configuration guide
- `docs/CATPILOT_SETUP.md` - This quick reference

## Architecture

```
┌─────────────────┐
│  User Settings  │
│   (Frontend)    │
└────────┬────────┘
         │
         │ PUT /api/branding
         ▼
┌─────────────────┐
│  Branding API   │
│   (Backend)     │
└────────┬────────┘
         │
         │ Save to DB
         ▼
┌─────────────────┐
│ user_branding   │
│     Table       │
└────────┬────────┘
         │
         │ Fetch on request
         ▼
┌─────────────────────────────┐
│  System Integration         │
│  • Prompt Composer          │
│  • Evolution Engine         │
│  • Email Service (future)   │
└─────────────────────────────┘
```

## Reset to Defaults

### Via UI
Click "Reset to Defaults" in Settings > Custom Branding

### Via API
```bash
curl -X DELETE http://localhost:5000/api/branding
```

This reverts to:
- Agent Name: Meowstik
- Display Name: Meowstik AI
- All other fields cleared

## Testing Your Configuration

1. **Save your branding** in Settings
2. **Start a new chat** and ask: "What is your name?"
3. **Check the response** - should say "Catpilot" or your custom name
4. **Create a test PR** via Evolution Engine - verify signature

## Domain Setup (Optional)

To use `catpilot.pro` as your canonical domain:

1. Configure domain in Settings: `catpilot.pro`
2. Set up DNS to point to your Meowstik instance
3. Configure SSL certificate
4. Update `CANONICAL_DOMAIN` in `.env` (if needed)

## Environment Variables

No environment variables required! Branding is per-user and stored in database.

Optional system-wide defaults can be set in `.env`:
```env
DEFAULT_AGENT_NAME=Meowstik
DEFAULT_DISPLAY_NAME=Meowstik AI
DEFAULT_BRAND_COLOR=#4285f4
```

## FAQ

**Q: Does branding affect AI capabilities?**  
A: No! Branding only changes identity/signatures. All AI capabilities remain the same.

**Q: Can multiple users have different branding?**  
A: Yes! Each user can configure their own custom branding.

**Q: Is branding retroactive?**  
A: No. Old chats keep their original branding. New chats use current branding.

**Q: Can I use emojis in signatures?**  
A: Yes! Unicode emojis work in all text fields.

**Q: What if I don't set custom branding?**  
A: System uses defaults: "Meowstik" and "Meowstik AI"

## Support

See full documentation: [`docs/BRANDING_GUIDE.md`](./BRANDING_GUIDE.md)

---

**Feature Version**: 1.0  
**Last Updated**: January 2026  
**Status**: ✅ Complete and Ready
