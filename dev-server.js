// Local stand-in for Vercel: applies middleware.js, routes /api/* to the
// handlers in api/, and serves public/ with clean URLs.
//   APP_PASSWORD=secret npm run dev   ->  http://localhost:3000
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local / .env if present (KEY=value lines).
for (const f of ['.env.local', '.env']) {
  try {
    for (const line of (await fs.readFile(path.join(root, f), 'utf8')).split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch {}
}

const { default: middleware, config } = await import('./middleware.js');
const matchers = config.matcher.map((m) => new RegExp('^' + m + '$'));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};

async function toRequest(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(`http://${req.headers.host}${req.url}`, {
    method: req.method,
    headers: Object.entries(req.headers).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]])),
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
  });
}

async function send(res, response) {
  const headers = {};
  response.headers.forEach((v, k) => (headers[k] = v));
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function serveStatic(pathname) {
  const clean = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidates = clean.endsWith('/') ? [clean + 'index.html'] : [clean, clean + '.html'];
  for (const c of candidates) {
    const file = path.join(root, 'public', c);
    if (!file.startsWith(path.join(root, 'public'))) break;
    try {
      const data = await fs.readFile(file);
      return new Response(data, { headers: { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' } });
    } catch {}
  }
  return new Response('Not found', { status: 404 });
}

http
  .createServer(async (req, res) => {
    try {
      const request = await toRequest(req);
      const { pathname } = new URL(request.url);
      if (matchers.some((m) => m.test(pathname))) {
        const blocked = await middleware(request.clone());
        if (blocked && !blocked.headers.get('x-middleware-next')) return send(res, blocked);
      }
      if (pathname.startsWith('/api/')) {
        const name = pathname.slice(5).replace(/[^a-z0-9_-]/gi, '');
        let mod;
        try {
          mod = await import(pathToFileURL(path.join(root, 'api', name + '.js')));
        } catch {
          return send(res, new Response('Not found', { status: 404 }));
        }
        const handler = mod[req.method];
        if (!handler) return send(res, new Response('Method not allowed', { status: 405 }));
        return send(res, await handler(request));
      }
      return send(res, await serveStatic(pathname));
    } catch (err) {
      console.error(err);
      res.writeHead(500).end('Server error');
    }
  })
  .listen(process.env.PORT || 3000, () => {
    console.log(`Pooky's Dental Hygiene Program running at http://localhost:${process.env.PORT || 3000}`);
    if (!process.env.APP_PASSWORD) console.warn('APP_PASSWORD is not set - every request will be refused.');
  });
