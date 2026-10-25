import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');

function statsFixture(rows) {
  const context = vm.createContext({
    Session: { getScriptTimeZone: () => 'America/Sao_Paulo' },
    Utilities: { formatDate: (date) => date.toISOString() }
  });
  vm.runInContext(source, context);
  const values = [
    ['data_hora', 'link_id', 'navegador', 'visitor_id', 'suspeito_bot'],
    ...rows
  ];
  context.SpreadsheetApp = {
    openById: () => ({ getSheetByName: () => ({
      getLastRow: () => values.length,
      getDataRange: () => ({ getValues: () => values })
    }) })
  };
  return context;
}

test('same visitor repeated clicks count as one unique, bots are excluded, WhatsApp webview is human', () => {
  const context = statsFixture([
    [new Date(), 'link1', 'Mozilla/5.0 Chrome/130 Safari/537.36', 'visitor-a', false],
    [new Date(), 'link1', 'Mozilla/5.0 Chrome/130 Safari/537.36', 'visitor-a', false],
    [new Date(), 'link1', 'WhatsApp/2.26.10', 'bot-preview', true],
    [new Date(), 'link1', 'Mozilla/5.0 Chrome/130 Mobile Safari/537.36 WhatsApp/2.26.10', 'visitor-b', true]
  ]);
  const stats = context.getClickStats_([{
    id: 'link1', spreadsheetId: 'sheet1', aba: 'Cliques'
  }]).link1;
  assert.equal(stats.total, 4);
  assert.equal(stats.bots, 1);
  assert.equal(stats.unique, 2);
});


test('different browser IDs stay distinct even with the same shared-network browser signature', () => {
  const sameBrowser = 'Mozilla/5.0 Chrome/130 Mobile Safari/537.36';
  const context = statsFixture([
    [new Date(), 'link1', sameBrowser, 'browser-device-a', false],
    [new Date(), 'link1', sameBrowser, 'browser-device-b', false]
  ]);
  const stats = context.getClickStats_([{
    id: 'link1', spreadsheetId: 'sheet1', aba: 'Cliques'
  }]).link1;
  assert.equal(stats.unique, 2);
});


test('legacy IP-derived IDs are excluded from browser-unique counts', () => {
  const context = statsFixture([
    [new Date(), 'link1', 'Mozilla/5.0 Chrome/130 Safari/537.36', 'edge_' + 'a'.repeat(64), false]
  ]);
  const stats = context.getClickStats_([{
    id: 'link1', spreadsheetId: 'sheet1', aba: 'Cliques'
  }]).link1;
  assert.equal(stats.total, 1);
  assert.equal(stats.unique, 0);
});

test('preview keeps only the latest three dated clicks per link, including suspected bots', () => {
  const browser = 'Mozilla/5.0 Chrome/130 Safari/537.36';
  const context = statsFixture([
    ['2026-10-25T10:00:00Z', 'link1', browser, 'a', false],
    ['2026-10-25T14:00:00Z', 'link1', 'Googlebot', 'b', true],
    ['2026-10-25T12:00:00Z', 'link1', browser, 'c', false],
    ['2026-10-25T15:00:00Z', 'link2', browser, 'd', false],
    ['2026-10-25T13:00:00Z', 'link1', browser, 'e', false],
    ['invalid date', 'link1', browser, 'f', false],
    ['', 'link1', browser, 'g', false],
    ['2026-10-25T16:00:00Z', 'not-in-catalog', browser, 'h', false]
  ]);
  let reads = 0;
  const originalOpen = context.SpreadsheetApp.openById;
  context.SpreadsheetApp.openById = (id) => { reads++; return originalOpen(id); };
  const stats = context.getClickStats_([
    { id: 'link1', spreadsheetId: 'sheet1', aba: 'Cliques' },
    { id: 'link2', spreadsheetId: 'sheet1', aba: 'Cliques' }
  ]);
  const recent = JSON.parse(JSON.stringify(stats.link1.recentClicks));
  assert.deepEqual(recent.map(click => click.timestampMs), [14, 13, 12].map(hour => Date.parse(`2026-10-25T${hour}:00:00Z`)));
  assert.deepEqual(recent.map(click => click.isBot), [true, false, false]);
  assert.equal(recent[0].timestamp, '2026-10-25T14:00:00.000Z');
  assert.equal(stats.link1.total, 6);
  assert.equal(stats.link2.recentClicks.length, 1);
  assert.equal(stats['not-in-catalog'], undefined);
  assert.equal(reads, 1, 'links sharing a sheet must reuse the existing metrics read');
});

