// Vercel Routing Middleware: every page, asset and API call needs a valid
// session cookie except the login page and the login endpoint.
import { isAuthed, passwordConfigured } from './lib/auth.js';

export const config = {
  matcher: ['/((?!login|api/login|favicon\\.svg|robots\\.txt).*)'],
};

export default async function middleware(request) {
  if (passwordConfigured() && (await isAuthed(request))) {
    // Same as `next()` from @vercel/functions: let the request through.
    return new Response(null, { headers: { 'x-middleware-next': '1' } });
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  const login = new URL('/login', url);
  if (url.pathname !== '/') login.searchParams.set('next', url.pathname + url.search);
  return Response.redirect(login, 302);
}
