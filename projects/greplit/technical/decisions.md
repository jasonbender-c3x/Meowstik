# Technical Decisions Log

## Format: Decision → Rationale → Date

---

### Customer owns their own API tokens
**Decision:** App runs on customer's GCP/Gemini/GitHub tokens, not ours  
**Rationale:** Zero infra cost, zero liability, zero data custody risk, marketing angle ("FOR YOUR SECURITY")  
**Date:** 2026-04-18  

---

### GitHub Sponsors for monetization
**Decision:** Use GitHub Sponsors ($1–3/mo) over Stripe, Play Store, App Store  
**Rationale:** Target users already have GitHub accounts (required for Copilot license). Zero friction, GitHub currently takes 0% cut. No app store wrapper needed.  
**Date:** 2026-04-18  

---

### Encrypted .skill bundles for paywall
**Decision:** Premium skills are AES-encrypted .skill files, decrypted at runtime with license key  
**Rationale:** Paywall enforcement without a per-request server call. Keys rotate monthly.  
**Status:** Planned — not yet implemented  
**Date:** 2026-04-18  

---

### Computer-use for onboarding (not instructions)
**Decision:** Meowstik's computer-use agent literally does the GCP/GitHub signup, not just guides the user  
**Rationale:** Zero support burden. User sits back and watches. The automation IS the product.  
**Status:** Planned — not yet implemented  
**Date:** 2026-04-18  

---

### Step aside at CC entry
**Decision:** At every payment screen, app hands control back to user for CC entry  
**Rationale:** Security by design. Meowstik never sees payment info. Eliminates PCI liability entirely.  
**Status:** Planned — not yet implemented  
**Date:** 2026-04-18  

---

### Google Auth status route fix
**Decision:** Added `/google/status` directly to `authRouter` in `server/googleAuth.ts`  
**Rationale:** `server/routes/google-auth.ts` had the route but was never mounted. Requests were hanging 22+ min → 500 errors → memory leak.  
**Status:** ✅ Shipped 2026-04-18  
**Date:** 2026-04-18  

---

### GitHub Pages for showcase/content
**Decision:** Use GitHub Pages + MDX for articles, exhibits, interactive SPAs  
**Rationale:** Free, version-controlled, can embed React components. Dev audience already lives on GitHub.  
**Status:** Planned  
**Date:** 2026-04-18  
