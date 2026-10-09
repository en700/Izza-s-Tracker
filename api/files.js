// Attachment storage (one Redis key per file, stored as a data URL).
import { isAuthed, json } from '../lib/auth.js';
import { cloudEnabled, del, getJSON, setJSON } from '../lib/store.js';

const MAX_DATA_URL = 3_500_000; // ~2.5 MB file once base64-encoded; Vercel caps bodies at 4.5 MB
const idOk = (id) => typeof id === 'string' && /^[a-z0-9_-]{6,40}$/i.test(id);

export async function GET(request) {
  if (!(await isAuthed(request))) return json({ error: 'unauthorized' }, 401);
  if (!cloudEnabled()) return json({ error: 'Cloud storage is not configured' }, 501);
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!idOk(id)) return json({ error: 'Bad id' }, 400);
  const file = await getJSON('file:' + id);
  if (!file) return json({ error: 'Not found' }, 404);
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(file.dataUrl || '');
  if (!m) return json({ error: 'Corrupt file' }, 500);
  const bytes = m[2] ? Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(m[3]));
  const disposition = url.searchParams.has('download') ? 'attachment' : 'inline';
  return new Response(bytes, {
    headers: {
      'content-type': m[1] || 'application/octet-stream',
      'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name || 'file')}`,
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}

export async function POST(request) {
  if (!(await isAuthed(request))) return json({ error: 'unauthorized' }, 401);
  if (!cloudEnabled()) return json({ error: 'Cloud storage is not configured' }, 501);
  const text = await request.text();
  if (text.length > MAX_DATA_URL + 2000) return json({ error: 'File too large (max ~2.5 MB)' }, 413);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const { id, name, type, dataUrl } = body || {};
  if (!idOk(id) || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return json({ error: 'Bad request' }, 400);
  await setJSON('file:' + id, { name: String(name || 'file').slice(0, 200), type: String(type || ''), dataUrl });
  return json({ ok: true, id });
}

export async function DELETE(request) {
  if (!(await isAuthed(request))) return json({ error: 'unauthorized' }, 401);
  if (!cloudEnabled()) return json({ error: 'Cloud storage is not configured' }, 501);
  const id = new URL(request.url).searchParams.get('id');
  if (!idOk(id)) return json({ error: 'Bad id' }, 400);
  await del('file:' + id);
  return json({ ok: true });
}
