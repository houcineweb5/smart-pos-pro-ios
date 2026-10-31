import { createSession, getSession, revokeSession, checkLoginRateLimit, recordFailedLogin, resetLoginAttempts } from '../server_src/auth';
import assert from 'node:assert';
import test from 'node:test';

test('Auth: session lifecycle works (create, retrieve, revoke)', () => {
  const user = {
    id: 'emp-admin',
    username: 'admin',
    name: 'Administrator',
    role: 'admin' as const,
    allowedTabs: ['home', 'pos', 'settings'],
  };
  const session = createSession(user);
  assert.ok(session.token, 'Session token must be present');
  assert.strictEqual(session.userId, 'emp-admin');
  assert.strictEqual(session.role, 'admin');

  const retrieved = getSession(session.token);
  assert.ok(retrieved, 'Session must be retrieved');
  assert.strictEqual(retrieved?.username, 'admin');

  const revoked = revokeSession(session.token);
  assert.strictEqual(revoked, true, 'Revocation must return true');

  const afterRevoke = getSession(session.token);
  assert.strictEqual(afterRevoke, null, 'Revoked session must be null');
});

test('Auth: rate limiting blocks after threshold', () => {
  const ip = '127.0.0.1';
  resetLoginAttempts(ip);

  for (let i = 0; i < 4; i++) {
    recordFailedLogin(ip);
    const check = checkLoginRateLimit(ip);
    assert.strictEqual(check.allowed, true, `Attempt ${i + 1} should still be allowed`);
  }

  // 5th attempt locks
  recordFailedLogin(ip);
  const checkLocked = checkLoginRateLimit(ip);
  assert.strictEqual(checkLocked.allowed, false, '5th attempt must lock');
  assert.ok(checkLocked.retryAfterSec && checkLocked.retryAfterSec > 0, 'Must have retryAfterSec');

  resetLoginAttempts(ip);
  assert.strictEqual(checkLoginRateLimit(ip).allowed, true, 'Reset must unlock');
});
