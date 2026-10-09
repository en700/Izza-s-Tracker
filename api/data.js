// Sync endpoint for notes, tasks, events, checklists and settings.
import { isAuthed, json } from '../lib/auth.js';
import { cloudEnabled, getJSON, setJSON } from '../lib/store.js';

const KEY = 'data';
const MAX_BYTES = 4_000_000;

export async function GET(request) {
  if (!(await isAuthed(request))) return json({ error: 'unauthorized' }, 401);
  if (!cloudEnabled()) return json({ cloud: false, data: null });
  try {
    return json({ cloud: true, data: await getJSON(KEY) });
  } catch (err) {
    return json({ cloud: true, error: String(err.message || err) }, 502);
  }
}

export async function PUT(request) {
  if (!(await isAuthed(request))) return json({ error: 'unauthorized' }, 401);
  if (!cloudEnabled()) return json({ cloud: false }, 501);
  const text = await request.text();
  if (text.length > MAX_BYTES) return json({ error: 'Data too large' }, 413);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'Invalid data' }, 400);
  try {
    const current = await getJSON(KEY);
    // Refuse to overwrite newer data written from another device.
    if (current && data.baseRevision != null && current.revision > data.baseRevision) {
      return json({ conflict: true, data: current }, 409);
    }
    const saved = { ...data, revision: (current?.revision || 0) + 1, savedAt: new Date().toISOString() };
    delete saved.baseRevision;
    await setJSON(KEY, saved);
    return json({ ok: true, revision: saved.revision, savedAt: saved.savedAt });
  } catch (err) {
    return json({ error: String(err.message || err) }, 502);
  }
}
