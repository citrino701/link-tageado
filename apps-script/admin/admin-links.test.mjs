import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');

class FakeSheet {
  constructor(rows = []) { this.rows = rows.map(row => [...row]); }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows[0]?.length || 0; }
  getDataRange() { return { getValues: () => this.rows.map(row => [...row]) }; }
  getRange(row, column, rowCount = 1, columnCount = 1) {
    return {
      getValues: () => this.rows.slice(row - 1, row - 1 + rowCount)
        .map(values => values.slice(column - 1, column - 1 + columnCount)),
      setValue: value => { this.rows[row - 1][column - 1] = value; },
      setValues: values => {
        values.forEach((valuesRow, offset) => { this.rows[row - 1 + offset] = [...valuesRow]; });
      }
    };
  }
  appendRow(row) { this.rows.push([...row]); }
  deleteRow(row) { this.rows.splice(row - 1, 1); }
  setFrozenRows() {}
}

function fixture({ failDeleteSync = false } = {}) {
  const context = vm.createContext({ console });
  vm.runInContext(source, context);
  const headers = vm.runInContext('REGISTRY_HEADERS.slice()', context);
  const row = headers.map(() => '');
  const record = {
    id: 'abc12345',
    nome: 'Instagram bio',
    campanha: 'Outubro',
    spreadsheetId: 'sheet-id',
    aba: 'Cliques',
    destinoUrl: 'https://example.com/',
    ativo: true,
    source: 'Instagram',
    medium: 'social',
    content: 'bio',
    createdAt: '2026-10-20T10:00:00.000Z'
  };
  headers.forEach((header, index) => { if (record[header] !== undefined) row[index] = record[header]; });
  const links = new FakeSheet([headers, row]);
  const sheets = new Map([['Links', links]]);
  const registry = {
    getSheetByName: name => sheets.get(name) || null,
    insertSheet: name => {
      const sheet = new FakeSheet();
      sheets.set(name, sheet);
      return sheet;
    }
  };
  const syncCalls = [];
  context.getRegistry_ = () => registry;
  context.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
  context.syncCloudflareLinks_ = batch => {
    syncCalls.push(batch);
    if (failDeleteSync && batch[0]?.removed) throw new Error('KV fora do ar');
    return true;
  };
  return { context, links, sheets, syncCalls, record };
}

test('delete removes the row from Links, archives it for undo, and removes it from KV', () => {
  const f = fixture();
  assert.equal(f.context.deleteLink_('abc12345'), true);
  assert.equal(f.links.rows.length, 1);
  const archive = f.sheets.get('Links_Excluidos');
  assert.equal(archive.rows.length, 2);
  assert.equal(archive.rows[1][1], 'abc12345');
  assert.equal(JSON.parse(archive.rows[1][2]).values[0], 'abc12345');
  assert.deepEqual(JSON.parse(JSON.stringify(f.syncCalls[0])), [{ id: 'abc12345', removed: true }]);
});

test('undo restores the exact registry row and sends the link back to KV', () => {
  const f = fixture();
  f.context.deleteLink_('abc12345');
  const restored = f.context.restoreDeletedLink_('abc12345');
  assert.equal(restored.id, 'abc12345');
  assert.equal(restored.name, 'Instagram bio');
  assert.equal(f.links.rows.length, 2);
  assert.equal(f.sheets.get('Links_Excluidos').rows.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(f.syncCalls[1])), [{
    id: 'abc12345',
    destinationUrl: 'https://example.com/',
    active: true
  }]);
});

test('failed Cloudflare delete keeps the registry row and clears the temporary archive', () => {
  const f = fixture({ failDeleteSync: true });
  assert.throws(() => f.context.deleteLink_('abc12345'), /Não consegui excluir o link/);
  assert.equal(f.links.rows.length, 2);
  assert.equal(f.sheets.get('Links_Excluidos').rows.length, 1);
});
