import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { onRequest } from './_middleware.js';

test('repeated hits keep one visitor when the browser does not return cookies', async () => {
  const originalFetch = globalThis.fetch;
  const originalCrypto = globalThis.crypto;
  const requests = [];
  globalThis.crypto = webcrypto;
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
    globalThis.crypto = originalCrypto;
  }
});
