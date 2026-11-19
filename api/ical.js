// Live calendar feed. Calendar apps (Google, Apple, Outlook) subscribe to
//   GET /api/ical?t=<token>
// and re-fetch it on their own schedule. They can't sign in, so the long random token in the link is the
// key; the middleware lets this path through and the token is checked here. The site itself builds the
// .ics (it already knows the timetable, your edits and your entries) and uploads it with PUT whenever
// something on the calendar changes, so this endpoint only stores and serves text.
import { isAuthed, json } from '../lib/auth.js';
import { cloudEnabled, getJSON, setJSON } from '../lib/store.js';

const KEY = 'ical';
const MAX_BYTES = 2_000_000;

function sameToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length < 24) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('t') || '';
  if (!cloudEnabled()) return new Response('Calendar feed needs cloud sync (Turso)', { status: 501 });
  const feed = await getJSON(KEY).catch(() => null);
  if (!feed?.ics || !sameToken(token, feed.token)) return new Response('Not found', { status: 404 });
  return new Response(feed.ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="pookies-dh.ics"',
      'cache-control': 'no-cache, max-age=0',
      'x-robots-tag': 'noindex',
    },
  });
}

// Signed-in site only: { token, ics } replaces the feed; { token: null } turns it off.
export async function PUT(request) {
  if (!(await isAuthed(request))) return json({ error: 'unauthorized' }, 401);
  if (!cloudEnabled()) return json({ error: 'Calendar feed needs cloud sync' }, 501);
  const text = await request.text();
  if (text.length > MAX_BYTES) return json({ error: 'Calendar too large' }, 413);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (body?.token === null) {
    await setJSON(KEY, { token: '', ics: '', updatedAt: Date.now() });
    return json({ ok: true, off: true });
  }
  if (typeof body?.token !== 'string' || body.token.length < 24 || typeof body.ics !== 'string' || !body.ics.startsWith('BEGIN:VCALENDAR')) {
    return json({ error: 'Invalid feed' }, 400);
  }
  await setJSON(KEY, { token: body.token, ics: body.ics, updatedAt: Date.now() });
  return json({ ok: true });
}
