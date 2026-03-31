# Recommended Document Moves

**Generated:** January 16, 2026  
**Purpose:** Inventory of documentation relocations for cleanup

---

## Classification Legend

| Symbol | Meaning |
|--------|---------|
| 🏛️ | Move to `docs/historical/exhibit/` (completed/milestone) |
| 🗄️ | Move to `docs/historical/deprecated/` (obsolete) |
| 🔄 | Move to `docs/historical/superseded/` (replaced) |
| 🔮 | Move to `docs/forward-looking/` (future/aspirational) |
| ✅ | Keep in `docs/current/` (active) |
| 🔀 | Merge/consolidate |
| ❓ | Needs review |

---

## 1. Historical/Exhibit (Completed Milestones)

These documents represent completed work and should be preserved as historical exhibits.

| Current Location | Recommended Move | Reason |
|------------------|------------------|--------|
| `docs/MEMORY_PROTECTION_SUMMARY.md` | 🏛️ `historical/exhibit/` | Feature fully implemented |
| `docs/MEMORY_LOG_PROTECTION.md` | 🏛️ `historical/exhibit/` | Feature fully implemented |
| `docs/MEMORY_PROTECTION_QUICK_START.md` | 🏛️ `historical/exhibit/` | Feature fully implemented |
| `docs/CREDENTIAL_FIX_SUMMARY.md` | 🏛️ `historical/exhibit/` | Fix completed |
| `docs/CREDENTIAL_MANAGEMENT.md` | 🏛️ `historical/exhibit/` | Fix completed |
| `docs/PROJECT_CHIMERA_PHASE1_REPORT.md` | 🏛️ `historical/exhibit/` | Phase 1 complete |
| `docs/TTS_FIX_SUMMARY_FOR_JASON.md` | 🏛️ `historical/exhibit/` | Fix completed |
| `docs/TTS_IAM_PERMISSION_FIX.md` | 🏛️ `historical/exhibit/` | Fix completed |
| `docs/VOICE_SYNTHESIS_FIX_SUMMARY.md` | 🏛️ `historical/exhibit/` | Fix completed |
| `docs/MIGRATION_IMPLEMENTATION_SUMMARY.md` | 🏛️ `historical/exhibit/` | Migration complete |
| `docs/BEFORE_AFTER_COMPARISON.md` | 🏛️ `historical/exhibit/` | Historical comparison |
| `docs/UPGRADES-2025-12-29.md` | 🏛️ `historical/exhibit/` | Pre-Dec changelog |
| `docs/EXHIBIT-LLM-Canvas-Integration.md` | 🏛️ `historical/exhibit/` | Already an exhibit |
| `docs/orchestration-implementation-summary.md` | 🏛️ `historical/exhibit/` | Implementation complete |
| `docs/PROJECT_SUMMARY_CA_2.0.md` | 🏛️ `historical/exhibit/` | Project summary |

---

## 2. Historical/Deprecated (Obsolete)

These documents are outdated and no longer applicable.

| Current Location | Recommended Move | Reason |
|------------------|------------------|--------|
| `docs/PROTOCOL_ANALYSIS.md` | 🗄️ `historical/deprecated/` | Old protocol, superseded |
| `docs/LIVE_MODE_EVALUATION.md` | 🗄️ `historical/deprecated/` | Evaluation complete |
| `docs/Roadmap_to_Friday.md` | 🗄️ `historical/deprecated/` | Past deadline |
| `docs/tool_logging_standard.md` | 🗄️ `historical/deprecated/` | Old standard |

---

## 3. Historical/Superseded (Replaced by Newer Docs)

These have been replaced by newer, more accurate documentation.

| Current Location | Superseded By | Recommended Move |
|------------------|---------------|------------------|
| `docs/twilio-sms-webhook.md` | `TWILIO_SMS_WEBHOOK.md` | 🔄 `historical/superseded/` |
| `docs/01-database-schemas.md` | `DATABASE_IMPLEMENTATION_GUIDE.md` | 🔄 `historical/superseded/` |
| `docs/llm-output-processing-pipeline.md` | `03-prompt-lifecycle.md` | 🔄 `historical/superseded/` |

---

## 4. Forward-Looking (Future/Aspirational)

