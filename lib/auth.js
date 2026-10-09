// Password-gate helpers shared by the Vercel middleware, the API routes and
// the local dev server. Uses only Web Crypto so it runs on Edge and Node.

export const COOKIE_NAME = 'l1s_auth';
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

function getEnv(name) {
  return (typeof process !== 'undefined' && process.env && process.env[name]) || '';
}

export function passwordConfigured() {
  return Boolean(getEnv('APP_PASSWORD'));
}

function secret() {
  // AUTH_SECRET is optional; fall back to the password so one variable is enough.
  // Changing either one signs everybody out.
  return getEnv('AUTH_SECRET') + '|' + getEnv('APP_PASSWORD');
}

function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkPassword(candidate) {
  const expected = getEnv('APP_PASSWORD');
  if (!expected || typeof candidate !== 'string') return false;
  // Compare digests so timing does not leak the password length.
  const [a, b] = await Promise.all([hmac('pw:' + candidate), hmac('pw:' + expected)]);
  return safeEqual(a, b);
}

export async function createToken() {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const payload = 'v1.' + exp;
  return payload + '.' + (await hmac(payload));
}

export async function verifyToken(token) {
  if (!passwordConfigured() || !token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return safeEqual(parts[2], await hmac(parts[0] + '.' + parts[1]));
}

export function readCookie(request, name = COOKIE_NAME) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

export async function isAuthed(request) {
  return verifyToken(readCookie(request));
}

export function sessionCookie(token, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

export function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}
