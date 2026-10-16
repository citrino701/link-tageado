/**
 * Pure utilities for Google Sheets URL parsing, ID extraction, and tab definitions.
 */

export interface SheetTabsDefinition {
  LINKS: string;
  CLIQUES: string;
  RESUMO: string;
}

export const SHEET_TABS: SheetTabsDefinition = {
  LINKS: 'Links',
  CLIQUES: 'Cliques',
  RESUMO: 'Resumo',
};

export const LINKS_COLUMNS = [
  'ID do link',
  'Nome do link',
  'Campanha',
  'Origem',
  'Meio',
  'Conteúdo',
  'Tipo de destino',
  'Destino',
  'Mensagem',
  'Link rastreável',
  'Criado em',
  'Status',
] as const;

export const CLIQUES_COLUMNS = [
  'Data e hora',
  'ID do clique',
  'ID do link',
  'Nome do link',
  'Campanha',
  'Origem',
  'Meio',
  'Conteúdo',
  'Página de referência',
  'Navegador',
  'Sistema operacional',
  'Tipo de dispositivo',
  'User-Agent',
  'ID anônimo do navegador',
  'Bot suspeito',
  'Clique duplicado',
] as const;

export const RESUMO_COLUMNS = [
  'Nome do link',
  'Origem',
  'Campanha',
  'Cliques totais',
  'Cliques reais',
  'Navegadores únicos estimados',
  'Bots suspeitos',
] as const;

/**
 * Extracts the spreadsheetId from various Google Sheets URL formats.
 * E.g.:
 * - https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
 * - https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
 * - 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms (raw ID)
 */
export function extractSpreadsheetId(urlOrId: string): string | null {
  if (!urlOrId || typeof urlOrId !== 'string') return null;
  const trimmed = urlOrId.trim();

  // If already a clean 30-60 character alphanumeric/dash/underscore ID
  if (/^[a-zA-Z0-9_-]{25,65}$/.test(trimmed)) {
    return trimmed;
  }

  // Regex pattern matching /spreadsheets/d/<ID>
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Normalizes and formats WhatsApp destination URL.
 * wa.me format: https://wa.me/NUMERO?text=MENSAGEM_CODIFICADA
 * Accepts only numbers in phone (e.g. 5511999999999).
 */
export function buildWhatsAppUrl(phoneNumber: string, message?: string): string {
  // Keep only digits
  const cleanPhone = (phoneNumber || '').replace(/\D/g, '');
  if (!cleanPhone) {
    throw new Error('Número de WhatsApp inválido: deve conter apenas dígitos com código do país e DDD.');
  }

  const encodedMsg = message ? encodeURIComponent(message.trim()) : '';
  if (encodedMsg) {
    return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
  }
  return `https://wa.me/${cleanPhone}`;
}

/**
 * Validates external destination URL (must be valid http/https URL).
 */
export function validateDestinationUrl(url: string): { isValid: boolean; normalizedUrl?: string; error?: string } {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL de destino não pode estar vazia.' };
  }
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, error: 'Apenas protocolos HTTP ou HTTPS são permitidos.' };
    }
    return { isValid: true, normalizedUrl: parsed.toString() };
  } catch {
    return { isValid: false, error: 'URL de destino com formato inválido.' };
  }
}