Move to forward-looking folder for future reference.

| Current Location | Recommended Move | Category |
|------------------|------------------|----------|
| `docs/v2-roadmap/MASTER-ROADMAP.md` | 🔮 `forward-looking/roadmap/` | Master roadmap |
| `docs/v2-roadmap/VISIONS_OF_THE_FUTURE.md` | 🔮 `forward-looking/roadmap/` | Vision document |
| `docs/v2-roadmap/MULTI_USER_ARCHITECTURE.md` | 🔮 `forward-looking/roadmap/` | Future architecture |
| `docs/v2-roadmap/GEMINI_LIVE_API_PROPOSAL.md` | 🔮 `forward-looking/proposals/` | Future integration |
| `docs/v2-roadmap/KERNEL_IMPLEMENTATION_PROPOSAL.md` | 🔮 `forward-looking/proposals/` | Future feature |
| `docs/v2-roadmap/KNOWLEDGE_INGESTION_ARCHITECTURE.md` | 🔮 `forward-looking/roadmap/` | Future architecture |
| `docs/v2-roadmap/TODO-FEATURES.md` | 🔮 `forward-looking/roadmap/` | Future features |
| `docs/v2-roadmap/WORKFLOW-PROTOCOL.md` | 🔮 `forward-looking/roadmap/` | Future protocol |
| `docs/v2-roadmap/COUNCIL-PRIORITIES.md` | 🔮 `forward-looking/roadmap/` | Future priorities |
| `docs/idea-extraction/VISION_BLOG_POST.md` | 🔮 `forward-looking/research/` | Vision content |
| `docs/idea-extraction/COMPREHENSIVE_VISION.md` | 🔮 `forward-looking/research/` | Vision content |
| `docs/roadmap-platform-independence.md` | 🔮 `forward-looking/roadmap/` | Future goal |

---

## 5. Keep Current (Active Documentation)

These remain in `docs/` or move to `docs/current/`.

| Document | Status | Notes |
|----------|--------|-------|
| `docs/02-ui-architecture.md` | ✅ Keep | Current architecture |
| `docs/03-prompt-lifecycle.md` | ✅ Keep | Core documentation |
| `docs/05-tool-call-schema.md` | ✅ Keep | Active schema |
| `docs/FEATURES.md` | ✅ Keep | Feature list |
| `docs/QUICK_START.md` | ✅ Keep | Getting started |
| `docs/authentication-and-session-isolation.md` | ✅ Keep | Active auth docs |
| `docs/COGNITIVE_ARCHITECTURE_2.0.md` | ✅ Keep | Current architecture |
| `docs/orchestration-layer.md` | ✅ Keep | Current docs |
| `docs/DATABASE_IMPLEMENTATION_GUIDE.md` | ✅ Keep | Active guide |
| `docs/database-migration-guide.md` | ✅ Keep | Active guide |
| `docs/local-development.md` | ✅ Keep | Dev guide |
| `docs/desktop-agent-localhost-dev.md` | ✅ Keep | Dev guide |
| `docs/HOME_DEV_IMPLEMENTATION.md` | ✅ Keep | Active |
| `docs/HOME_DEV_MODE.md` | ✅ Keep | Active |
| `docs/LLM_ORCHESTRATION_GUIDE.md` | ✅ Keep | Active guide |
| `docs/MULTI_DATABASE_SUPPORT.md` | ✅ Keep | Active |
| `docs/RAG_PIPELINE.md` | ✅ Keep | Core RAG docs |
| `docs/RAG_TRACEABILITY_*.md` | ✅ Keep | Active RAG docs |
| `docs/SYSTEM_OVERVIEW.md` | ✅ Keep | System overview |
| `docs/SSH_DEPLOYMENT_ANALYSIS.md` | ✅ Keep | Active |
| `docs/ssh-gateway-guide.md` | ✅ Keep | Active guide |
| `docs/VOICE_SYNTHESIS_SETUP.md` | ✅ Keep | Active setup |
| `docs/TWILIO_CONVERSATIONAL_CALLING.md` | ✅ Keep | Active feature |
| `docs/TWILIO_IMPLEMENTATION_SUMMARY.md` | ✅ Keep | Active |
| `docs/TWILIO_SMS_WEBHOOK.md` | ✅ Keep | Active |
| `docs/twilio_voice_features.md` | ✅ Keep | Active |
| `docs/BROWSER_EXTENSION_*.md` | ✅ Keep | Active feature |
| `docs/http-client-tools.md` | ✅ Keep | Active |
| `docs/ITEMS_LIST.md` | ✅ Keep | Active tracking |
| `docs/ISSUES_DISCOVERED.md` | ✅ Keep | Active tracking |

