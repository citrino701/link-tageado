import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
function fixture(headerCount = 19) {
  const context = vm.createContext({});
  vm.runInContext(source, context);
  const columns = vm.runInContext('CLICK_HEADERS.slice()', context);
  const headers = Array.from(columns.slice(0, headerCount));
  const rows = [];
  let reads = 0;
  const sheet = {
    getLastRow: () => 1 + rows.length,
    getLastColumn: () => headers.length,
    getRange: (row, column) => ({
      getValues: () => { reads++; return [headers.slice()]; },
      setValue: value => { headers[column - 1] = value; },
      createTextFinder: () => ({ matchEntireCell: () => ({ findNext: () => false }) }),
    }),
    appendRow: row => rows.push(Array.from(row)),
  };
  context.SpreadsheetApp = { openById: () => ({ getSheetByName: () => sheet }) };
  context.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
  return { context, headers, rows, reads: () => reads };
}

for (const count of [16, 19]) {
  test(`tracker reads headers once and records the click with ${count}-column schema`, () => {
    const f = fixture(count);
    f.context.appendClick_({ id: 'test', spreadsheetId: 'sheet', nome: 'Story', campanha: 'Primavera', destinoUrl: 'https://example.com' }, { click_id: 'click123', ua: 'browser', utm_source: '=FORMULA' });
    assert.equal(f.reads(), 1);
    assert.equal(f.headers.length, 19);
    assert.equal(f.rows.length, 1);
    assert.equal(f.rows[0][3], 'Primavera');
    assert.equal(f.rows[0][6], "'=FORMULA");
    assert.equal(f.rows[0][18], 'click123');
  });
}

test('tracker rejects a mismatched header without appending a click', () => {
  const f = fixture();
  f.headers[0] = 'unrelated data';
  assert.throws(() => f.context.appendClick_({ spreadsheetId: 'sheet' }, {}), /cabeçalho diferente/);
  assert.equal(f.rows.length, 0);
});

test('redirect response is returned after click registration, and failure still enters the retry path', () => {
  const f = fixture();
  const calls = [];
  f.context.findLink_ = () => ({ destinoUrl: 'https://example.com' });
  f.context.makeResponse_ = result => { calls.push('response'); return result; };
  f.context.appendClick_ = () => calls.push('append');
  f.context.saveFailure_ = () => calls.push('queue');
  const event = { parameter: { id: 'test', click_id: 'click123' } };
  assert.equal(f.context.doGet(event).ok, true);
  assert.deepEqual(calls, ['append', 'response']);
  calls.length = 0;
  f.context.appendClick_ = () => { throw new Error('Sheet unavailable'); };
  assert.equal(f.context.doGet(event).destination, 'https://example.com');
  assert.deepEqual(calls, ['queue', 'response']);
});

function bridgeParams(search) {
  const html = fs.readFileSync(new URL('../../docs/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  let requestUrl;
  const crypto = { randomUUID: () => 'test-id' };
  vm.runInNewContext(script, {
    URL, URLSearchParams, crypto,
    window: { location: { search }, crypto, setTimeout() {} },
    localStorage: { getItem: () => 'visitor1' },
    navigator: { userAgent: 'browser', language: 'pt-BR' },
    document: { referrer: '', createElement: () => ({}), head: { appendChild: el => { requestUrl = el.src; } } },
  });
  return Object.fromEntries(new URL(requestUrl).searchParams);
}

test('compact bridge URL preserves registry origin and every stored tag in the click row', () => {
  const f = fixture();
  const params = bridgeParams('?id=test');
  assert.equal(params.origem, undefined);
  f.context.appendClick_({ id: 'test', spreadsheetId: 'sheet', nome: 'Story', campanha: 'Primavera', source: 'Instagram_Stories', medium: 'Social', content: 'Video_01' }, params);
  const row = f.rows[0];
  assert.equal(row[5], 'Instagram_Stories');
  assert.equal(row[6], 'Instagram_Stories');
  assert.equal(row[7], 'Social');
  assert.equal(row[8], 'Primavera');
  assert.equal(row[9], 'Video_01');
});

test('older shared URLs can still override the stored tags', () => {
  const f = fixture();
  const params = bridgeParams('?id=test&utm_source=QR_Code&utm_medium=impresso&utm_campaign=Evento&utm_content=Cartaz&utm_term=teste');
  f.context.appendClick_({ id: 'test', spreadsheetId: 'sheet', campanha: 'Primavera', source: 'Instagram', medium: 'Social', content: 'Video' }, params);
  assert.deepEqual(f.rows[0].slice(5, 11), ['QR_Code', 'QR_Code', 'impresso', 'Evento', 'Cartaz', 'teste']);
  assert.equal(bridgeParams('?id=test&origem=Manual&utm_source=QR_Code').origem, 'Manual');
});
