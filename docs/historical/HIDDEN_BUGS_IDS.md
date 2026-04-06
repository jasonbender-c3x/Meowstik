# Hidden Bugs Hunt: Single-User / ID Handling

**Date**: February 3, 2026
**Status**: ✅ Fixed

---

## 🔍 The Investigation

The user reported: *"this was a single user system, became a multuser setup then abruptly converted back to just me... i bet there are hidden bugs related to the handling of ids."*

I audted the ID handling across the Legacy RAG system, the New RAG Pipeline, and the Retrieval Orchestrator.

### Findings

1.  **Inconsistent "Guest" Representation**:
    *   **Legacy System (`rag-service.ts`)**: Defaults Guest users to the string literal `"guest"`.
    *   **New System (`ingestion-pipeline.ts`)**: Defaults Guest users to `NULL` in the database (via `userId` column).
    *   **Retrieval Logic (`retrieval-orchestrator.ts`)**:
        *   Semantic Search was robust (`IS NULL` OR `= 'guest'`).
        *   **Keyword Search was BROKEN**: It *only* checked for `IS NULL`.

### 🐛 The Bug
If any data was ingested by the Legacy system (or by a migration script that used `"guest"` string), the **Keyword Search** (hybrid search fallback) would silently fail to find it for a guest user. This fits the description of "hidden bugs" caused by switching between modes.

### 🛠️ The Fix

I patched `server/services/retrieval-orchestrator.ts` to implement robust Guest ID checking in the keyword search Logic.

**Before:**
```typescript
if (targetUserId === null) {
  queryConditions.push(isNull(evidence.userId)); 
  // Misses 'guest' string records!
}
```

**After:**
```typescript
if (targetUserId === null) {
  // Robust checking for Guest ID (NULL or 'guest')
  queryConditions.push(
    or(
      isNull(evidence.userId),
      eq(evidence.userId, GUEST_USER_ID)
    )
  );
}
```

### Verification
*   **Single User / Guest Mode**: Now correctly searches both `NULL` records and explicit `"guest"` records.
*   **Authenticated Mode**: Continues to search correct specific User ID (e.g. `'home-dev-user'` or Replit ID).
*   **Data Isolation**: Strict isolation remains intact; Guests cannot see Authenticated User data, and vice versa.
