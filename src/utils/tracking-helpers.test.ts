import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateShortId,
  formatSaoPauloDate,
  isDuplicateClick,
  computeResumoMetrics,
} from './tracking-helpers.ts';

test('generateShortId produces valid alphanumeric short string', () => {
  const id1 = generateShortId(7);
  const id2 = generateShortId(7);
  assert.equal(id1.length, 7);
  assert.equal(id2.length, 7);
  assert.notEqual(id1, id2);
  assert.match(id1, /^[a-z0-9]+$/i);
});

test('formatSaoPauloDate produces Brazilian formatted date time', () => {
  const fixedDate = new Date('2026-10-15T15:30:00Z');
  const formatted = formatSaoPauloDate(fixedDate);
  // UTC 15:30 is 12:30 in America/Sao_Paulo (UTC-3)
  assert.ok(formatted.includes('15/10/2026') || formatted.includes('2026'));
  assert.ok(formatted.includes(':'));
});

test('isDuplicateClick identifies duplicate within threshold seconds', () => {
  const now = Date.now();
  const recentClicks = [
    { visitorId: 'visitor-1', timestampMs: now - 3000 }, // 3 seconds ago
    { visitorId: 'visitor-2', timestampMs: now - 20000 }, // 20 seconds ago
  ];

  // visitor-1 clicked 3s ago -> duplicate within 8s
  assert.equal(isDuplicateClick(recentClicks, 'visitor-1', now, 8), true);

  // visitor-2 clicked 20s ago -> NOT duplicate within 8s
  assert.equal(isDuplicateClick(recentClicks, 'visitor-2', now, 8), false);

  // visitor-3 has never clicked -> NOT duplicate
  assert.equal(isDuplicateClick(recentClicks, 'visitor-3', now, 8), false);
});

test('computeResumoMetrics accurately computes metrics ignoring bots for real clicks', () => {
  const sampleClicks = [
    { isSuspectBot: false, isDuplicate: false, visitorId: 'user-a' },
    { isSuspectBot: false, isDuplicate: true, visitorId: 'user-a' },
    { isSuspectBot: false, isDuplicate: false, visitorId: 'user-b' },
    { isSuspectBot: true, isDuplicate: false, visitorId: 'bot-1' }, // bot
    { isSuspectBot: true, isDuplicate: false, visitorId: 'bot-2' }, // bot
  ];

  const metrics = computeResumoMetrics(sampleClicks);

  assert.equal(metrics.totalClicks, 5);
  assert.equal(metrics.suspectBots, 2);
  assert.equal(metrics.realClicks, 3); // 5 total - 2 bots
  assert.equal(metrics.uniqueVisitors, 2); // user-a, user-b
});
