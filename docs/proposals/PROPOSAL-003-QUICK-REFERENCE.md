# Specialized Search Agent - Quick Reference

**TL;DR:** Add a specialized AI research agent using Gemini Flash to handle web searches, reducing costs by 80-90% while improving quality through learned research methodologies.

---

## Problem → Solution

| Problem | Solution |
|---------|----------|
| 💸 **High Cost**: Research queries cost $0.30-$0.50 each | 🎯 Use Flash 2.0 for research: $0.02-$0.05 per query |
| 🐌 **Slow**: Primary LLM blocks on research tasks | ⚡ Parallel execution: 3-5 concurrent searches |
| 📉 **Inconsistent Quality**: No systematic research approach | 📚 Learn from "how-to" books, apply methodologies |
| 🔁 **Repeated Work**: Same queries searched multiple times | 💾 Semantic caching: 30-40% cache hit rate |

---

## Architecture at a Glance

```
User: "Research quantum error correction"
  ↓
Primary LLM (Gemini Pro) detects research intent
  ↓
Orchestrator → Routes to Search Agent
  ↓
Search Agent (Gemini Flash) ← Loads learned methodologies
  ├─ Checks cache (semantic matching)
  ├─ If cache miss:
  │   ├─ Analyzes query → Selects strategy
  │   ├─ Multi-source search (Tavily, Perplexity, Web)
  │   ├─ Filters noise, ranks by credibility
  │   └─ Synthesizes structured findings
  └─ Returns JSON with sources, quotes, confidence
  ↓
Primary LLM presents to user in natural language
```

---

## Cost Savings Example

### Current Approach (Primary LLM only)
- **Query**: "Find research on topological qubits"
- **Model**: Gemini Pro 1.5
- **Tokens**: 55K input + 2K output
- **Cost**: **$0.35** per query

### Proposed Approach (Search Agent)
- **Query**: Same
- **Model**: Gemini Flash 2.0
- **Tokens**: 52K input + 2K output
- **Cost**: **$0.04** per query
- **With 35% cache hits**: **~$0.026** per query

### Monthly Savings
- **100 research queries/month**
- **Current**: $35/month
- **Proposed**: $2.60/month
- **Savings**: **$32.40/month** (93% reduction)

---

## Learning from Books - How It Works

### 1. User Uploads "The Art of Advanced Googling"

Book teaches:
- Use `site:arxiv.org` for academic papers
- Use quotes for exact phrases: `"quantum error correction"`
- Exclude noise: `-cryptocurrency -stocks`
- Prioritize recent papers: `after:2024`

### 2. Agent Extracts Patterns

```json
{
  "methodology": "advanced_search_operators",
  "patterns": [
    {"name": "site_restriction", "syntax": "site:domain.com"},
    {"name": "exact_phrase", "syntax": "\"phrase\""},
    {"name": "exclude_terms", "syntax": "-term"}
  ]
}
```

### 3. Agent Applies to Future Queries

User: "Find papers on topological qubits"

Agent automatically uses:
```
"topological qubits" site:arxiv.org -cryptocurrency after:2024
```

Result: **High-quality academic sources, no noise**

---

## Implementation Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1**: Core Infrastructure | 1 week | Agent service, orchestrator integration, basic search |
| **Phase 2**: Advanced Strategies | 1 week | Multi-source search, filtering, ranking |
| **Phase 3**: Methodology Learning | 1 week | RAG pipeline, book ingestion, dynamic prompts |
| **Phase 4**: Cost Optimization | 1 week | Semantic caching, tiered models, budget controls |
| **Phase 5**: UI & UX | 1 week | Research controls, methodology viewer, history |

**Total**: 5 weeks to full implementation

---

## Key Files Created

1. **[PROPOSAL-003-specialized-search-agent.md](./PROPOSAL-003-specialized-search-agent.md)** (1,477 lines)
   - Complete technical proposal
   - Architecture diagrams
   - Database schemas
   - Sample code
   - Cost analysis
   - Risk mitigation

