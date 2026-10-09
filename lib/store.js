// Small key/value store for synced data, attachments and backups. No SDKs:
//  - Turso (libSQL) over its HTTP API — what Vercel's Turso integration provisions
//    (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN, optionally with a custom prefix)
//  - Upstash Redis REST (KV_REST_API_URL + KV_REST_API_TOKEN), kept for older setups
//  - a local JSON file (LOCAL_STORE_FILE) for development
// When none is configured, cloudEnabled() is false and the app keeps data in the browser.

export const PREFIX = 'l1s:';

// Vercel integrations can add a custom prefix (e.g. STORAGE_TURSO_DATABASE_URL).
function env(...names) {
  for (const n of names) {
    if (process.env[n]) return process.env[n];
    const k = Object.keys(process.env).find((key) => key.endsWith('_' + n) && process.env[key]);
    if (k) return process.env[k];
  }
  return '';
}

const turso = () => {
  const url = env('TURSO_DATABASE_URL', 'LIBSQL_URL');
  const token = env('TURSO_AUTH_TOKEN', 'LIBSQL_AUTH_TOKEN');
  return url ? { url: url.replace(/^libsql:\/\//, 'https://').replace(/\/$/, ''), token } : null;
};
const upstash = () => {
  const url = env('KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL').replace(/\/$/, '');
  const token = env('KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN');
  return url && token ? { url, token } : null;
};

export function backend() {
  if (turso()) return 'turso';
  if (upstash()) return 'upstash';
  if (process.env.LOCAL_STORE_FILE) return 'file';
  return null;
}
export const cloudEnabled = () => Boolean(backend());

/* ---- Turso: one table, rows are key -> JSON text ---- */
const arg = (v) => (typeof v === 'number' ? { type: 'integer', value: String(v) } : { type: 'text', value: String(v) });
async function tursoExec(statements) {
  const { url, token } = turso();
  const res = await fetch(`${url}/v2/pipeline`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      requests: [...statements.map(([sql, args = []]) => ({ type: 'execute', stmt: { sql, args: args.map(arg) } })), { type: 'close' }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || body.error || `Turso error ${res.status}`);
  return body.results.slice(0, statements.length).map((r) => {
    if (r.type !== 'ok') throw new Error(r.error?.message || 'Turso query failed');
    return r.response.result;
  });
}
let schemaReady = null;
function ensureSchema() {
  schemaReady ||= tursoExec([['CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)']])
    .catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}
async function tursoCommand([op, key, value]) {
  await ensureSchema();
  if (op === 'GET') {
    const [r] = await tursoExec([['SELECT value FROM kv WHERE key = ?', [key]]]);
    return r.rows.length ? r.rows[0][0].value : null;
  }
  if (op === 'SET') {
    await tursoExec([['INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', [key, value, Date.now()]]]);
    return 'OK';
  }
  if (op === 'DEL') {
    await tursoExec([['DELETE FROM kv WHERE key = ?', [key]]]);
    return 'OK';
  }
  throw new Error('Unknown op ' + op);
}

/* ---- Upstash ---- */
async function upstashCommand(args) {
  const { url, token } = upstash();
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error || `Storage error ${res.status}`);
  return body.result;
}

/* ---- Local file (development only) ---- */
async function fileCommand([op, key, value]) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const file = process.env.LOCAL_STORE_FILE;
  let db = {};
  try {
    db = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  if (op === 'GET') return db[key] ?? null;
  if (op === 'SET') db[key] = value;
  if (op === 'DEL') delete db[key];
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(db));
  return 'OK';
}

function command(args) {
  const b = backend();
  if (b === 'turso') return tursoCommand(args);
  if (b === 'upstash') return upstashCommand(args);
  return fileCommand(args);
}

export async function getJSON(key) {
  const raw = await command(['GET', PREFIX + key]);
  return raw == null ? null : JSON.parse(raw);
}
export async function setJSON(key, value) {
  await command(['SET', PREFIX + key, JSON.stringify(value)]);
}
export async function del(key) {
  await command(['DEL', PREFIX + key]);
}

/* ---- Daily backups: one snapshot per day (the latest save that day), last 30 days kept ---- */
const KEEP_DAYS = 30;
export async function listBackups() {
  return (await getJSON('backups:index')) || [];
}
export async function getBackup(day) {
  return getJSON('backup:' + day);
}
export async function saveDailyBackup(value) {
  const day = new Date().toISOString().slice(0, 10);
  await setJSON('backup:' + day, value);
  const index = (await listBackups()).filter((b) => b.day !== day);
  index.unshift({ day, savedAt: new Date().toISOString(), items: value.items?.length || 0, notes: value.notes?.length || 0 });
  index.sort((a, b) => b.day.localeCompare(a.day));
  for (const old of index.splice(KEEP_DAYS)) await del('backup:' + old.day).catch(() => {});
  await setJSON('backups:index', index);
}
