import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { requireIdentity, requirePlatformAdmin, requireTenant } from './auth.js';

const base64url = (value) => Buffer.from(value).toString('base64url');

async function fixture(overrides = {}) {
  const pair = await webcrypto.subtle.generateKey({
    name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'
  }, true, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
  jwk.kid = 'test-key';
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: 'https://test.cloudflareaccess.com', aud: ['expected-audience'],
    email: 'owner@example.com', exp: now + 300, nbf: now - 1,
    ...overrides.claims
  };
  const header = { alg: 'RS256', kid: 'test-key', typ: 'JWT' };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(unsigned));
  const token = `${unsigned}.${Buffer.from(signature).toString('base64url')}`;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
  return {
    token,
    context: {
      request: new Request('https://hub.example/api/tenants/tenant-1', { headers: { authorization: `Bearer ${token}` } }),
      params: { tenantId: 'tenant-1' },
      env: { ACCESS_ISSUER: 'https://test.cloudflareaccess.com', ACCESS_AUD: 'expected-audience', PLATFORM_ADMIN_EMAIL: 'owner@example.com' }
    },
    restore() { globalThis.fetch = oldFetch; }
  };
}

test('identity accepts a correctly signed Access JWT and normalizes email', async () => {
  const f = await fixture({ claims: { email: 'Owner@Example.com' } });
  try {
    const result = await requireIdentity(f.context);
    assert.equal(result.identity.email, 'owner@example.com');
  } finally { f.restore(); }
});

test('identity rejects a token with the wrong audience', async () => {
  const f = await fixture({ claims: { aud: ['some-other-app'] } });
  try {
    const result = await requireIdentity(f.context);
    assert.equal(result.response.status, 401);
  } finally { f.restore(); }
});

test('missing bearer token is rejected', async () => {
  const f = await fixture();
  try {
    f.context.request = new Request('https://hub.example/api/tenants/tenant-1');
    const result = await requireIdentity(f.context);
    assert.equal(result.response.status, 401);
  } finally { f.restore(); }
});

test('platform administrator is an exact server-side email match', async () => {
  const f = await fixture();
  try {
    const allowed = await requirePlatformAdmin(f.context, { email: 'owner@example.com' });
    const denied = await requirePlatformAdmin(f.context, { email: 'client@example.com' });
    assert.equal(allowed.ok, true);
    assert.equal(denied.response.status, 403);
  } finally { f.restore(); }
});

test('a person cannot access a tenant without an active or invited membership', async () => {
  const f = await fixture();
  try {
    f.context.env.DB = {
      prepare() { return { bind() { return this; }, async first() { return null; } }; }
    };
    const result = await requireTenant(f.context, { email: 'owner@example.com' });
    assert.equal(result.response.status, 403);
  } finally { f.restore(); }
});