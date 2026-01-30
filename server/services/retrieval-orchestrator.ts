import { storage } from '../storage';
import { evidence, entities, entityMentions, knowledgeEmbeddings, crossReferences, Evidence, Entity } from '@shared/schema';
import { eq, sql, ilike, desc, or, and, isNull } from 'drizzle-orm';
import { ingestionPipeline, KnowledgeBucket } from './ingestion-pipeline';
import { EmbeddingService } from './embedding-service';
import { hybridSearchService } from './hybrid-search';
import { rerankerService } from './reranker';
import { ragService } from './rag-service';

const embeddingService = new EmbeddingService();

function getDb() {
  return storage.getDb();
}

export interface RetrievalContext {
  query: string;
  buckets?: KnowledgeBucket[];
  maxTokens?: number;
  includeEntities?: boolean;
  includeCrossRefs?: boolean;
  userId?: string | null; // CRITICAL: Add userId for data isolation
  useHybridSearch?: boolean; // Enable BM25 + semantic hybrid search
  useReranking?: boolean; // Enable re-ranking for improved precision
  topK?: number; // Number of results to return (default: 20)
}

export interface RetrievedItem {
  type: 'evidence' | 'entity' | 'cross_ref';
  id: string;
  content: string;
  score: number;
  bucket?: string;
  modality?: string;
  metadata?: Record<string, unknown>;
}

export interface RetrievalResult {
  items: RetrievedItem[];
  totalTokensUsed: number;
  queryEmbeddingTime: number;
  searchTime: number;
}

export class RetrievalOrchestrator {
  private readonly MAX_CONTEXT_TOKENS = 8000;
  private readonly CHARS_PER_TOKEN = 4;