test('missing date column or unreadable sheet is unavailable, not an empty preview', () => {
  const context = statsFixture([]);
  context.SpreadsheetApp.openById = () => { throw new Error('No access'); };
  assert.equal(context.getClickStats_([{ id: 'link1', spreadsheetId: 'sheet1' }]).link1.recentClicks, null);

  context.SpreadsheetApp.openById = () => ({ getSheetByName: () => ({
    getLastRow: () => 2,
    getDataRange: () => ({ getValues: () => [['link_id'], ['link1']] })
  }) });
  assert.equal(context.getClickStats_([{ id: 'link1', spreadsheetId: 'sheet1' }]).link1.recentClicks, null);
});

test('catalog skips click sheets; metrics serialize bounded previews and empty links', () => {
  const context = statsFixture([['2026-10-25T14:00:00Z', 'link1', 'Googlebot', 'bot1', true]]);
  context.getRegistry_ = () => ({ getSheetByName: () => ({
    getLastRow: () => 3,
    getDataRange: () => ({ getValues: () => [
      ['id', 'nome', 'campanha', 'spreadsheetId', 'aba', 'destinoUrl', 'ativo'],
      ['link1', 'One', 'Campaign', 'sheet1', 'Cliques', 'https://example.com', true],
      ['link2', 'Two', 'Campaign', 'sheet1', 'Cliques', 'https://example.com', true]
    ] })
  }) });
  const originalOpen = context.SpreadsheetApp.openById;
  let reads = 0;
  context.SpreadsheetApp.openById = id => { reads++; return originalOpen(id); };
  assert.equal(context.getAllLinks_(false)[0].recentClicks, undefined);
  assert.equal(reads, 0);
  const links = JSON.parse(JSON.stringify(context.getAllLinks_()));
  assert.equal(reads, 1);
  assert.equal(links.find(link => link.id === 'link1').recentClicks[0].isBot, true);
  assert.deepEqual(links.find(link => link.id === 'link2').recentClicks, []);
});

test('history filters the selected link even when another link shares its sheet', () => {
  const context = statsFixture([
    [new Date(), 'link1', 'Mozilla/5.0 Chrome/130 Safari/537.36', 'a', false],
    [new Date(), 'link2', 'Mozilla/5.0 Chrome/130 Safari/537.36', 'b', false],
    [new Date(), 'link2', 'Googlebot', 'c', true],
  ]);
  context.getAllLinks_ = () => [
    { id: 'link1', name: 'One', campaign: 'Koyo', spreadsheetId: 'shared' },
    { id: 'link2', name: 'Two', campaign: 'AAPVR', spreadsheetId: 'shared' },
  ];
  context.CacheService = { getScriptCache: () => ({ get: () => null, put() {} }) };
  context.analyticsCacheKey_ = () => 'history-test';
  context.Utilities.formatDate = (date, tz, pattern) => {
    if (pattern === 'yyyy-MM-dd') return date.toISOString().slice(0, 10);
    if (pattern === 'H') return String(date.getUTCHours());
    return date.toISOString();
  };
  const result = context.getAnalytics_({ campaign: 'AAPVR', linkId: 'link2', days: 30 });
  assert.equal(result.clickRecords.length, 2);
  assert.ok(result.clickRecords.every(click => click.linkId === 'link2'));
  assert.ok(result.clickRecords.some(click => click.isBot));
  assert.equal(result.totalClicks, 1, 'suspected bots stay in history but outside human charts');
  assert.equal(context.getAnalytics_({ campaign: 'Koyo', linkId: 'link2', days: 30 }).clickRecords.length, 0);
});