---

## 6. Consolidation Candidates

These documents should be merged or reorganized.

| Documents | Recommendation |
|-----------|----------------|
| `docs/ragent/*.md` | 🔀 Consolidate into `docs/current/ragent/` with index |
| `docs/refactor/*.md` | 🔀 Review and archive completed items |
| `docs/features/*.md` | 🔀 Merge into `FEATURES.md` or keep as subdocs |
| `docs/project_chimera_*.md` (3 files) | 🔀 Consolidate under `docs/current/chimera/` |

---

## 7. Needs Review

| Document | Question |
|----------|----------|
| `docs/EXTERNAL-DOCS-HOSTING.md` | Still relevant? |
| `docs/MARKDOWN_EMBEDDING_GUIDE.md` | Merge with RAG docs? |
| `docs/AGENT_ATTRIBUTION.md` | Keep or archive? |

---

## Execution Script

```bash
#!/bin/bash
# Execute recommended moves (run after review)

# Historical/Exhibit
mv docs/MEMORY_PROTECTION_SUMMARY.md docs/historical/exhibit/
mv docs/MEMORY_LOG_PROTECTION.md docs/historical/exhibit/
mv docs/MEMORY_PROTECTION_QUICK_START.md docs/historical/exhibit/
mv docs/CREDENTIAL_FIX_SUMMARY.md docs/historical/exhibit/
mv docs/CREDENTIAL_MANAGEMENT.md docs/historical/exhibit/
mv docs/PROJECT_CHIMERA_PHASE1_REPORT.md docs/historical/exhibit/
mv docs/TTS_FIX_SUMMARY_FOR_JASON.md docs/historical/exhibit/
mv docs/TTS_IAM_PERMISSION_FIX.md docs/historical/exhibit/
mv docs/VOICE_SYNTHESIS_FIX_SUMMARY.md docs/historical/exhibit/
mv docs/MIGRATION_IMPLEMENTATION_SUMMARY.md docs/historical/exhibit/
mv docs/BEFORE_AFTER_COMPARISON.md docs/historical/exhibit/
mv docs/UPGRADES-2025-12-29.md docs/historical/exhibit/
mv docs/EXHIBIT-LLM-Canvas-Integration.md docs/historical/exhibit/
mv docs/orchestration-implementation-summary.md docs/historical/exhibit/
mv docs/PROJECT_SUMMARY_CA_2.0.md docs/historical/exhibit/

# Historical/Deprecated
mv docs/PROTOCOL_ANALYSIS.md docs/historical/deprecated/
mv docs/LIVE_MODE_EVALUATION.md docs/historical/deprecated/
mv docs/Roadmap_to_Friday.md docs/historical/deprecated/
mv docs/tool_logging_standard.md docs/historical/deprecated/

# Historical/Superseded
mv docs/twilio-sms-webhook.md docs/historical/superseded/
mv docs/01-database-schemas.md docs/historical/superseded/
mv docs/llm-output-processing-pipeline.md docs/historical/superseded/

# Forward-Looking
mv docs/v2-roadmap/* docs/forward-looking/roadmap/
mv docs/idea-extraction/* docs/forward-looking/research/
mv docs/roadmap-platform-independence.md docs/forward-looking/roadmap/

echo "Document moves complete. Review for broken links."
```

---

## Summary Statistics

| Category | Count | Action |
|----------|-------|--------|
| Historical/Exhibit | 15 | Archive as milestones |
| Historical/Deprecated | 4 | Archive as obsolete |
| Historical/Superseded | 3 | Archive as replaced |
| Forward-Looking | 12 | Move to future folder |
| Keep Current | 35+ | Maintain in active docs |
| Consolidate | 4 groups | Merge related docs |
| Needs Review | 3 | Manual decision required |

---

*Last updated: January 16, 2026*
