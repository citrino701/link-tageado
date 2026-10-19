import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import type { LinkRecord } from '../services/store.ts';
import { campaignCatalog, resolveCampaign } from './campaigns.ts';

const sheetA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const sheetB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const sheetC = 'cccccccccccccccccccccccccccccc';
const url = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;
const link = (campaign: string, spreadsheetId = sheetA, aba = 'Cliques') => ({
  id: `${campaign}-${spreadsheetId}`, campaign, spreadsheetId, spreadsheetUrl: url(spreadsheetId),
  spreadsheetTitle: 'Campanha', aba, status: 'active',
}) as LinkRecord;
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../../apps-script/admin/Code.gs', import.meta.url), 'utf8'), context);

// Exercise the same user cases against the frontend and deployed Apps Script resolver.
for (const implementation of ['frontend', 'backend']) {
  const resolve = (links: LinkRecord[], name: string, sheet = '', aba = '') => implementation === 'frontend'
    ? resolveCampaign(campaignCatalog(links), name, sheet, aba)
    : JSON.parse(JSON.stringify(context.resolveCampaign_({ campaign: name, spreadsheetUrl: sheet, aba }, links)));

  test(`${implementation}: existing campaign supplies the sheet and original name`, () => {
    const result = resolve([link('Primavera')], ' primavera ');
    assert.equal(result.campaign, 'Primavera');
    assert.equal(result.spreadsheetUrl, url(sheetA));
  });
  test(`${implementation}: pasting a known sheet recognizes its campaign`, () => {
    const result = resolve([link('Primavera')], '', url(sheetA) + '#gid=30');
    assert.equal(result.campaign, 'Primavera');
  });
  test(`${implementation}: known sheet preserves the registered name instead of making a duplicate`, () => {
    assert.equal(resolve([link('Primavera')], 'New name', sheetA).campaign, 'Primavera');
  });
  test(`${implementation}: new campaign and new sheet`, () => {
    const result = resolve([link('Primavera')], '  Verão  ', url(sheetB));
    assert.equal(result.campaign, 'Verão');
    assert.equal(result.aba, 'Cliques');
  });
  test(`${implementation}: conflicting existing pairs cannot write to the wrong sheet`, () => {
    assert.throws(() => resolve([link('Primavera'), link('Verão', sheetB)], 'Primavera', url(sheetB)), /não pertence/);
  });
  test(`${implementation}: a sheet shared by two campaigns needs a selection`, () => {
    const links = [link('Primavera'), link('Verão')];
    assert.throws(() => resolve(links, '', url(sheetA)), /mais de uma campanha/);
    assert.equal(resolve(links, 'Verão', url(sheetA)).campaign, 'Verão');
  });
  test(`${implementation}: multiple campaign sheets require a target, never the first one`, () => {
    const links = [link('Primavera'), link('Primavera', sheetB)];
    assert.throws(() => resolve(links, 'Primavera'), /mais de uma planilha/);
    assert.equal(resolve(links, 'Primavera', url(sheetB)).spreadsheetUrl, url(sheetB));
  });
  test(`${implementation}: retain a legacy tab and require choice if the same sheet has two tabs`, () => {
    const links = [link('Primavera', sheetA, 'Registro antigo')];
    assert.equal(resolve(links, 'Primavera').aba, 'Registro antigo');
    links.push(link('Primavera'));
    assert.throws(() => resolve(links, 'Primavera', url(sheetA)), /mais de uma planilha/);
    assert.equal(resolve(links, 'Primavera', url(sheetA), 'Registro antigo').aba, 'Registro antigo');
  });
  test(`${implementation}: new campaign requires a valid sheet`, () => {
    assert.throws(() => resolve([], 'Campanha'));
    assert.throws(() => resolve([], 'Campanha', 'invalid'));
    assert.equal(resolve([], '__proto__', url(sheetC)).campaign, '__proto__');
  });
}

test('catalog includes inactive links and deduplicates repeated campaign-sheet pairs', () => {
  const data = [link('Primavera'), link('Primavera'), { ...link('Antiga', sheetB), status: 'inactive' as const }];
  const catalog = campaignCatalog(data);
  assert.equal(catalog.length, 2);
  assert.equal(catalog.find(c => c.name === 'Primavera')?.targets.length, 1);
});

test('bootstrap reads the registry without reading any click sheets', () => {
  let historyReads = 0;
  const rows = [['id', 'nome', 'campanha', 'spreadsheetId', 'aba', 'destinoUrl', 'ativo'], ['link1', 'Stories', 'Primavera', sheetA, 'Cliques', 'https://example.com', true]];
  context.assertAdmin_ = () => 'owner@example.com';
  context.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'setup-date' }) };
  context.getRegistry_ = () => ({ getSheetByName: () => ({ getLastRow: () => 2, getDataRange: () => ({ getValues: () => rows }) }) });
  context.getClickStats_ = () => { historyReads++; return {}; };
  const response = context.apiRequest('GET', '/api/admin/bootstrap', '');
  assert.equal(response.status, 200);
  assert.equal(response.body.links[0].campaign, 'Primavera');
  assert.equal(historyReads, 0);
  context.apiRequest('GET', '/api/admin/links', '');
  assert.equal(historyReads, 1);
});

test('createLink persists the resolved campaign, sheet and legacy tab when no URL is supplied', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('../../apps-script/admin/Code.gs', import.meta.url), 'utf8'), ctx);
  const headers = Array.from(vm.runInContext('REGISTRY_HEADERS', ctx)) as string[];
  let saved: unknown[] = [];
  let destination = '';
  let tab = '';
  ctx.getAllLinks_ = () => [link('Primavera', sheetA, 'Registro antigo')];
  ctx.SpreadsheetApp = { openById: (id: string) => { destination = id; return { getName: () => 'Planilha' }; } };
  ctx.ensureClickSheet_ = (_sheet: unknown, name: string) => { tab = name; };
  ctx.getRegistry_ = () => ({ getSheetByName: () => ({ appendRow: (row: unknown[]) => { saved = row; } }) });
  ctx.ensureRegistrySchema_ = () => Object.fromEntries(headers.map((name, i) => [name, i]));
  ctx.generateUniqueId_ = () => 'new-link';
  ctx.assertAdmin_ = () => 'owner@example.com';
  const result = ctx.createLink_({ name: 'Story novo', campaign: 'Primavera', source: 'Instagram', destinationType: 'url', destinationUrl: 'https://example.com' });
  assert.equal(destination, sheetA);
  assert.equal(tab, 'Registro antigo');
  assert.equal(saved[headers.indexOf('campanha')], 'Primavera');
  assert.equal(saved[headers.indexOf('aba')], 'Registro antigo');
  assert.equal(result.spreadsheetUrl, url(sheetA));
  assert.equal(result.name, 'Story novo');
});
