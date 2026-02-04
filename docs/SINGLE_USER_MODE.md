# Single-User "God Mode" Implementation

**Date**: February 3, 2026
**Status**: ✅ Active

---

## 🚀 Overview

To simplify the system for a personal/single-user deployment, we have explicitly **removed** User ID filtering from all Retrieval and Search pipelines.

## 🛠️ Changes Implemented

The system now "ignores" the `userId` / `clientId` when fetching data. It will return **ALL** matching knowledge, documents, and evidence, regardless of who created it (You, Guest, or old system data).

### 1. Ingestion Pipeline (`ingestion-pipeline.ts`)
*   **Semantic Search**: Removed the database `WHERE` clause that filtered embeddings by `userId`.

### 2. RAG Service (`rag-service.ts`)
*   **Vector Search**: Removed `userId` from the metadata filter passed to the vector store.
*   **Legacy Search**: Commented out the array filtering logic that checked `chunk.metadata.userId`.

### 3. Retrieval Orchestrator (`retrieval-orchestrator.ts`)
*   **Semantic Step**: Stopped passing `userId` to the ingestion pipeline.
*   **Keyword Step**: Removed the massive complex logic block that tried to match `NULL` vs `"guest"` vs specific IDs. It now searches the entire `evidence` table.

## ⚠️ Security Note

This effectively disables tenant isolation for **Search/Retrieval**.
*   **Reading**: Anyone with access to the agent can search the entire database.
*   **Writing**: Ingestion still attempts to Record `userId` (to preserve the data structure), but it is ignored during read.

This is the desired state for a personal, single-user Meowstik instance.
