import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { requireIdentity, requirePlatformAdmin, requireTenant } from './auth.js';
import { onRequestPost as createTenantLink } from '../tenants/[tenantId]/links/index.js';
import { onRequestPost as createTenant } from '../platform/tenants/index.js';

const base64url = (value) => Buffer.from(value).toString('base64url');
const keyPair = await webcrypto.subtle.generateKey({
  name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'
}, true, ['sign', 'verify']);
const jwk = await webcrypto.subtle.exportKey('jwk', keyPair.publicKey);
jwk.kid = 'test-key';

async function fixture(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: 'https://test.cloudflareaccess.com', aud: ['expected-audience'],
    email: 'owner@example.com', exp: now + 300, nbf: now - 1,
    ...overrides.claims
  };
  const header = { alg: 'RS256', kid: 'test-key', typ: 'JWT' };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(unsigned));
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

test('the platform admin can create a client, while a customer cannot', async () => {
  const f = await fixture();
  try {
    const statements = [];
    f.context.request = new Request('https://hub.example/api/platform/tenants', {
      method: 'POST', headers: { authorization: `Bearer ${f.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Cliente A', ownerEmail: 'client@example.com' })
    });
    f.context.env.DB = {
      prepare(sql) { statements.push(sql); return { bind() { return this; }, async run() { return { meta: { changes: 1 } }; } }; },
      async batch() { return []; }
    };
    const response = await createTenant(f.context);
    assert.equal(response.status, 201);
    assert.match(statements.join('\n'), /INSERT INTO tenants/);
    f.context.request = new Request('https://hub.example/api/platform/tenants', {
      method: 'POST', headers: { authorization: `Bearer ${f.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Cliente B', ownerEmail: 'other@example.com' })
    });
    f.context.env.PLATFORM_ADMIN_EMAIL = 'someone-else@example.com';
    const denied = await createTenant(f.context);
    assert.equal(denied.status, 403);
  } finally { f.restore(); }
});

test('the tenant link create statement enforces the quota in D1 and does not publish when full', async () => {
  const f = await fixture();
  try {
    const statements = [];
    const db = {
      prepare(sql) {
        statements.push(sql);
        return {
          bind() {
            return {
              async first() {
                if (/SELECT t\.id AS tenant_id/.test(sql)) {
                  return { tenant_id: 'tenant-1', name: 'Cliente', tenant_status: 'active', link_limit: 10, plan_name: 'Inicial', role: 'editor', membership_status: 'active' };
                }
                if (/INSERT INTO links/.test(sql)) return null;
                if (/SELECT link_limit/.test(sql)) return { link_limit: 10 };
                return null;
              },
              async run() { return { meta: { changes: 1 } }; }
            };
          }
        };
      }
    };
    let kvWrites = 0;
    f.context.params = { tenantId: 'tenant-1' };
    f.context.request = new Request('https://hub.example/api/tenants/tenant-1/links', {
      method: 'POST', headers: { authorization: `Bearer ${f.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Feira', destinationUrl: 'https://example.com/' })
    });
    f.context.env.DB = db;
    f.context.env.LINKS = { async put() { kvWrites++; } };
    const response = await createTenantLink(f.context);
    assert.equal(response.status, 409);
    assert.equal(kvWrites, 0);
    const insert = statements.find(sql => /INSERT INTO links/.test(sql));
    assert.match(insert, /SELECT COUNT\(\*\) FROM links WHERE tenant_id = t\.id/);
    assert.match(insert, /< t\.link_limit/);
  } finally { f.restore(); }
});

test('a viewer cannot create a link even when the tenant has quota available', async () => {
  const f = await fixture();
  try {
    let kvWrites = 0;
    f.context.params = { tenantId: 'tenant-1' };
    f.context.request = new Request('https://hub.example/api/tenants/tenant-1/links', {
      method: 'POST', headers: { authorization: `Bearer ${f.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Feira', destinationUrl: 'https://example.com/' })
    });
    f.context.env.DB = {
      prepare() { return { bind() { return this; }, async first() {
        return { tenant_id: 'tenant-1', name: 'Cliente', tenant_status: 'active', link_limit: 10, plan_name: 'Inicial', role: 'viewer', membership_status: 'active' };
      } }; }
    };
    f.context.env.LINKS = { async put() { kvWrites++; } };
    const response = await createTenantLink(f.context);
    assert.equal(response.status, 403);
    assert.equal(kvWrites, 0);
  } finally { f.restore(); }
});