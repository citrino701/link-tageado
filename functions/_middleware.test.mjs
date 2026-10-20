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


test('legacy IP-derived cookie is replaced instead of grouping shared-network devices', async () => {
  const legacyId = 'edge_' + 'a'.repeat(64);
  const visitor = await trackedVisitor({
    cookie: 'hub_link_visitor_id=' + legacyId,
    ip: '203.0.113.10'
  });
  assert.notEqual(visitor.visitorId, legacyId);
  assert.match(visitor.cookie, /hub_link_visitor_id=[0-9a-f-]+/i);
});
