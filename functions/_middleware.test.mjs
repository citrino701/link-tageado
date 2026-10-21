import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from './_middleware.js';

async function trackedVisitor({ cookie = '', ip = '203.0.113.10' } = {}) {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async url => {
    requests.push(new URL(url));
    return new Response(JSON.stringify({ ok: true, destination: 'https://example.com/' }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  };

  try {
    const waits = [];
    const headers = {
      'cf-connecting-ip': ip,
      'user-agent': 'Mozilla/5.0 Chrome/130.0 Mobile Safari/537.36',
      'accept-language': 'pt-BR'
    };
    if (cookie) headers.cookie = cookie;
    const request = new Request('https://linkshorter.pages.dev/?id=abc123', { headers });
    const response = await onRequest({
      request,
      env: {
        LINKS: { get: async () => ({ destinationUrl: 'https://example.com/', active: true }) },
        APPS_SCRIPT_URL: 'https://script.example/exec'
      },
      waitUntil: promise => waits.push(promise),
      next: () => new Response('next')
    });
    await Promise.all(waits);
    assert.equal(response.status, 302);
    return {
      visitorId: requests[0].searchParams.get('visitor_id'),
      clickId: requests[0].searchParams.get('click_id'),
      cookie: response.headers.get('set-cookie') || '',
      requestUrl: requests[0]
    };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('separate devices on the same shared Wi-Fi receive separate browser IDs', async () => {
  const first = await trackedVisitor({ ip: '203.0.113.10' });
  const second = await trackedVisitor({ ip: '203.0.113.10' });

  assert.ok(first.visitorId);
  assert.ok(second.visitorId);
  assert.notEqual(first.visitorId, second.visitorId);
  assert.match(first.cookie, /hub_link_visitor_id=[0-9a-f-]+/i);
  assert.match(second.cookie, /hub_link_visitor_id=[0-9a-f-]+/i);
  assert.equal(first.requestUrl.href.includes('203.0.113.10'), false);
});

test('repeat clicks reuse the browser cookie even if network details change', async () => {
  const first = await trackedVisitor({ ip: '203.0.113.10' });
  const cookie = first.cookie.split(';')[0];
  const second = await trackedVisitor({ cookie, ip: '198.51.100.20' });

  assert.equal(first.visitorId, second.visitorId);
  assert.notEqual(first.clickId, second.clickId);
  assert.equal(second.cookie, '');
});

async function requestBotHint({ method = 'GET', headers = {} } = {}) {
  const originalFetch = globalThis.fetch;
  let trackedUrl;
  globalThis.fetch = async url => {
    trackedUrl = new URL(url);
    return new Response(JSON.stringify({ ok: true, destination: 'https://example.com/' }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  };
  try {
    const waits = [];
    const request = new Request('https://linkshorter.pages.dev/?id=abc123', { method, headers });
    const response = await onRequest({
      request,
      env: {
        LINKS: { get: async () => ({ destinationUrl: 'https://example.com/', active: true }) },
        APPS_SCRIPT_URL: 'https://script.example/exec'
      },
      waitUntil: promise => waits.push(promise),
      next: () => new Response('next')
    });
    await Promise.all(waits);
    assert.equal(response.status, 302);
    return trackedUrl.searchParams.get('bot_hint');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('known Meta and social crawlers are marked as bots for click aggregation', async () => {
  assert.equal(await requestBotHint({ headers: { 'user-agent': 'Meta-ExternalFetcher/1.1' } }), 'known-crawler');
  assert.equal(await requestBotHint({ headers: { 'user-agent': 'facebookexternalhit/1.1' } }), 'known-crawler');
});

test('HEAD and explicit preview prefetch requests are marked as bots', async () => {
  assert.equal(await requestBotHint({ method: 'HEAD', headers: { 'user-agent': 'Mozilla/5.0' } }), 'http-head');
  assert.equal(await requestBotHint({ headers: { 'user-agent': 'Mozilla/5.0', purpose: 'prefetch' } }), 'prefetch');
});

test('normal Instagram in-app browser navigation is not automatically treated as a bot', async () => {
  assert.equal(await requestBotHint({
    headers: {
      'user-agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 Instagram/365.0.0.0.0',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document',
      'sec-fetch-user': '?1'
    }
  }), null);
});

test('a customer link redirects immediately and writes its click only to that tenant database', async () => {
  const writes = [];
  const waits = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() { writes.push({ sql, values }); }
          };
        }
      };
    }
  };
  const request = new Request('https://linkshorter.pages.dev/?id=tenant-link-1&utm_source=feira', {
    headers: {
      'user-agent': 'Mozilla/5.0 Chrome/130.0 Mobile Safari/537.36',
      'accept-language': 'pt-BR',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document'
    }
  });
  const response = await onRequest({
    request,
    env: {
      LINKS: { get: async () => ({ destinationUrl: 'https://cliente.example/', active: true, tenantId: 'tenant-1' }) },
      DB: db
    },
    waitUntil: promise => waits.push(promise),
    next: () => new Response('next')
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://cliente.example/');
  await Promise.all(waits);
  assert.equal(writes.length, 1);
  assert.match(writes[0].sql, /INSERT OR IGNORE INTO clicks/);
  assert.equal(writes[0].values[1], 'tenant-1');
  assert.equal(writes[0].values[6], 'feira');
  assert.equal(writes[0].values[5], 0);
});

test('a missing customer KV entry can resolve from D1 without falling through to Apps Script', async () => {
  const waits = [];
  const writes = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              assert.match(sql, /FROM links l JOIN tenants/);
              return { id: 'tenant-link-2', tenantId: 'tenant-2', destinationUrl: 'https://client.example/', active: 1 };
            },
            async run() { writes.push(values); }
          };
        }
      };
    }
  };
  const response = await onRequest({
    request: new Request('https://linkshorter.pages.dev/?id=tenant-link-2'),
    env: { LINKS: { get: async () => null }, DB: db },
    waitUntil: promise => waits.push(promise),
    next: () => new Response('next')
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://client.example/');
  await Promise.all(waits);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][1], 'tenant-2');
});


test('legacy IP-derived cookie is replaced instead of grouping shared-network devices', async () => {
  const legacyId = 'edge_' + 'a'.repeat(64);
  const visitor = await trackedVisitor({
    cookie: 'hub_link_visitor_id=' + legacyId,
    ip: '203.0.113.10'
  });
  assert.notEqual(visitor.visitorId, legacyId);
  assert.match(visitor.cookie, /hub_link_visitor_id=[0-9a-f-]+/i);
});
