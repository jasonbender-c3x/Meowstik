# Vertex AI RAG Migration: Discussion and Decision Points

> **Status**: Ready for Discussion  
> **Date**: January 15, 2026  
> **Branch**: `copilot/migrate-rag-processing-to-vertex-ai`

---

## Summary

I've created comprehensive documentation for migrating Meowstik's RAG processing stack from pgvector to Vertex AI. The documentation is now complete and ready for review and discussion.

### Documentation Deliverables

1. **[README.md](./README.md)** - Index and quick start guide
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - 20KB comprehensive architectural analysis
3. **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - 30KB step-by-step implementation guide

---

## Key Design Decisions

### 1. Migration Strategy: Hybrid Approach ✅

**Decision**: Use a hybrid adapter that writes to both pgvector and Vertex AI simultaneously during migration.

**Rationale**:
- **Zero downtime**: Application continues working during migration
- **Data safety**: No risk of data loss with dual-write
- **Easy rollback**: Simple environment variable change
- **Gradual validation**: Can test Vertex AI with real traffic

**Alternative Considered**: Direct cutover (rejected due to risk)

### 2. Architecture: Adapter Pattern ✅

**Decision**: Maintain the existing adapter pattern with three implementations:
- `PgVectorAdapter` (existing)
- `VertexAdapter` (enhanced)
- `HybridAdapter` (new)

**Rationale**:
- **Minimal changes**: No changes to application code
- **Flexibility**: Can switch backends via configuration
- **Testing**: Can run both backends in parallel
- **Future-proof**: Easy to add more backends later

**Alternative Considered**: Rewrite RAG service (rejected - too invasive)

### 3. Data Model: Keep Evidence Table ✅

**Decision**: Continue using the `evidence` table for metadata, add Vertex AI reference fields.

**Rationale**:
- **Business logic**: Evidence table contains important metadata
- **Cross-references**: Entity relationships still managed in PostgreSQL
- **Hybrid queries**: Can combine Vertex AI results with database metadata

**Changes**:
```sql
ALTER TABLE evidence
  ADD COLUMN vertex_rag_file_id TEXT,
  ADD COLUMN vertex_corpus_name TEXT;
```

### 4. Rollout: Gradual with Feature Flags ✅

**Decision**: Gradual rollout: 10% → 25% → 50% → 75% → 100%

**Rationale**:
- **Risk mitigation**: Can catch issues early
- **Performance validation**: Monitor latency and costs
- **User impact**: Minimize blast radius of potential issues

**Implementation**:
```bash
VECTOR_STORE_BACKEND=hybrid
VERTEX_ROLLOUT_PERCENTAGE=10  # Start with 10%
```

---

## Discussion Points

### 🔴 Critical Decisions Required

#### 1. GCP Project Setup

**Question**: Should we use an existing GCP project or create a dedicated one for Vertex AI?

**Options**:
- **Option A**: Use existing Meowstik GCP project
  - ✅ Simpler setup
  - ❌ Shared billing and quotas
  
- **Option B**: Create dedicated project
  - ✅ Isolated billing and quotas
  - ✅ Easier to monitor costs
  - ❌ Additional setup complexity

**Recommendation**: Option B (dedicated project) for better cost tracking

#### 2. Service Account Permissions

**Question**: What level of permissions should the service account have?

**Options**:
- **Option A**: Minimal (roles/aiplatform.user)
  - ✅ Most secure
  - ❌ May need additional permissions later
  
- **Option B**: Full access (roles/aiplatform.admin)
  - ✅ No permission issues
  - ❌ Security risk

**Recommendation**: Option A (minimal) - can always add more

#### 3. Corpus Organization

**Question**: How should we organize Vertex AI RAG corpora?

**Options**:
- **Option A**: Single corpus for all knowledge
  - ✅ Simpler management
  - ❌ No isolation between buckets
  
- **Option B**: Separate corpus per bucket (PERSONAL_LIFE, CREATOR, PROJECTS)
  - ✅ Better organization
  - ✅ Easier to filter results
  - ❌ More complex to manage

**Recommendation**: Option B (separate corpora) for better organization

#### 4. Migration Timeline

**Question**: When should we start implementation?

**Options**:
- **Option A**: Immediately after approval
  - ✅ Faster delivery
  - ❌ May miss edge cases
  
- **Option B**: After thorough review (1 week)
  - ✅ More robust plan
  - ❌ Delayed delivery

**Recommendation**: Option B (1 week review) - architecture is complex

### 🟡 Medium Priority Decisions

#### 5. Embedding Service

**Question**: Should we migrate embedding generation to Vertex AI Embeddings API?

**Current**: Direct calls to Gemini API  
**Proposed**: Use Vertex AI Embeddings API (same model, different endpoint)

**Pros**:
- Centralized API management
- Better monitoring through GCP
- Potential cost savings (volume discounts)

**Cons**:
- Additional API calls
- Slightly higher latency
- Migration complexity

**Recommendation**: Keep direct Gemini API initially, migrate embeddings later

#### 6. Historical Data Migration

**Question**: Should we migrate existing pgvector data to Vertex AI?

**Options**:
- **Option A**: Migrate all historical data
  - ✅ Complete migration
  - ❌ Time-consuming
  - ❌ Cost (ingestion)
  
