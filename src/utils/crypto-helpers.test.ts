import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptToken, decryptToken } from './crypto-helpers.ts';

test('encryptToken and decryptToken roundtrip successfully', () => {
  const secretKey = 'test-secret-key-for-unit-testing';
  const originalToken = '1//04abcDEF123456_my_google_refresh_token_xyz';

  const encrypted = encryptToken(originalToken, secretKey);
  assert.notEqual(encrypted, originalToken);
  assert.ok(encrypted.includes(':'));

  const decrypted = decryptToken(encrypted, secretKey);
  assert.equal(decrypted, originalToken);
});

test('decryptToken throws if tampered with or with wrong key', () => {
  const secretKey = 'correct-key';
  const wrongKey = 'wrong-key';
  const originalToken = 'secret-token-payload';

  const encrypted = encryptToken(originalToken, secretKey);
  assert.throws(() => decryptToken(encrypted, wrongKey));
});

test('handles empty token gracefully', () => {
  assert.equal(encryptToken('', 'key'), '');
  assert.equal(decryptToken('', 'key'), '');
});
