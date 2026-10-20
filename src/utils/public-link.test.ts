import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicLink, displayPublicLink } from './public-link.ts';
import type { LinkRecord } from '../services/store.ts';

const link = {
  id: 'abc123', source: 'Instagram_Stories', medium: 'Social',
  campaign: 'Campanha com nome grande e espaços', content: 'Detalhes do conteúdo'.repeat(40),
} as LinkRecord;

test('copied URL contains only the ID, irrespective of tag length', () => {
  Object.assign(globalThis, { window: {} });
  const result = buildPublicLink(link);
  assert.equal(result, 'https://citrino701.github.io/link-tageado/?id=abc123');
  assert.equal(displayPublicLink(link), 'citrino701.github.io/link-tageado/?id=abc123');
});

test('configured base keeps its route while dropping inherited tags', () => {
  Object.assign(globalThis, { window: { HUB_CONFIG: { publicLinkBaseUrl: 'https://links.example.com/hub/?utm_source=old&origem=old' } } });
  assert.equal(buildPublicLink(link), 'https://links.example.com/hub/?id=abc123');
});


test('long format copies the full GitHub Pages bridge instead of the Cloudflare host', () => {
  Object.assign(globalThis, { window: { HUB_CONFIG: { publicLinkBaseUrl: 'https://linkshorter.pages.dev/' } } });
  assert.equal(buildPublicLink(link, 'short'), 'https://linkshorter.pages.dev/?id=abc123');
  const longUrl = new URL(buildPublicLink(link, 'long'));
  assert.equal(longUrl.origin + longUrl.pathname, 'https://citrino701.github.io/link-tageado/');
  assert.equal(longUrl.searchParams.get('id'), 'abc123');
  assert.equal(longUrl.searchParams.get('utm_source'), 'Instagram_Stories');
  assert.equal(longUrl.searchParams.get('utm_medium'), 'Social');
  assert.equal(longUrl.searchParams.get('utm_campaign'), link.campaign);
  assert.equal(longUrl.searchParams.get('utm_content'), link.content);
  assert.equal(displayPublicLink(link, 'long').startsWith('citrino701.github.io/link-tageado/?id=abc123'), true);
});
