#!/bin/bash

# =============================================================================
# Documentation Reorganization Script
# =============================================================================
#
# This script reorganizes the Meowstik documentation into:
# 1. Core docs (current system reference)
# 2. Exhibit docs (historical evolution)
#
# Usage: ./docs-reorganize.sh
#
# =============================================================================

set -e

echo "🎭 Meowstik Documentation Reorganization"
echo "========================================="
echo ""

cd "$(dirname "$0")/.."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counter
moved=0

echo -e "${BLUE}Phase 0: Genesis (Foundation)${NC}"
# Move foundational architecture docs
mv docs/SYSTEM_OVERVIEW.md docs/exhibit/00-genesis/ 2>/dev/null && echo "  ✓ SYSTEM_OVERVIEW.md" && ((moved++)) || true
mv docs/01-database-schemas.md docs/exhibit/00-genesis/ 2>/dev/null && echo "  ✓ 01-database-schemas.md" && ((moved++)) || true
mv docs/02-ui-architecture.md docs/exhibit/00-genesis/ 2>/dev/null && echo "  ✓ 02-ui-architecture.md" && ((moved++)) || true
mv docs/03-prompt-lifecycle.md docs/exhibit/00-genesis/ 2>/dev/null && echo "  ✓ 03-prompt-lifecycle.md" && ((moved++)) || true

echo ""
echo -e "${BLUE}Phase 1: Core Features${NC}"
# Already have FEATURES.md, move specific feature docs
mv docs/05-tool-call-schema.md docs/exhibit/01-core-features/ 2>/dev/null && echo "  ✓ 05-tool-call-schema.md" && ((moved++)) || true
mv docs/authentication-and-session-isolation.md docs/exhibit/01-core-features/ 2>/dev/null && echo "  ✓ authentication-and-session-isolation.md" && ((moved++)) || true
mv docs/LLM_API_BEST_PRACTICES.md docs/exhibit/01-core-features/ 2>/dev/null && echo "  ✓ LLM_API_BEST_PRACTICES.md" && ((moved++)) || true
mv docs/MARKDOWN_EMBEDDING_GUIDE.md docs/exhibit/01-core-features/ 2>/dev/null && echo "  ✓ MARKDOWN_EMBEDDING_GUIDE.md" && ((moved++)) || true

echo ""
echo -e "${BLUE}Phase 2: Integrations${NC}"
# Move integration docs
mv docs/TWILIO_IMPLEMENTATION_SUMMARY.md docs/exhibit/02-integrations/ 2>/dev/null && echo "  ✓ TWILIO_IMPLEMENTATION_SUMMARY.md" && ((moved++)) || true
mv docs/TWILIO_CONVERSATIONAL_CALLING.md docs/exhibit/02-integrations/ 2>/dev/null && echo "  ✓ TWILIO_CONVERSATIONAL_CALLING.md" && ((moved++)) || true
mv docs/TWILIO_SMS_WEBHOOK.md docs/exhibit/02-integrations/ 2>/dev/null && echo "  ✓ TWILIO_SMS_WEBHOOK.md" && ((moved++)) || true
mv docs/twilio-sms-webhook.md docs/exhibit/02-integrations/ 2>/dev/null && echo "  ✓ twilio-sms-webhook.md" && ((moved++)) || true
mv docs/twilio_voice_features.md docs/exhibit/02-integrations/ 2>/dev/null && echo "  ✓ twilio_voice_features.md" && ((moved++)) || true
mv docs/VOICE_SYNTHESIS_SETUP.md docs/exhibit/02-integrations/ 2>/dev/null && echo "  ✓ VOICE_SYNTHESIS_SETUP.md" && ((moved++)) || true
mv docs/VOICE_SYNTHESIS_FIX_SUMMARY.md docs/exhibit/02-integrations/ 2>/dev/null && echo "  ✓ VOICE_SYNTHESIS_FIX_SUMMARY.md" && ((moved++)) || true
mv docs/CREDENTIAL_MANAGEMENT.md docs/exhibit/02-integrations/ 2>/dev/null && echo "  ✓ CREDENTIAL_MANAGEMENT.md" && ((moved++)) || true
mv docs/CREDENTIAL_FIX_SUMMARY.md docs/exhibit/02-integrations/ 2>/dev/null && echo "  ✓ CREDENTIAL_FIX_SUMMARY.md" && ((moved++)) || true
mv docs/GITHUB_BOT_IDENTITY_SETUP.md docs/exhibit/02-integrations/ 2>/dev/null && echo "  ✓ GITHUB_BOT_IDENTITY_SETUP.md" && ((moved++)) || true
mv docs/HARDWARE_IOT_GUIDE.md docs/exhibit/02-integrations/ 2>/dev/null && echo "  ✓ HARDWARE_IOT_GUIDE.md" && ((moved++)) || true

