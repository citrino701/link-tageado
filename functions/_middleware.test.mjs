import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from './_middleware.js';

test('repeated hits keep one visitor when the browser does not return cookies', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async url => {
    requests.push(new URL(url));
    return new Response(JSON.stringify({ ok: true, destination: 'https://example.com/' }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  };

  try {
    const env = {
      LINKS: { get: async () => ({ destinationUrl: 'https://example.com/', active: true }) },
      APPS_SCRIPT_URL: 'https://script.example/exec'
    };
    const visit = async () => {
      const waits = [];
      const request = new Request('https://linkshorter.pages.dev/?id=abc123', {
        headers: {
          'cf-connecting-ip': '203.0.113.10',
          'user-agent': 'Mozilla/5.0 Chrome/130.0 Mobile Safari/537.36',
          'accept-language': 'pt-BR'
        }
      });
      const response = await onRequest({
        request, env, waitUntil: promise => waits.push(promise), next: () => new Response('next')
      });
      await Promise.all(waits);
      assert.equal(response.status, 302);
      assert.match(response.headers.get('set-cookie') || '', /hub_link_visitor_id=edge_/);
      return response;
    };

    await visit();
    await visit();
    const ids = requests.map(url => url.searchParams.get('visitor_id'));
    assert.equal(ids.length, 2);
    assert.equal(ids[0], ids[1]);
    assert.ok(requests[0].searchParams.get('click_id') !== requests[1].searchParams.get('click_id'));
  } finally {
    globalThis.fetch = originalFetch;
  }
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