2. **[EXAMPLE-methodology-learning-workflow.md](./EXAMPLE-methodology-learning-workflow.md)** (562 lines)
   - Step-by-step walkthrough
   - Real book ingestion example
   - Applied to quantum computing query
   - JSON structures
   - User feedback loop

3. **[Master Roadmap](../v2-roadmap/MASTER-ROADMAP.md)** (updated)
   - Added as Tier 2 Architecture Foundation
   - Priority 5b
   - Status: Proposed

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Cost Reduction | 80%+ | Compare cost per research query |
| Response Time | 50% faster | Track time from query → response |
| Cache Hit Rate | 30-40% | Count cache hits vs misses |
| Research Quality | 4.0+ / 5.0 | User ratings after each search |
| Methodology Application | 70%+ | % queries that trigger methodology |

---

## Quick Links

- 📋 [Full Proposal](./PROPOSAL-003-specialized-search-agent.md)
- 📖 [Learning Example](./EXAMPLE-methodology-learning-workflow.md)
- 🗺️ [Master Roadmap](../v2-roadmap/MASTER-ROADMAP.md)
- 🏗️ [Orchestrator Service](../../server/services/orchestrator.ts)
- 🤖 [Agent Registry](../../server/services/agent-registry.ts)
- 🔍 [Tavily Integration](../../server/integrations/tavily.ts)
- 🔍 [Perplexity Integration](../../server/integrations/perplexity.ts)

---

## Next Steps

### For Reviewers:
1. Read the [full proposal](./PROPOSAL-003-specialized-search-agent.md)
2. Review the [methodology learning example](./EXAMPLE-methodology-learning-workflow.md)
3. Provide feedback on:
   - Architecture approach
   - Cost assumptions
   - Implementation timeline
   - Success metrics

### For Implementation:
1. **Phase 1**: Create `server/services/search-agent.ts`
2. **Phase 1**: Add database tables for research cache & methodologies
3. **Phase 1**: Register agent in orchestrator
4. **Phase 2**: Implement multi-source search
5. **Phase 3**: Build methodology RAG pipeline

---

## FAQ

**Q: Why not just use the primary LLM for everything?**  
A: Cost and efficiency. Research tasks consume massive context (50K+ tokens) but don't require the most advanced model. Flash is 90% cheaper and good enough for research.

**Q: What if Search Agent produces lower quality results?**  
A: We implement confidence scoring and fallback to primary LLM for low-confidence results. User feedback loop continuously improves quality.

**Q: How is this different from just using Tavily or Perplexity directly?**  
A: Search Agent orchestrates multiple sources, applies learned methodologies, filters noise, and synthesizes findings into structured format. It's intelligent search + synthesis, not just raw API calls.

**Q: Can users customize research methodologies?**  
A: Yes! Phase 3 includes methodology upload and management. Users can add domain-specific research guides.

**Q: What happens if a methodology becomes outdated?**  
A: Methodologies track success rates. If performance drops, they can be deprecated. New methodologies can be added anytime.

---

## Visual: Current vs Proposed Flow

### Current Flow
```
User → Primary LLM (Pro 1.5) → [Processes everything] → User
       [$$$, slow, blocks on research]
```

### Proposed Flow
```
User → Primary LLM (Pro 1.5) → [Detects intent, routes]
                ↓
       Orchestrator → [Task routing]
                ↓
       Search Agent (Flash 2.0) → [Specialized research]
         ├─ Checks cache (fast)
         ├─ Multi-source search
         ├─ Filters & ranks
         └─ Synthesizes findings
                ↓
       Primary LLM → [Present naturally] → User
       [$, fast, non-blocking]
```

---

**Status**: 📋 Proposal complete, ready for review  
**Impact**: 🚀 High (cost savings + quality improvement)  
**Effort**: 📅 5 weeks  
**Risk**: 🟢 Low (fallback to current system always available)