- **Option B**: Keep historical data in pgvector, new data in Vertex AI
  - ✅ Faster migration
  - ✅ Lower cost
  - ❌ Hybrid system longer-term

**Recommendation**: Option B - migrate historical data in Phase 2 (after validation)

### 🟢 Low Priority Decisions

#### 7. Monitoring and Alerting

**Question**: What monitoring should we implement?

**Recommendation**:
- GCP Cloud Monitoring for Vertex AI metrics
- Application logs for adapter operations
- Custom dashboard for migration progress
- Alerts for error rates >1%, latency >500ms

#### 8. Cost Budget

**Question**: What's the acceptable monthly cost increase?

**Current Cost**: $10-50/month (PostgreSQL)  
**Projected Cost**: $30-150/month (Vertex AI)

**Recommendation**: Set budget alert at $100/month initially

---

## Implementation Readiness Checklist

### Prerequisites

- [ ] **Architecture Review**: Stakeholders review ARCHITECTURE.md
- [ ] **Implementation Review**: Team reviews IMPLEMENTATION_GUIDE.md
- [ ] **GCP Project**: Create or designate GCP project
- [ ] **Service Account**: Create service account with appropriate permissions
- [ ] **Budget Approval**: Approve projected cost increase ($10-50/month)
- [ ] **Timeline Approval**: Confirm 2-3 week implementation timeline

### Phase 1: Setup (Days 1-2)

- [ ] Enable Vertex AI API in GCP project
- [ ] Create service account and download key
- [ ] Configure environment variables
- [ ] Install dependencies (`@google-cloud/aiplatform`, etc.)
- [ ] Run health checks

### Phase 2: Implementation (Days 3-7)

- [ ] Enhance Vertex AI adapter with improved authentication
- [ ] Implement HybridAdapter for parallel operation
- [ ] Update factory function to support hybrid mode
- [ ] Add configuration management for feature flags
- [ ] Create test scripts

### Phase 3: Testing (Days 8-10)

- [ ] Unit tests for Vertex AI adapter
- [ ] Integration tests for hybrid adapter
- [ ] End-to-end RAG pipeline tests
- [ ] Performance benchmarks (latency, throughput)
- [ ] Cost validation

### Phase 4: Deployment (Days 11-14)

- [ ] Deploy to staging in hybrid mode
- [ ] Validate parallel operation (both backends)
- [ ] Gradual rollout (10% → 25% → 50% → 75% → 100%)
- [ ] Monitor metrics and costs
- [ ] Data migration (if approved)

---

## Risk Mitigation

| Risk | Mitigation Strategy | Contingency Plan |
|------|-------------------|------------------|
| **Vertex AI outage** | Monitor GCP status page | Automatic fallback to pgvector |
| **Cost overrun** | Daily cost monitoring, budget alerts | Reduce traffic percentage |
| **Performance degradation** | Benchmarking, gradual rollout | Rollback to pgvector |
| **Data loss** | Dual-write during migration | pgvector as source of truth |
| **Authentication issues** | Multiple auth methods (ADC, gcloud, token) | Clear documentation |

---

## Success Criteria

The migration will be considered successful when:

1. ✅ **Functionality**: 100% of RAG operations work via Vertex AI
2. ✅ **Performance**: p95 latency <500ms (acceptable increase from pgvector)
3. ✅ **Reliability**: 99.9% uptime maintained
4. ✅ **Cost**: Monthly costs within approved budget
5. ✅ **Operations**: 50% reduction in maintenance overhead

---

## Next Steps

### Immediate (This Week)

1. **Review Documentation**: Team reviews all three documents
2. **Decision Making**: Resolve all critical discussion points above
3. **GCP Setup**: Create project and service account
4. **Budget Approval**: Get approval for projected costs

### Short-term (Week 2)

1. **Implementation**: Start Phase 2 (Vertex AI adapter implementation)
2. **Testing**: Create comprehensive test suite
3. **Validation**: Verify all functionality works as expected

### Medium-term (Weeks 3-4)

1. **Deployment**: Gradual rollout to production
2. **Monitoring**: Track metrics and costs
3. **Optimization**: Performance tuning based on real data
4. **Documentation**: Update based on learnings

---

## Questions for Stakeholders

1. **Timing**: Is now the right time for this migration, or should we wait for a quieter period?

2. **Budget**: Are we comfortable with a $10-50/month increase in infrastructure costs?

3. **Priorities**: Should we prioritize speed (2 weeks) or thoroughness (4 weeks)?

4. **Scope**: Should we migrate historical data or only new ingestion?

5. **Rollback**: What's our tolerance for issues? At what point should we roll back?

6. **Success Definition**: Are the success criteria listed above acceptable?

---

## Approval Workflow

Please review and approve:

- [ ] **Architecture**: ARCHITECTURE.md reviewed and approved
- [ ] **Implementation**: IMPLEMENTATION_GUIDE.md reviewed and approved
- [ ] **Budget**: Cost increase approved
- [ ] **Timeline**: 2-3 week timeline approved
- [ ] **Decisions**: All critical discussion points resolved
- [ ] **Ready to Implement**: Green light to proceed with Phase 2

---

## Contact

For questions or concerns:
- Review the documentation in this directory
- Open discussion in team channel
- Schedule architecture review meeting if needed

---

*This discussion document is part of the Vertex AI RAG migration project.*  
*Please provide feedback and approval before we proceed with implementation.*
