import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');

function statsFixture(rows) {
  const context = vm.createContext({});
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
