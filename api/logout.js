import { clearCookie, json } from '../lib/auth.js';

export function POST() {
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
}
