/**
 * Pure utilities for click tracking, ID generation, duplicate detection, and summary statistics.
 */

/**
 * Generates a URL-safe short alphanumeric identifier (e.g. 7 characters).
 */
export function generateShortId(length = 7): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // exclude confusing chars like 0, O, 1, l, I
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Formats a Date object into 'America/Sao_Paulo' timezone string:
 * DD/MM/YYYY, HH:mm:ss
 */
export function formatSaoPauloDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export interface MinimalClick {
  visitorId: string;
  timestampMs: number;
}

/**
 * Detects whether a click from the same visitor on the same link occurred
 * within the recent time window (default: 8 seconds).
 */
export function isDuplicateClick(
  recentClicks: MinimalClick[],
  currentVisitorId: string,
  currentTimestampMs: number,
  thresholdSeconds = 8
): boolean {
  if (!recentClicks || !currentVisitorId) return false;
  const thresholdMs = thresholdSeconds * 1000;

  return recentClicks.some((click) => {
    return (
      click.visitorId === currentVisitorId &&
      currentTimestampMs - click.timestampMs >= 0 &&
      currentTimestampMs - click.timestampMs <= thresholdMs
    );
  });
}

export interface ClickRecordForMetrics {
  isSuspectBot: boolean;
  isDuplicate: boolean;
  visitorId: string;
}

export interface ResumoMetrics {
  totalClicks: number;
  realClicks: number;
  uniqueVisitors: number;
  suspectBots: number;
}

/**
 * Computes summary statistics according to business rules:
 * - totalClicks: All recorded clicks.
 * - suspectBots: Rows where isSuspectBot is true.
 * - realClicks: Total clicks excluding suspectBots.
 * - uniqueVisitors: Estimated count of distinct anonymous visitors among real clicks.
 */
export function computeResumoMetrics(clicks: ClickRecordForMetrics[]): ResumoMetrics {
  const totalClicks = clicks.length;
  const suspectBots = clicks.filter((c) => c.isSuspectBot).length;
  const realClicksList = clicks.filter((c) => !c.isSuspectBot);
  const realClicks = realClicksList.length;

  const uniqueVisitors = new Set(
    realClicksList.map((c) => c.visitorId).filter(Boolean)
  ).size;

  return {
    totalClicks,
    realClicks,
    uniqueVisitors,
    suspectBots,
  };
}
