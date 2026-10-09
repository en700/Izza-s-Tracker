import test from 'node:test';
import assert from 'node:assert/strict';

process.env.APP_PASSWORD = 'correct horse';
const auth = await import('../lib/auth.js');
const { default: middleware, config } = await import('../middleware.js');

const req = (path, cookie) => new Request('https://example.com' + path, { headers: cookie ? { cookie } : {} });

test('password check', async () => {
  assert.equal(await auth.checkPassword('correct horse'), true);
  assert.equal(await auth.checkPassword('wrong'), false);
  assert.equal(await auth.checkPassword(undefined), false);
});

test('token round trip and tampering', async () => {
  const token = await auth.createToken();
  assert.equal(await auth.verifyToken(token), true);
  const [v, exp, sig] = token.split('.');
  assert.equal(await auth.verifyToken(`${v}.${Number(exp) + 1}.${sig}`), false);
  assert.equal(await auth.verifyToken(`${v}.${Date.now() - 1000}.${sig}`), false);
  assert.equal(await auth.verifyToken('garbage'), false);
});

test('changing the password invalidates sessions', async () => {
  const token = await auth.createToken();
  process.env.APP_PASSWORD = 'new password';
  assert.equal(await auth.verifyToken(token), false);
  process.env.APP_PASSWORD = 'correct horse';
  assert.equal(await auth.verifyToken(token), true);
});

test('middleware redirects pages and rejects API calls without a session', async () => {
  const page = await middleware(req('/'));
  assert.equal(page.status, 302);
  assert.equal(new URL(page.headers.get('location')).pathname, '/login');
  const api = await middleware(req('/api/data'));
  assert.equal(api.status, 401);
  const deep = await middleware(req('/schedule.json'));
  assert.equal(new URL(deep.headers.get('location')).searchParams.get('next'), '/schedule.json');
});

test('middleware lets signed-in requests through', async () => {
  const cookie = `${auth.COOKIE_NAME}=${encodeURIComponent(await auth.createToken())}`;
  const res = await middleware(req('/', cookie));
  assert.equal(res.headers.get('x-middleware-next'), '1');
});

test('matcher leaves the login page public', () => {
  const re = new RegExp('^' + config.matcher[0] + '$');
  assert.equal(re.test('/login'), false);
  assert.equal(re.test('/api/login'), false);
  assert.equal(re.test('/'), true);
  assert.equal(re.test('/app.js'), true);
  assert.equal(re.test('/api/data'), true);
});

test('fails closed when no password is configured', async () => {
  const token = await auth.createToken();
  delete process.env.APP_PASSWORD;
  assert.equal(await auth.verifyToken(token), false);
  assert.equal((await middleware(req('/'))).status, 302);
  process.env.APP_PASSWORD = 'correct horse';
});
