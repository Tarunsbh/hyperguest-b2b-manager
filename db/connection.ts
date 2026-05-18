// ============================================================
// HyperGuest B2B Channel Manager - MySQL Connection (Lazy)
// ============================================================
// mysql2/promise is loaded lazily so a broken install never
// crashes an API route at import time.
// All helpers return empty data gracefully if DB is unavailable.
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

const DB_CONFIG = {
  host:     process.env.DB_HOST     || process.env.DB_SERVER || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306', 10),
  database: process.env.DB_NAME     || 'hyperguest_b2b',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  namedPlaceholders: true,   // enables :paramName syntax in queries
  connectionLimit:   10,
  waitForConnections: true,
  queueLimit:        0,
  timezone:          '+00:00', // always UTC
  charset:           'utf8mb4',
  connectTimeout:    15000,
};

// ── Lazy module / pool singletons ───────────────────────────
let _mysqlMod: any = null;
let _pool: any = null;
let _triedLoad = false;
let _lastFailedAt = 0;                        // epoch ms of last connection failure
let _connecting: Promise<any | null> | null = null; // in-flight attempt — shared by concurrent callers
const RETRY_COOLDOWN_MS = 30_000;             // don't retry for 30 s after a failure

function getMysqlSync(): any | null {
  if (_triedLoad) return _mysqlMod;
  _triedLoad = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _mysqlMod = require('mysql2/promise');
    return _mysqlMod;
  } catch (err) {
    console.warn('[DB] mysql2 unavailable — DB features disabled:', (err as Error).message);
    return null;
  }
}

export async function getPool(): Promise<any | null> {
  const mysql = getMysqlSync();
  if (!mysql) return null;

  // Already connected — reuse
  if (_pool) return _pool;

  // Still in cooldown after a recent failure — skip silently
  if (_lastFailedAt > 0 && Date.now() - _lastFailedAt < RETRY_COOLDOWN_MS) {
    return null;
  }

  // Another caller is already attempting to connect — share that promise
  if (_connecting) return _connecting;

  _connecting = (async () => {
    try {
      _pool = mysql.createPool(DB_CONFIG);
      // Verify connectivity
      await _pool.query('SELECT 1');
      _lastFailedAt = 0;
      console.info('[DB] MySQL connected successfully');
      return _pool;
    } catch (err) {
      const isFirstFailure = _lastFailedAt === 0;
      _lastFailedAt = Date.now();
      _pool = null;
      if (isFirstFailure) {
        console.warn('[DB] Pool connect failed:', (err as Error).message);
        console.warn(`[DB] DB features disabled. Retrying in ${RETRY_COOLDOWN_MS / 1000}s. Check DB_HOST / DB_PASSWORD in .env.local`);
      }
      return null;
    } finally {
      _connecting = null;
    }
  })();

  return _connecting;
}

export async function isDbAvailable(): Promise<boolean> {
  return !!(await getPool());
}

// ── query<T> — returns [] on any failure ────────────────────
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  try {
    const pool = await getPool();
    if (!pool) return [];
    const [rows] = await pool.execute(sql, params ?? {});
    return (rows ?? []) as T[];
  } catch (err) {
    console.warn('[DB] query error:', (err as Error).message);
    return [];
  }
}

// ── execute — INSERT / UPDATE / DELETE ───────────────────────
export async function execute(
  sql: string,
  params?: Record<string, unknown>
): Promise<{ rowsAffected: number[]; success: boolean }> {
  try {
    const pool = await getPool();
    if (!pool) return { rowsAffected: [], success: false };
    const [result] = await pool.execute(sql, params ?? {});
    const ok = result as { affectedRows?: number };
    return { rowsAffected: [ok.affectedRows ?? 0], success: true };
  } catch (err) {
    console.warn('[DB] execute error:', (err as Error).message);
    return { rowsAffected: [], success: false };
  }
}
