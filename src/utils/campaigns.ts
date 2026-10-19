import type { LinkRecord } from '../services/store.ts';
import { extractSpreadsheetId } from './sheets-helpers.ts';

export interface CampaignTarget {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  aba: string;
}

export interface CampaignOption {
  name: string;
  targets: CampaignTarget[];
}

export function campaignCatalog(links: LinkRecord[]): CampaignOption[] {
  const campaigns = new Map<string, CampaignOption>();
  for (const link of links) {
    const name = link.campaign.trim();
    const id = extractSpreadsheetId(link.spreadsheetUrl) || link.spreadsheetId;
    if (!name || !id) continue;
    const entry = campaigns.get(name) || { name, targets: [] };
    const aba = link.aba || 'Cliques';
    if (!entry.targets.some(t => t.spreadsheetId === id && t.aba === aba)) {
      entry.targets.push({ spreadsheetId: id, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${id}/edit`, title: link.spreadsheetTitle || 'Planilha Google', aba });
    }
    campaigns.set(name, entry);
  }
  return [...campaigns.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function campaignsForSheet(catalog: CampaignOption[], url: string) {
  const id = extractSpreadsheetId(url);
  return id ? catalog.filter(c => c.targets.some(t => t.spreadsheetId === id)) : [];
}

export function resolveCampaign(catalog: CampaignOption[], name: string, url: string, aba = '') {
  const id = extractSpreadsheetId(url);
  if (url.trim() && !id) throw new Error('Cole um link válido da Planilha Google.');
  const sameSheet = campaignsForSheet(catalog, url);
  const matches = catalog.filter(c => c.name.toLowerCase() === name.trim().toLowerCase());
  let entry = matches.find(c => c.name === name.trim()) || (matches.length === 1 ? matches[0] : undefined);
  if (!entry && sameSheet.length === 1) entry = sameSheet[0];
  if (!entry && sameSheet.length > 1) throw new Error('Esta planilha pertence a mais de uma campanha. Selecione a campanha desejada.');
  if (entry) {
    let targets = entry.targets.filter(t => !id || t.spreadsheetId === id);
    if (aba) targets = targets.filter(t => t.aba === aba);
    if (targets.length === 0) throw new Error('A planilha informada não pertence à campanha selecionada. Selecione a campanha novamente.');
    if (targets.length > 1) throw new Error('Esta campanha possui mais de uma planilha ou aba. Escolha onde registrar os cliques.');
    return { campaign: entry.name, spreadsheetUrl: targets[0].spreadsheetUrl, aba: targets[0].aba };
  }
  if (!name.trim()) throw new Error('Defina o nome da campanha.');
  if (!id) throw new Error('Cole a planilha da nova campanha ou selecione uma campanha existente.');
  return { campaign: name.trim(), spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${id}/edit`, aba: 'Cliques' };
}
