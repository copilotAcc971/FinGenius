-- Migration: Enable pgvector extension and optimize vector search for document_embeddings
-- Date: 2025-01-18
-- Description: Enable pgvector extension and create HNSW index for fast semantic search

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create HNSW index for vector similarity search on existing document_embeddings table
-- This index uses HNSW (Hierarchical Navigable Small World) algorithm for fast approximate nearest neighbor search
-- Note: document_embeddings table already exists in schema, we just need the vector index
CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx ON document_embeddings 
USING hnsw (embedding vector_cosine_ops);

-- Add comments for documentation
COMMENT ON TABLE document_embeddings IS 'Stores vector embeddings of financial documents for semantic search in AI Copilot';
COMMENT ON COLUMN document_embeddings.document_type IS 'Type of document: invoice, bill, journal_entry, memo, customer, vendor, account, other';
COMMENT ON COLUMN document_embeddings.document_id IS 'Foreign key to the source document (polymorphic)';
COMMENT ON COLUMN document_embeddings.content IS 'Text content/chunk that was embedded';
COMMENT ON COLUMN document_embeddings.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions)';
COMMENT ON COLUMN document_embeddings.metadata IS 'Additional context (customer name, date, amount, etc.)';