echo ""
echo -e "${BLUE}Phase 3: Advanced AI${NC}"
# Move AI/RAG/Memory docs
mv docs/RAG_PIPELINE.md docs/exhibit/03-advanced-ai/ 2>/dev/null && echo "  ✓ RAG_PIPELINE.md" && ((moved++)) || true
mv docs/RAG_TRACEABILITY_IMPLEMENTATION.md docs/exhibit/03-advanced-ai/ 2>/dev/null && echo "  ✓ RAG_TRACEABILITY_IMPLEMENTATION.md" && ((moved++)) || true
mv docs/RAG_TRACEABILITY_PROPOSAL.md docs/exhibit/03-advanced-ai/ 2>/dev/null && echo "  ✓ RAG_TRACEABILITY_PROPOSAL.md" && ((moved++)) || true
mv docs/RAG_TRACEABILITY_COLLABORATION_GUIDE.md docs/exhibit/03-advanced-ai/ 2>/dev/null && echo "  ✓ RAG_TRACEABILITY_COLLABORATION_GUIDE.md" && ((moved++)) || true
mv docs/RAG_TRACEABILITY_UI_GUIDE.md docs/exhibit/03-advanced-ai/ 2>/dev/null && echo "  ✓ RAG_TRACEABILITY_UI_GUIDE.md" && ((moved++)) || true
mv docs/COGNITIVE_ARCHITECTURE_2.0.md docs/exhibit/03-advanced-ai/ 2>/dev/null && echo "  ✓ COGNITIVE_ARCHITECTURE_2.0.md" && ((moved++)) || true
mv docs/LLM_ORCHESTRATION_GUIDE.md docs/exhibit/03-advanced-ai/ 2>/dev/null && echo "  ✓ LLM_ORCHESTRATION_GUIDE.md" && ((moved++)) || true
mv docs/MEMORY_LOG_PROTECTION.md docs/exhibit/03-advanced-ai/ 2>/dev/null && echo "  ✓ MEMORY_LOG_PROTECTION.md" && ((moved++)) || true
mv docs/MEMORY_PROTECTION_QUICK_START.md docs/exhibit/03-advanced-ai/ 2>/dev/null && echo "  ✓ MEMORY_PROTECTION_QUICK_START.md" && ((moved++)) || true
mv docs/MEMORY_PROTECTION_SUMMARY.md docs/exhibit/03-advanced-ai/ 2>/dev/null && echo "  ✓ MEMORY_PROTECTION_SUMMARY.md" && ((moved++)) || true
mv docs/llm-output-processing-pipeline.md docs/exhibit/03-advanced-ai/ 2>/dev/null && echo "  ✓ llm-output-processing-pipeline.md" && ((moved++)) || true
mv docs/llm-io-capture.md docs/exhibit/03-advanced-ai/ 2>/dev/null && echo "  ✓ llm-io-capture.md" && ((moved++)) || true
mv docs/PROTOCOL_ANALYSIS.md docs/exhibit/03-advanced-ai/ 2>/dev/null && echo "  ✓ PROTOCOL_ANALYSIS.md" && ((moved++)) || true

echo ""
echo -e "${BLUE}Phase 4: Automation${NC}"
# Move automation/extension docs
mv docs/BROWSER_EXTENSION_DEV_IMPLEMENTATION.md docs/exhibit/04-automation/ 2>/dev/null && echo "  ✓ BROWSER_EXTENSION_DEV_IMPLEMENTATION.md" && ((moved++)) || true
mv docs/BROWSER_EXTENSION_DEV_PROPOSAL.md docs/exhibit/04-automation/ 2>/dev/null && echo "  ✓ BROWSER_EXTENSION_DEV_PROPOSAL.md" && ((moved++)) || true
mv docs/BROWSER_EXTENSION_DEV_SUMMARY.md docs/exhibit/04-automation/ 2>/dev/null && echo "  ✓ BROWSER_EXTENSION_DEV_SUMMARY.md" && ((moved++)) || true
mv docs/desktop-agent-localhost-dev.md docs/exhibit/04-automation/ 2>/dev/null && echo "  ✓ desktop-agent-localhost-dev.md" && ((moved++)) || true
mv docs/ssh-gateway-guide.md docs/exhibit/04-automation/ 2>/dev/null && echo "  ✓ ssh-gateway-guide.md" && ((moved++)) || true
mv docs/SSH_DEPLOYMENT_ANALYSIS.md docs/exhibit/04-automation/ 2>/dev/null && echo "  ✓ SSH_DEPLOYMENT_ANALYSIS.md" && ((moved++)) || true
mv docs/orchestration-layer.md docs/exhibit/04-automation/ 2>/dev/null && echo "  ✓ orchestration-layer.md" && ((moved++)) || true
mv docs/orchestration-implementation-summary.md docs/exhibit/04-automation/ 2>/dev/null && echo "  ✓ orchestration-implementation-summary.md" && ((moved++)) || true
mv docs/http-client-tools.md docs/exhibit/04-automation/ 2>/dev/null && echo "  ✓ http-client-tools.md" && ((moved++)) || true

