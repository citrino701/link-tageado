import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from './manage-links.js';

function makeContext(body, options = {}) {
  const entries = new Map();
  const deleted = [];
  const kv = {
    async get(key) { return entries.get(key) ?? null; },
    async put(key, value) { entries.set(key, value); },
    async delete(key) {
      if (options.failDelete) throw new Error('KV indisponível');
      entries.delete(key);
      deleted.push(key);
    }
  };
  return {
    entries,
    deleted,
    context: {
      request: new Request('https://example.pages.dev/api/manage-links', {
        method: 'POST',
        headers: {
          authorization: options.authorization || 'Bearer secret',
          'content-type': 'application/json'
        },
        body: JSON.stringify(body)
      }),
      env: { SYNC_TOKEN: 'secret', LINKS: kv }
    }
  };
}

test('management endpoint removes a deleted link from KV', async () => {
  const fixture = makeContext({ links: [
    { id: 'abc12345', removed: true }
  ] });
  await fixture.context.env.LINKS.put('link:abc12345', '{"destinationUrl":"https://example.com/"}');

  const response = await onRequestPost(fixture.context);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, synchronized: 1 });
  assert.equal(fixture.entries.has('link:abc12345'), false);
  assert.deepEqual(fixture.deleted, ['link:abc12345']);
});

test('management endpoint validates the full batch before changing KV', async () => {
  const fixture = makeContext({ links: [
    { id: 'abc12345', destinationUrl: 'https://example.com/' },
    { id: 'bad id', removed: true }
  ] });

  const response = await onRequestPost(fixture.context);
  assert.equal(response.status, 400);
  assert.equal(fixture.entries.size, 0);
  assert.deepEqual(fixture.deleted, []);
});

test('management endpoint rejects invalid authorization', async () => {
  const fixture = makeContext({ links: [
    { id: 'abc12345', removed: true }
  ] }, { authorization: 'Bearer wrong' });

  const response = await onRequestPost(fixture.context);
  assert.equal(response.status, 401);
  assert.deepEqual(fixture.deleted, []);
});

test('management endpoint reports KV deletion failure without claiming success', async () => {
  const fixture = makeContext({ links: [
    { id: 'abc12345', removed: true }
  ] }, { failDelete: true });
  await fixture.context.env.LINKS.put('link:abc12345', '{"destinationUrl":"https://example.com/"}');

  const response = await onRequestPost(fixture.context);
  assert.equal(response.status, 503);
  assert.equal(fixture.entries.has('link:abc12345'), true);
  assert.deepEqual(fixture.deleted, []);
});
