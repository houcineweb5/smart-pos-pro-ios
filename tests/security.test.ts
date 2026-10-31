import { hashPassword, verifyPassword, isHashed } from '../server_src/security';
import assert from 'node:assert';
import test from 'node:test';

test('Security: scrypt hash and verify works correctly', async () => {
  const password = 'smartpos_super_secret';
  const hashed = await hashPassword(password);
  assert.ok(isHashed(hashed), 'Hash should be recognized as hashed');
  assert.ok(hashed.startsWith('scrypt$'), 'Hash should start with scrypt$');

  const valid = await verifyPassword(password, hashed);
  assert.strictEqual(valid, true, 'Correct password must verify');

  const invalid = await verifyPassword('wrong_password', hashed);
  assert.strictEqual(invalid, false, 'Incorrect password must fail');
});

test('Security: legacy plaintext verification works for smooth migration', async () => {
  const legacyPlain = 'user1';
  const valid = await verifyPassword('user1', legacyPlain);
  assert.strictEqual(valid, true, 'Legacy plaintext must match');

  const invalid = await verifyPassword('user2', legacyPlain);
  assert.strictEqual(invalid, false, 'Legacy plaintext mismatch must fail');
});
