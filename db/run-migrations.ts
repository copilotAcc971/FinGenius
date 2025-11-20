#!/usr/bin/env tsx
/**
 * Database Migration Runner for Phase 8 Security Triggers
 * 
 * This script applies SQL migrations that cannot be expressed in Drizzle schema
 * (e.g., triggers, functions, row-level security). Must run after `npm run db:push`.
 * 
 * Usage:
 *   npm run db:migrate        - Apply all pending migrations
 *   npm run db:migrate:reset  - Drop and recreate all triggers (development only)
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🔒 Running Phase 8 Security Triggers Migration...\n');
    
    // Get all .sql files from migrations directory
    const migrationsDir = join(import.meta.dirname, 'migrations');
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Lexicographic sort ensures 001_, 002_, etc. run in order
    
    console.log(`Found ${files.length} migration file(s):`);
    files.forEach(f => console.log(`  - ${f}`));
    console.log();
    
    // Create migration tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _db_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    
    // Check which migrations have already been applied
    const { rows: appliedMigrations } = await client.query(
      'SELECT filename FROM _db_migrations'
    );
    const appliedSet = new Set(appliedMigrations.map(r => r.filename));
    
    // Apply each migration
    for (const filename of files) {
      if (appliedSet.has(filename)) {
        console.log(`⏭️  Skipping ${filename} (already applied)`);
        continue;
      }
      
      console.log(`📝 Applying ${filename}...`);
      const sql = readFileSync(join(migrationsDir, filename), 'utf-8');
      
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO _db_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`✅ Applied ${filename}\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to apply ${filename}:`);
        console.error(error);
        throw error;
      }
    }
    
    console.log('✅ All migrations applied successfully!\n');
    
    // Verify triggers were created
    const { rows: triggers } = await client.query(`
      SELECT 
        tgname AS trigger_name,
        tgrelid::regclass AS table_name,
        pg_get_triggerdef(oid) AS definition
      FROM pg_trigger
      WHERE tgname LIKE '%ai_log%' OR tgname LIKE '%integration%'
      ORDER BY tgrelid::regclass::text, tgname;
    `);
    
    console.log(`📋 Active Security Triggers (${triggers.length}):`);
    triggers.forEach(t => {
      console.log(`  ✓ ${t.table_name}.${t.trigger_name}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations
runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