  async retrieve(context: RetrievalContext): Promise<RetrievalResult> {
    const startTime = Date.now();
    const items: RetrievedItem[] = [];
    const maxTokens = context.maxTokens || this.MAX_CONTEXT_TOKENS;
    const topK = context.topK || 20;
    const useHybridSearch = context.useHybridSearch ?? true; // Enable by default
    const useReranking = context.useReranking ?? true; // Enable by default

    const semanticStartTime = Date.now();
    
    // Step 1: Initial semantic search (vector similarity)
    const semanticResults = await ingestionPipeline.semanticSearch(context.query, {
      limit: topK * 2,  // Get more candidates for hybrid search
      threshold: 0.25,  // Lowered threshold for better recall
      bucket: context.buckets?.[0],
      userId: context.userId, // CRITICAL: Pass userId for data isolation
    });
    const semanticTime = Date.now() - semanticStartTime;

    // Convert semantic results to items
    for (const result of semanticResults) {
      items.push({
        type: 'evidence',
        id: result.evidenceId,
        content: result.content,
        score: result.score,
      });
    }

    // Step 2: Apply hybrid search (BM25 + semantic fusion) if enabled
    let finalItems = items;
    if (useHybridSearch && items.length > 0) {
      try {
        // Try to use RAG service for hybrid search if document chunks are available
        const ragResult = await ragService.retrieveAdvanced(
          context.query,
          context.userId,
          {
            topK,
            useHybridSearch: true,
            useReranking: false, // We'll apply re-ranking separately
            useContextSynthesis: false,
            maxTokens,
          }
        );

        // Convert RAG chunks to RetrievedItems
        finalItems = ragResult.chunks.map((chunk, i) => ({
          type: 'evidence' as const,
          id: chunk.id.toString(),
          content: chunk.content,
          score: ragResult.scores[i],
        }));

        console.log(`[RetrievalOrchestrator] Hybrid search: ${finalItems.length} results`);
      } catch (error) {
        console.warn('[RetrievalOrchestrator] Hybrid search failed, using semantic-only results:', error);
        // Fallback to basic keyword merging
        const keywordResults = await this.keywordSearch(context.query, 10, context.buckets, context.userId);
        for (const result of keywordResults) {
          if (!finalItems.find(i => i.id === result.id)) {
            finalItems.push(result);
          }
        }
      }
    } else {
      // Basic keyword search fallback if hybrid is disabled
      const keywordResults = await this.keywordSearch(context.query, 10, context.buckets, context.userId);
      for (const result of keywordResults) {
        if (!finalItems.find(i => i.id === result.id)) {
          finalItems.push(result);
        }
      }
    }

    // Step 3: Apply re-ranking if enabled
    if (useReranking && finalItems.length > 1) {
      try {
        // Re-rank for improved precision
        // Note: We can't directly use rerankerService because it works with DocumentChunks
        // Instead, we use score-based sorting with diversity consideration
        finalItems.sort((a, b) => b.score - a.score);
        
        // Apply simple diversity filtering (avoid very similar results)
        const diverseItems: RetrievedItem[] = [];
        for (const item of finalItems) {
          const tooSimilar = diverseItems.some(existing => {
            // Simple Jaccard similarity check
            const words1 = new Set(item.content.toLowerCase().split(/\s+/));
            const words2 = new Set(existing.content.toLowerCase().split(/\s+/));
            const intersection = new Set([...words1].filter(x => words2.has(x)));
            const union = new Set([...words1, ...words2]);
            const similarity = intersection.size / union.size;
            return similarity > 0.7; // 70% similarity threshold
          });
          
          if (!tooSimilar) {
            diverseItems.push(item);
          }
          
          if (diverseItems.length >= topK) break;
        }
        
        finalItems = diverseItems;
        console.log(`[RetrievalOrchestrator] Re-ranking applied: ${finalItems.length} diverse results`);
      } catch (error) {
        console.warn('[RetrievalOrchestrator] Re-ranking failed, using unranked results:', error);
      }
    } else {
      finalItems.sort((a, b) => b.score - a.score);
    }

    // Step 4: Add entities and cross-references if requested
    if (context.includeEntities !== false) {
      const entityResults = await this.findRelatedEntities(context.query, 5);
      finalItems.push(...entityResults);
    }

    if (context.includeCrossRefs) {
      const crossRefResults = await this.findCrossReferences(finalItems.map(i => i.id), 5);
      finalItems.push(...crossRefResults);
    }

    // Step 5: Token-aware filtering to fit within maxTokens
    let totalChars = 0;
    const maxChars = maxTokens * this.CHARS_PER_TOKEN;
    const filteredItems: RetrievedItem[] = [];

    for (const item of finalItems) {
      const itemChars = item.content.length;
      if (totalChars + itemChars <= maxChars) {
        filteredItems.push(item);
        totalChars += itemChars;
      } else {
        break; // Stop when we hit the token limit
      }
    }

    return {
      items: filteredItems,
      totalTokensUsed: Math.ceil(totalChars / this.CHARS_PER_TOKEN),
      queryEmbeddingTime: semanticTime,
      searchTime: Date.now() - startTime,
    };
  }

  private async keywordSearch(query: string, limit: number, buckets?: KnowledgeBucket[], userId?: string | null): Promise<RetrievedItem[]> {
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    if (keywords.length === 0) return [];

    const results: RetrievedItem[] = [];

    for (const keyword of keywords.slice(0, 3)) {
      // Build query with userId filter at database level
      let queryConditions: any[] = [
        or(
          ilike(evidence.title, `%${keyword}%`),
          ilike(evidence.extractedText, `%${keyword}%`),
          ilike(evidence.summary, `%${keyword}%`)
        )
      ];

      // CRITICAL: Add userId filter at database level
      if (userId !== undefined) {
        const targetUserId = userId || null;
        if (targetUserId === null) {
          queryConditions.push(isNull(evidence.userId));
        } else {
          queryConditions.push(eq(evidence.userId, targetUserId));
        }
      }

      let matches = await getDb().select()
        .from(evidence)
        .where(and(...queryConditions))
        .limit(limit * 2);

      // In-memory filter for buckets (no index yet)
      if (buckets && buckets.length > 0) {
        matches = matches.filter(m => m.bucket && buckets.includes(m.bucket as KnowledgeBucket));
      }

      for (const match of matches) {
        if (!results.find(r => r.id === match.id)) {
          const content = match.summary || match.extractedText || match.title || '';
          results.push({
            type: 'evidence',
            id: match.id,
            content: content.slice(0, 1000),
            score: 0.3,
            bucket: match.bucket || undefined,
            modality: match.modality,
          });
        }
      }
    }

    return results.slice(0, limit);
  }

