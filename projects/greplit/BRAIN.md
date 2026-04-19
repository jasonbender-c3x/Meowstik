# 🧠 PROJECT BRAIN — GREPLIT
> **30-minute catch-up document. Read this first. Always current.**
> Last updated: 2026-04-18

---

## ⚡ What Is This Project?

Meowstik is an AI meta-agent platform that:
- Runs **locally on the customer's own API tokens** (GCP, Gemini, GitHub)
- Uses **computer-use + voice** to automate cloud onboarding
- Escapes users from Replit's walled garden → free Google Cloud infrastructure
- Charges a one-time setup fee ($25–40) + optional $1–3/mo for premium skills

**One-liner:** *"Pay Google, GitHub, and Google again — all on their free tiers. Pay us $3 to connect it all."*

**Key differentiator:** *"FOR YOUR SECURITY — your tokens never leave your machine. Ever."*

---

## 🏗️ Current State of the App

- ✅ Meowstik server running (Express + TypeScript + SQLite)
- ✅ Computer-use tools working
- ✅ Terminal tools working  
- ✅ Gemini AI integration
- ✅ Google OAuth (fixed tonight — /api/auth/google/status was returning 500, now fixed)
- ✅ Smart installer script: `scripts/install.sh`
- 🔲 Encrypted skill bundles (paywall system)
- 🔲 GitHub Sponsors integration
- 🔲 GCP onboarding automation flow
- 🔲 Voice-guided setup UX
- 🔲 Cockpit startup context menu
- 🔲 GitHub Pages showcase site

---

## 💼 Business Model

| Item | Detail |
|---|---|
| One-time setup fee | $25–40 |
| Monthly subscription | $1–3/mo via GitHub Sponsors |
| Monetization | GitHub Sponsors (0% cut, users already have accounts) |
| Marginal cost per user | ~$0 (they bring their own tokens) |
| Target user | Replit "vibe coders" frustrated with walled garden + cost |

### The Win-Win-Win
- **Customer wins** — more services, less cost, own their data
- **Google wins** — new GCP customer acquired for them
- **You win** — small cut of the savings, zero infra cost, scales infinitely

### Cost Structure (Why This Works)
Customer directly pays (all on free tiers):
1. GCP compute + $300 credit
2. Gemini inference (via their GCP project)
3. GitHub Copilot license
4. 2TB Cloud Storage

You need: one tiny license-validation server. That's it.

---

## 🗺️ Roadmap (Priority Order)

### Phase 1 — Foundation (Now)
- [ ] Project brain / knowledge base (this folder) ← IN PROGRESS
- [ ] GitHub Pages landing page
- [ ] GitHub Sponsors setup

### Phase 2 — The Product Hook
- [ ] GCP onboarding automation (computer-use flow)
- [ ] Voice-guided setup UX ("Name on card?")
- [ ] Payment handoff — app steps aside at CC entry

### Phase 3 — Monetization
- [ ] Encrypted skill bundle system (.skill files, AES)
- [ ] License key validation via GitHub Sponsors API
- [ ] Cockpit startup context menu (smart session picker)

### Phase 4 — Growth
- [ ] GitHub Pages showcase/exhibit site
- [ ] AI-collaborated articles (drafts → published)
- [ ] Referral tracking (Google Cloud + GitHub referral programs)

---

## 🧩 Key Technical Decisions Made

| Decision | Rationale |
|---|---|
| Customer owns tokens | Zero liability, zero infra cost, marketing angle |
| GitHub Sponsors for billing | Users already have GitHub (required for Copilot) |
| Encrypted .skill bundles | Paywall without a server per request |
| Computer-use for onboarding | Zero support burden, fully automated |
| Step aside at CC entry | Security by design — never touch payment info |
| GitHub Pages for content | Free, version-controlled, supports MDX/SPAs |

---

## 📁 Folder Guide

```
project/
  BRAIN.md          ← YOU ARE HERE. Read this first.
  business/         ← Business model, pricing, strategy docs
  technical/        ← Architecture decisions, how things work
  sessions/         ← Dated logs of each work session
  todo/             ← Active task lists by phase
  exhibits/         ← Plans for showcase SPAs and articles
```

---

## 👤 Founder Context

- Solo founder, 60 years old (May)
- AI partnership solves: focus, stumbling blocks, memory, organization
- Previous pattern: losing interest when blocked → SOLVED by AI team
- Generative AI = the one tool that will never get put down
- Style: voice-first, visual thinker, big picture + execution together

---

## 🔁 How to Update This Document

At the end of every session, run:
```
gh copilot suggest -t shell "Summarize today's Meowstik work session and append it to project/sessions/$(date +%Y-%m-%d).md, then update project/BRAIN.md with any new decisions or completed tasks"
```

Or just tell Meowstik: **"Update the brain."**
