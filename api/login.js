import { checkPassword, createToken, json, passwordConfigured, sessionCookie } from '../lib/auth.js';

export async function POST(request) {
  if (!passwordConfigured()) {
    return json({ error: 'APP_PASSWORD is not set on the server.' }, 500);
  }
  let password = '';
  try {
    ({ password } = await request.json());
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  if (!(await checkPassword(password))) {
    // Small delay to slow down guessing.
    await new Promise((r) => setTimeout(r, 600));
    return json({ error: 'Incorrect password' }, 401);
  }
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(await createToken(), request) });
}