# Move ragent folder
mv docs/ragent docs/exhibit/04-automation/ 2>/dev/null && echo "  ✓ ragent/ (entire folder)" && ((moved++)) || true

echo ""
echo -e "${BLUE}Phase 5: Refinements${NC}"
# Move refinement/fix docs
mv docs/VERBOSITY_IMPLEMENTATION_SUMMARY.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ VERBOSITY_IMPLEMENTATION_SUMMARY.md" && ((moved++)) || true
mv docs/VERBOSITY_UI_MOCKUP.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ VERBOSITY_UI_MOCKUP.md" && ((moved++)) || true
mv docs/VERBOSITY_MODES.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ VERBOSITY_MODES.md" && ((moved++)) || true
mv docs/VERBOSITY_BEFORE_AFTER.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ VERBOSITY_BEFORE_AFTER.md" && ((moved++)) || true
mv docs/VERBOSITY_TESTING.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ VERBOSITY_TESTING.md" && ((moved++)) || true
mv docs/MICROPHONE_STATE_FLOW.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ MICROPHONE_STATE_FLOW.md" && ((moved++)) || true
mv docs/MICROPHONE_STALE_TEXT_FIX.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ MICROPHONE_STALE_TEXT_FIX.md" && ((moved++)) || true
mv docs/TTS_IAM_PERMISSION_FIX.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ TTS_IAM_PERMISSION_FIX.md" && ((moved++)) || true
mv docs/TTS_FIX_SUMMARY_FOR_JASON.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ TTS_FIX_SUMMARY_FOR_JASON.md" && ((moved++)) || true
mv docs/SYSTEM_PROMPT_EXCLUSION_FIX_REPORT.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ SYSTEM_PROMPT_EXCLUSION_FIX_REPORT.md" && ((moved++)) || true
mv docs/LIVE_MODE_IMPLEMENTATION_SUMMARY.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ LIVE_MODE_IMPLEMENTATION_SUMMARY.md" && ((moved++)) || true
mv docs/LIVE_MODE_EVALUATION.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ LIVE_MODE_EVALUATION.md" && ((moved++)) || true
mv docs/LIVE_MODE_GUIDE.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ LIVE_MODE_GUIDE.md" && ((moved++)) || true
mv docs/FIX_SUMMARY_EXTENSION_AGENT.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ FIX_SUMMARY_EXTENSION_AGENT.md" && ((moved++)) || true
mv docs/TESTING_EXTENSION_AGENT.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ TESTING_EXTENSION_AGENT.md" && ((moved++)) || true
mv docs/DATABASE_MIGRATION_GUIDE.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ DATABASE_MIGRATION_GUIDE.md" && ((moved++)) || true
mv docs/database-migration-guide.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ database-migration-guide.md" && ((moved++)) || true
mv docs/MIGRATION_IMPLEMENTATION_SUMMARY.md docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ MIGRATION_IMPLEMENTATION_SUMMARY.md" && ((moved++)) || true

# Move bugfixes folder
mv docs/bugfixes docs/exhibit/05-refinements/ 2>/dev/null && echo "  ✓ bugfixes/ (entire folder)" && ((moved++)) || true

echo ""
echo -e "${BLUE}Phase 6: Proposals & Future${NC}"
# Move v2-roadmap folder and proposals
mv docs/v2-roadmap docs/exhibit/06-proposals/ 2>/dev/null && echo "  ✓ v2-roadmap/ (entire folder)" && ((moved++)) || true
mv docs/proposals docs/exhibit/06-proposals/future-proposals 2>/dev/null && echo "  ✓ proposals/ (entire folder)" && ((moved++)) || true
mv docs/Roadmap_to_Friday.md docs/exhibit/06-proposals/ 2>/dev/null && echo "  ✓ Roadmap_to_Friday.md" && ((moved++)) || true
mv docs/EXTERNAL-DOCS-HOSTING.md docs/exhibit/06-proposals/ 2>/dev/null && echo "  ✓ EXTERNAL-DOCS-HOSTING.md" && ((moved++)) || true
mv docs/roadmap-platform-independence.md docs/exhibit/06-proposals/ 2>/dev/null && echo "  ✓ roadmap-platform-independence.md" && ((moved++)) || true

echo ""
echo -e "${GREEN}Summary${NC}"
echo "  Moved $moved documents to exhibit"
echo ""
echo -e "${YELLOW}Note: Some files may remain in docs/ if they're:${NC}"
echo "  - Current/active documentation (should stay in docs/core/)"
echo "  - Already moved in previous runs"
echo "  - System files (.gitkeep, etc.)"
echo ""
echo "✅ Reorganization complete!"
echo ""
echo "Next steps:"
echo "  1. Review docs/core/ for current docs"
echo "  2. Browse docs/exhibit/ for historical journey"
echo "  3. Update any broken links"
echo "  4. Commit changes"
