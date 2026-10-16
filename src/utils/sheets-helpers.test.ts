import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSpreadsheetId,
  buildWhatsAppUrl,
  validateDestinationUrl,
  SHEET_TABS,
  LINKS_COLUMNS,
  CLIQUES_COLUMNS,
  RESUMO_COLUMNS,
} from './sheets-helpers.ts';

test('extractSpreadsheetId extracts ID correctly from standard edit URL', () => {
  const url = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0';
  assert.equal(extractSpreadsheetId(url), '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
});

test('extractSpreadsheetId handles URL with trailing slashes and view mode', () => {
  const url = 'https://docs.google.com/spreadsheets/d/1abcDEF-ghi_12345/view';
  assert.equal(extractSpreadsheetId(url), '1abcDEF-ghi_12345');
});

test('extractSpreadsheetId accepts raw valid spreadsheet ID', () => {
  const rawId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
  assert.equal(extractSpreadsheetId(rawId), rawId);
});

test('extractSpreadsheetId returns null on invalid or empty string', () => {
  assert.equal(extractSpreadsheetId(''), null);
  assert.equal(extractSpreadsheetId('https://example.com/not-a-sheet'), null);
  assert.equal(extractSpreadsheetId('short'), null);
});

test('buildWhatsAppUrl strips non-numeric characters and formats correctly', () => {
  const result = buildWhatsAppUrl('+55 (11) 98765-4321', 'Olá! Gostaria de mais informações.');
  assert.equal(
    result,
    'https://wa.me/5511987654321?text=Ol%C3%A1!%20Gostaria%20de%20mais%20informa%C3%A7%C3%B5es.'
  );
});

test('buildWhatsAppUrl works without message', () => {
  const result = buildWhatsAppUrl('5511999999999');
  assert.equal(result, 'https://wa.me/5511999999999');
});

test('buildWhatsAppUrl throws on empty phone number', () => {
  assert.throws(() => buildWhatsAppUrl('abc'), /Número de WhatsApp inválido/);
});

test('validateDestinationUrl validates valid http/https URLs', () => {
  const res = validateDestinationUrl('https://meusite.com.br/promo?utm=1');
  assert.equal(res.isValid, true);
  assert.equal(res.normalizedUrl, 'https://meusite.com.br/promo?utm=1');
});

test('validateDestinationUrl rejects invalid protocols like javascript:', () => {
  const res = validateDestinationUrl('javascript:alert(1)');
  assert.equal(res.isValid, false);
});

test('column and tab definitions adhere to required specs', () => {
  assert.equal(SHEET_TABS.LINKS, 'Links');
  assert.equal(SHEET_TABS.CLIQUES, 'Cliques');
  assert.equal(SHEET_TABS.RESUMO, 'Resumo');

  assert.ok(LINKS_COLUMNS.includes('ID do link'));
  assert.ok(LINKS_COLUMNS.includes('Link rastreável'));
  assert.ok(CLIQUES_COLUMNS.includes('Data e hora'));
  assert.ok(CLIQUES_COLUMNS.includes('Bot suspeito'));
  assert.ok(RESUMO_COLUMNS.includes('Cliques reais'));
});
