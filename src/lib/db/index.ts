import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// ---------------------------------------------------------------------------
// Pool configuration
// ---------------------------------------------------------------------------

if (!process.env.DATABASE_URL) {
  throw new Error(
    '[db] DATABASE_URL environment variable is not set. ' +
    'Add it to your .env.local file (development) or your deployment environment.'
  );
}

const poolConfig = {
  connectionString: process.env.DATABASE_URL,

  // Enable SSL in production. Most cloud Postgres providers (Supabase, Neon,
  // Railway, etc.) require it. Set DATABASE_SSL=false to opt out explicitly.
  ssl:
    process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL !== 'false'
      ? { rejectUnauthorized: false }
      : false,

  // Keep the pool small — Next.js App Router runs many concurrent server-side
  // requests, so a large pool can exhaust database connection limits quickly.
  max: 10,

  // Release idle connections after 30 s to avoid holding them unnecessarily.
  idleTimeoutMillis: 30_000,

  // Fail fast if a connection cannot be acquired within 5 s, so API routes
  // return a clear error rather than hanging indefinitely.
  connectionTimeoutMillis: 5_000,
};

// ---------------------------------------------------------------------------
// Singleton pool — safe across Next.js App Router hot reloads
// ---------------------------------------------------------------------------
// In development, Next.js hot-reloads server modules on every file save. Each
// reload would normally create a new Pool, eventually exhausting the database's
// connection limit. Storing the pool on `globalThis` prevents that: the global
// object survives module re-evaluation, so we reuse the same pool for the
// entire dev server session.
//
// In production there is only one module evaluation, so we create the pool
// directly without touching globalThis.
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var _hullcPgPool: Pool | undefined;
}

function createPool(): Pool {
  const pool = new Pool(poolConfig);

  // Surface unexpected errors from idle clients (e.g. the database server
  // restarted). Without this handler the error would be an unhandled rejection
  // and could crash the Node process.
  pool.on('error', (err: Error) => {
    console.error('[db] Unexpected error on idle pool client:', err.message);
  });

  return pool;
}

const pool: Pool =
  process.env.NODE_ENV === 'production'
    ? createPool()
    : (globalThis._hullcPgPool ?? (globalThis._hullcPgPool = createPool()));

// ---------------------------------------------------------------------------
// query — single-query helper
// ---------------------------------------------------------------------------
// Use this for the vast majority of database calls: any SELECT, INSERT,
// UPDATE, or DELETE that does not need to share a connection with other
// queries.
//
// Usage:
//   const { rows } = await query<Product>(
//     'SELECT * FROM products WHERE id = $1',
//     [productId]
//   );
// ---------------------------------------------------------------------------

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(sql, params);
    const duration = Date.now() - start;

    // Log slow queries in development so performance issues surface early.
    if (process.env.NODE_ENV !== 'production' && duration > 200) {
      console.warn(`[db] Slow query (${duration}ms):`, sql);
    }

    return result;
  } catch (error) {
    console.error('[db] Query error:', {
      sql,
      params,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// getClient — manual transaction helper
// ---------------------------------------------------------------------------
// Use this when you need multiple queries to be atomic (all succeed or all
// roll back together). You are responsible for:
//   1. Calling BEGIN before your first query.
//   2. Calling COMMIT when all queries succeed.
//   3. Calling ROLLBACK in the catch block if anything fails.
//   4. Calling client.release() in a finally block — always, without fail.
//      Forgetting to release will silently exhaust the connection pool.
//
// Usage:
//   const client = await getClient();
//   try {
//     await client.query('BEGIN');
//     await client.query('UPDATE lots SET quantity = $1 WHERE id = $2', [qty, id]);
//     await client.query('INSERT INTO transactions ...', [...]);
//     await client.query('COMMIT');
//   } catch (error) {
//     await client.query('ROLLBACK');
//     throw error;
//   } finally {
//     client.release();
//   }
// ---------------------------------------------------------------------------

export async function getClient(): Promise<PoolClient> {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    console.error('[db] Failed to acquire client from pool:', {
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// withTransaction — convenience wrapper around getClient
// ---------------------------------------------------------------------------
// Handles BEGIN, COMMIT, ROLLBACK, and client.release() automatically so
// callers cannot forget to release the connection. Prefer this over using
// getClient directly unless you need fine-grained control.
//
// Usage:
//   const result = await withTransaction(async (client) => {
//     await client.query('UPDATE lots SET quantity = $1 WHERE id = $2', [qty, id]);
//     const { rows } = await client.query(
//       'INSERT INTO transactions (...) VALUES (...) RETURNING *',
//       [...]
//     );
//     return rows[0];
//   });
// ---------------------------------------------------------------------------

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[db] Transaction rolled back due to error:', {
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  } finally {
    // This always runs — even if ROLLBACK itself threw — so the client is
    // always returned to the pool.
    client.release();
  }
}
