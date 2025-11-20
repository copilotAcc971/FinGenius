import { db } from '../db';
import { documentEmbeddings, type InsertDocumentEmbedding, type DocumentEmbedding } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

/**
 * Vector Store Service
 * Manages CRUD operations for vector embeddings in PostgreSQL with pgvector
 */

export class VectorStore {
  /**
   * Store a new embedding in the database
   */
  async storeEmbedding(params: {
    tenantId: string;
    documentType: string;
    documentId: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, any>;
  }): Promise<DocumentEmbedding> {
    const [result] = await db.insert(documentEmbeddings).values({
      tenantId: params.tenantId,
      documentType: params.documentType,
      documentId: params.documentId,
      content: params.content,
      embedding: params.embedding,
      metadata: params.metadata || null,
    }).returning();

    return result;
  }

  /**
   * Update an existing embedding
   */
  async updateEmbedding(params: {
    tenantId: string;
    documentType: string;
    documentId: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, any>;
  }): Promise<DocumentEmbedding | null> {
    const [result] = await db
      .update(documentEmbeddings)
      .set({
        content: params.content,
        embedding: params.embedding,
        metadata: params.metadata || null,
      })
      .where(
        and(
          eq(documentEmbeddings.tenantId, params.tenantId),
          eq(documentEmbeddings.documentType, params.documentType),
          eq(documentEmbeddings.documentId, params.documentId)
        )
      )
      .returning();

    return result || null;
  }

  /**
   * Upsert an embedding (insert or update if exists)
   */
  async upsertEmbedding(params: {
    tenantId: string;
    documentType: string;
    documentId: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, any>;
  }): Promise<DocumentEmbedding> {
    // Check if embedding exists
    const existing = await this.getEmbedding(
      params.tenantId,
      params.documentType,
      params.documentId
    );

    if (existing) {
      const updated = await this.updateEmbedding(params);
      return updated!;
    } else {
      return await this.storeEmbedding(params);
    }
  }

  /**
   * Get a specific embedding by document
   */
  async getEmbedding(
    tenantId: string,
    documentType: string,
    documentId: string
  ): Promise<DocumentEmbedding | null> {
    const [result] = await db
      .select()
      .from(documentEmbeddings)
      .where(
        and(
          eq(documentEmbeddings.tenantId, tenantId),
          eq(documentEmbeddings.documentType, documentType),
          eq(documentEmbeddings.documentId, documentId)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Delete an embedding
   */
  async deleteEmbedding(
    tenantId: string,
    documentType: string,
    documentId: string
  ): Promise<boolean> {
    const result = await db
      .delete(documentEmbeddings)
      .where(
        and(
          eq(documentEmbeddings.tenantId, tenantId),
          eq(documentEmbeddings.documentType, documentType),
          eq(documentEmbeddings.documentId, documentId)
        )
      );

    return true;
  }

  /**
   * Semantic search using cosine similarity
   * Returns the most similar documents to the query embedding
   */
  async searchSimilar(params: {
    tenantId: string;
    queryEmbedding: number[];
    limit?: number;
    documentTypes?: string[];
    minSimilarity?: number;
  }): Promise<Array<DocumentEmbedding & { similarity: number }>> {
    const { tenantId, queryEmbedding, limit = 10, documentTypes, minSimilarity = 0.7 } = params;

    // Build WHERE clause
    let whereClause = eq(documentEmbeddings.tenantId, tenantId);
    
    // pgvector cosine similarity: 1 - (embedding <=> query_embedding)
    // Higher values = more similar
    const similarityExpr = sql`1 - (${documentEmbeddings.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`;

    let query = db
      .select({
        id: documentEmbeddings.id,
        tenantId: documentEmbeddings.tenantId,
        documentType: documentEmbeddings.documentType,
        documentId: documentEmbeddings.documentId,
        content: documentEmbeddings.content,
        embedding: documentEmbeddings.embedding,
        metadata: documentEmbeddings.metadata,
        createdAt: documentEmbeddings.createdAt,
        similarity: similarityExpr,
      })
      .from(documentEmbeddings)
      .where(whereClause);

    // Filter by document types if specified
    if (documentTypes && documentTypes.length > 0) {
      query = query.where(
        and(
          whereClause,
          sql`${documentEmbeddings.documentType} = ANY(${documentTypes})`
        )
      );
    }

    // Order by similarity (descending) and apply limit
    const results = await query
      .orderBy(desc(similarityExpr))
      .limit(limit);

    // Filter by minimum similarity threshold
    return results.filter(r => r.similarity >= minSimilarity);
  }

  /**
   * Get all embeddings for a tenant (paginated)
   */
  async getEmbeddingsByTenant(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      documentType?: string;
    }
  ): Promise<DocumentEmbedding[]> {
    const { limit = 100, offset = 0, documentType } = options || {};

    let query = db
      .select()
      .from(documentEmbeddings)
      .where(eq(documentEmbeddings.tenantId, tenantId));

    if (documentType) {
      query = query.where(
        and(
          eq(documentEmbeddings.tenantId, tenantId),
          eq(documentEmbeddings.documentType, documentType)
        )
      );
    }

    return await query
      .orderBy(desc(documentEmbeddings.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Count embeddings for a tenant
   */
  async countEmbeddings(tenantId: string, documentType?: string): Promise<number> {
    let whereClause = eq(documentEmbeddings.tenantId, tenantId);

    if (documentType) {
      whereClause = and(whereClause, eq(documentEmbeddings.documentType, documentType));
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documentEmbeddings)
      .where(whereClause);

    return result?.count || 0;
  }

  /**
   * Delete all embeddings for a specific document type
   */
  async deleteEmbeddingsByType(tenantId: string, documentType: string): Promise<void> {
    await db
      .delete(documentEmbeddings)
      .where(
        and(
          eq(documentEmbeddings.tenantId, tenantId),
          eq(documentEmbeddings.documentType, documentType)
        )
      );
  }

  /**
   * Batch store embeddings
   */
  async batchStoreEmbeddings(
    items: Array<{
      tenantId: string;
      documentType: string;
      documentId: string;
      content: string;
      embedding: number[];
      metadata?: Record<string, any>;
    }>
  ): Promise<DocumentEmbedding[]> {
    if (items.length === 0) {
      return [];
    }

    return await db
      .insert(documentEmbeddings)
      .values(items.map(item => ({
        ...item,
        metadata: item.metadata || null,
      })))
      .returning();
  }
}

// Singleton instance
let vectorStoreInstance: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore();
  }
  return vectorStoreInstance;
}
