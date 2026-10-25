import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecentClicks } from './RecentClicks.tsx';
import { LinkCard } from './LinkCard.tsx';
import { LinkListView } from './LinkListView.tsx';
import { AnalyticsPanel } from './AnalyticsPanel.tsx';
import type { LinkRecord } from '../services/store.ts';

const noop = () => {};
const clicks = [14, 13, 12, 11].map((hour, index) => ({
  timestampMs: Date.parse(`2026-10-25T${hour}:00:00Z`),
  timestamp: `25/10/2026 ${hour}:00:00`,
  isBot: index === 1,
}));
const link = {
  id: 'link1', name: 'Instagram', campaign: 'Koyo', source: 'Instagram',
  shortPath: '?id=link1', destinationType: 'url', destinationUrl: 'https://example.com',
  spreadsheetUrl: 'https://docs.google.com', status: 'active', recentClicks: clicks.slice(0, 3),
} as LinkRecord;

test('preview shows three timestamps and estimated bot labels without interaction', () => {
  const html = renderToStaticMarkup(<RecentClicks clicks={clicks} ready linkName={link.name} onViewHistory={noop} />);
  assert.equal((html.match(/<time /g) || []).length, 3);
  assert.match(html, /25\/10\/2026 14:00:00/);
  assert.doesNotMatch(html, /11:00:00/);
  assert.match(html, /Bot suspeito/);
  assert.match(html, /Humano \(est\.\)/);
  assert.match(html, /Ver histórico de cliques de Instagram/);
});

test('preview distinguishes pending, unavailable, old backend and empty data', () => {
  const html = (ready: boolean, values?: typeof clicks | null) => renderToStaticMarkup(
    <RecentClicks ready={ready} clicks={values} linkName={link.name} onViewHistory={noop} />
  );
  assert.match(html(false), /Carregando últimos cliques/);
  assert.match(html(true), /Atualize o Apps Script/);
  assert.match(html(true, null), /Não foi possível ler/);
  assert.match(html(true, []), /Nenhum clique com horário disponível/);
});

test('both card and unselected list rows expose the preview and history action', () => {
  globalThis.window = { HUB_CONFIG: { publicLinkBaseUrl: 'https://linkshorter.pages.dev/' } } as Window & typeof globalThis;
  const handlers = { onToggleStatus: noop, onDelete: noop, onEdit: noop, onViewHistory: noop };
  const card = renderToStaticMarkup(<LinkCard link={link} {...handlers} />);
  assert.match(card, /Últimos cliques de Instagram/);
  assert.equal((card.match(/<time /g) || []).length, 3);
  const list = renderToStaticMarkup(<LinkListView links={[link]} allLinks={[link]} campaigns={['Koyo']} metricsReady {...handlers} />);
  assert.match(list, /Selecione um link/);
  assert.match(list, /Últimos cliques de Instagram/);
  assert.equal((list.match(/<time /g) || []).length, 3);
});

test('history entry preselects the exact link and campaign, including links without campaign', () => {
  const other = { ...link, id: 'link2', name: 'Other', campaign: 'AAPVR' };
  const render = (selected: LinkRecord) => renderToStaticMarkup(
    <AnalyticsPanel links={[link, selected]} campaigns={['Koyo', 'AAPVR']} initialLink={selected} />
  );
  assert.match(render(other), /<option value="AAPVR" selected="">AAPVR/);
  assert.match(render(other), /<option value="link2" selected="">Other/);
  assert.match(render({ ...other, campaign: '' }), /<option value="all" selected="">Todas/);
});
