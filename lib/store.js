// Tiny key/value store backed by Upstash Redis' REST API (what Vercel's
// "Upstash for Redis" / KV marketplace integration provisions). No SDK needed.
// When no credentials are set, cloudEnabled() is false and the app keeps
// everything in the browser instead.

function env(...names) {
  for (const n of names) if (process.env[n]) return process.env[n];
  return '';
}

const url = () => env('KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL').replace(/\/$/, '');
const token = () => env('KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN');

export const PREFIX = 'l1s:';

export function cloudEnabled() {
  return Boolean((url() && token()) || process.env.LOCAL_STORE_FILE);
}

// Development only: `LOCAL_STORE_FILE=.data/store.json npm run dev` keeps the
// "cloud" in a JSON file so syncing can be tried without Redis.
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

async function command(args) {
  if (!(url() && token())) return fileCommand(args);
  const res = await fetch(url(), {
    method: 'POST',
    headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error || `Storage error ${res.status}`);
  return body.result;
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
