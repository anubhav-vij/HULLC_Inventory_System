import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { query } from './index';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate() {
  console.log('Running database migrations...\n');

  // Ensure the tracking table exists before querying it
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT        PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Which migrations have already been applied?
  const { rows: applied } = await query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename'
  );
  const appliedSet = new Set(applied.map((r) => r.filename));

  // Discover .sql files in alphabetical order
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let ran = 0;

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  [skip] ${file}`);
      continue;
    }

    console.log(`  [run ] ${file} ...`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

    // Split on semicolons and run each statement individually via pool.query()
    // (autocommit mode).  This is required because ALTER TYPE ADD VALUE cannot
    // be used in the same transaction as statements that reference the new value.
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => {
        // Strip inline comments and check if anything meaningful remains
        const stripped = s.replace(/--[^\n]*/g, '').trim();
        return stripped.length > 0;
      });

    for (const stmt of statements) {
      await query(stmt);
    }

    // Record as applied
    await query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    console.log(`  [done] ${file}`);
    ran++;
  }

  console.log(`\nMigrations complete. ${ran} new migration(s) applied.`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('\nMigration failed:', err);
  process.exit(1);
});