  private async findCrossReferences(itemIds: string[], limit: number): Promise<RetrievedItem[]> {
    if (itemIds.length === 0) return [];
    
    const results: RetrievedItem[] = [];
    
    for (const sourceId of itemIds.slice(0, 3)) {
      const refs = await getDb().select()
        .from(crossReferences)
        .where(eq(crossReferences.sourceId, sourceId))
        .limit(limit);
      
      for (const ref of refs) {
        if (ref.targetType === 'evidence' && ref.targetId) {
          const [targetEvidence] = await getDb().select()
            .from(evidence)
            .where(eq(evidence.id, ref.targetId));
          
          if (targetEvidence && !results.find(r => r.id === targetEvidence.id)) {
            const content = targetEvidence.summary || targetEvidence.extractedText || '';
            results.push({
              type: 'cross_ref',
              id: targetEvidence.id,
              content: `[Related: ${ref.relationshipType}] ${content.slice(0, 500)}`,
              score: (ref.strength || 50) / 200,
              bucket: targetEvidence.bucket || undefined,
              metadata: {
                relationshipType: ref.relationshipType,
                reason: ref.reason,
              },
            });
          }
        }
      }
    }
    
    return results.slice(0, limit);
  }

  private async findRelatedEntities(query: string, limit: number): Promise<RetrievedItem[]> {
    const entityMatches = await ingestionPipeline.searchEntities(query, limit);
    
    return entityMatches.map(entity => ({
      type: 'entity' as const,
      id: entity.id,
      content: `[ENTITY: ${entity.type}] ${entity.name}${entity.description ? `: ${entity.description}` : ''}`,
      score: 0.25,
      metadata: {
        entityType: entity.type,
        mentionCount: entity.mentionCount,
      },
    }));
  }

  formatForPrompt(result: RetrievalResult): string {
    if (result.items.length === 0) {
      return '';
    }

    const sections: string[] = [];

    const evidenceItems = result.items.filter(i => i.type === 'evidence');
    if (evidenceItems.length > 0) {
      sections.push('## Relevant Knowledge\n');
      for (const item of evidenceItems) {
        const bucketTag = item.bucket ? `[${item.bucket}] ` : '';
        sections.push(`${bucketTag}${item.content}\n`);
      }
    }

    const entityItems = result.items.filter(i => i.type === 'entity');
    if (entityItems.length > 0) {
      sections.push('\n## Known Entities\n');
      for (const item of entityItems) {
        sections.push(`- ${item.content}\n`);
      }
    }

    return sections.join('');
  }

  async enrichPrompt(userMessage: string, systemContext: string = '', userId?: string | null): Promise<string> {
    const retrievalResult = await this.retrieve({
      query: userMessage,
      maxTokens: 4000,
      includeEntities: true,
      userId, // CRITICAL: Pass userId for data isolation
      useHybridSearch: true, // Enable hybrid search (BM25 + semantic)
      useReranking: true, // Enable re-ranking for improved precision
      topK: 20, // Retrieve top 20 results
    });

    const knowledgeContext = this.formatForPrompt(retrievalResult);

    if (!knowledgeContext) {
      return systemContext;
    }

    return `${systemContext}\n\n<retrieved_knowledge>\n${knowledgeContext}\n</retrieved_knowledge>`;
  }

  async getStats(): Promise<{
    totalEmbeddings: number;
    totalEvidence: number;
    totalEntities: number;
    bucketDistribution: Record<string, number>;
  }> {
    const embeddings = await getDb().select().from(knowledgeEmbeddings);
    const allEvidence = await getDb().select().from(evidence);
    const allEntities = await getDb().select().from(entities);

    const bucketDistribution: Record<string, number> = {};
    for (const e of allEvidence) {
      if (e.bucket) {
        bucketDistribution[e.bucket] = (bucketDistribution[e.bucket] || 0) + 1;
      }
    }

    return {
      totalEmbeddings: embeddings.length,
      totalEvidence: allEvidence.length,
      totalEntities: allEntities.length,
      bucketDistribution,
    };
  }
}

export const retrievalOrchestrator = new RetrievalOrchestrator();
