import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Clock3, MousePointerClick, RefreshCw, TrendingUp, Trash2 } from 'lucide-react';
import { LinkRecord } from '../services/store.ts';

type AnalyticsData = {
  campaign: string;
  linkId: string;
  days: number;
  totalClicks: number;
  daily: Array<{ date: string; label: string; clicks: number }>;
  hourly: Array<{ hour: number; clicks: number }>;
  topLinks: Array<{ id: string; name: string; clicks: number }>;
  clickRecords: Array<{ rowNumber: number; linkId: string; linkName: string; campaign: string; source: string; clickId: string; timestampMs: number; timestamp: string; isBot: boolean }>;
};

type Props = {
  links: LinkRecord[];
  campaigns: string[];
  initialLink?: LinkRecord | null;
  onClicksDeleted?: () => void;
};

const cardClass = 'rounded-2xl border border-slate-800 bg-slate-900/80 p-5';

export function AnalyticsPanel({ links, campaigns, initialLink, onClicksDeleted }: Props) {
  const [campaign, setCampaign] = useState(initialLink ? initialLink.campaign || 'all' : campaigns[0] || 'all');
  const [linkId, setLinkId] = useState(initialLink?.id || 'all');
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedClicks, setSelectedClicks] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');
  const loadVersion = useRef(0);
  const historyRef = useRef<HTMLDivElement>(null);
  const shouldFocusHistory = useRef(Boolean(initialLink));

  const campaignLinks = useMemo(
    () => links.filter(link => campaign === 'all' || link.campaign === campaign),
    [links, campaign]
  );

  useEffect(() => {
    if (linkId !== 'all' && !campaignLinks.some(link => link.id === linkId)) setLinkId('all');
  }, [campaignLinks, linkId]);

  const loadAnalytics = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError('');
    setData(null);
    setSelectedClicks([]);
    try {
      const response = await fetch('/api/admin/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign, linkId, days }),
      });
      const result = await response.json();
      if (version !== loadVersion.current) return;
      if (!response.ok) throw new Error(result?.error || 'Não foi possível montar os gráficos.');
      setData(result as AnalyticsData);
    } catch (err: any) {
      if (version === loadVersion.current) setError(err?.message || 'Não foi possível carregar os dados.');
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [campaign, linkId, days]);

  useEffect(() => {
    setDeleteMessage('');
    void loadAnalytics();
    return () => { loadVersion.current++; };
  }, [loadAnalytics]);

  useEffect(() => {
    if (!loading && data && shouldFocusHistory.current && historyRef.current) {
      shouldFocusHistory.current = false;
      historyRef.current.focus({ preventScroll: true });
      historyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, data]);

  const peakHour = data?.hourly.reduce((best, item) => item.clicks > best.clicks ? item : best, { hour: 0, clicks: 0 });
  const peakDay = data?.daily.reduce((best, item) => item.clicks > best.clicks ? item : best, { date: '', label: '—', clicks: 0 });
  const maxDaily = Math.max(1, ...(data?.daily.map(item => item.clicks) || [0]));
  const maxHourly = Math.max(1, ...(data?.hourly.map(item => item.clicks) || [0]));
  const maxLink = Math.max(1, ...(data?.topLinks.map(item => item.clicks) || [0]));
  const clickKey = (item: AnalyticsData['clickRecords'][number]) => `${item.linkId}|${item.rowNumber}|${item.timestampMs}|${item.clickId}`;
  const deleteSelected = async () => {
    const items = (data?.clickRecords || []).filter(item => selectedClicks.includes(clickKey(item)));
    if (!items.length) return;
    if (!window.confirm(`Apagar ${items.length} registro(s) de clique das planilhas? Essa ação não pode ser desfeita.`)) return;
    setDeleting(true); setDeleteMessage('');
    try {
      const response = await fetch('/api/admin/clicks/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filters: { campaign, linkId, days }, items: items.map(({ linkId, rowNumber, timestampMs, clickId }) => ({ linkId, rowNumber, timestampMs, clickId })) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Não foi possível apagar os cliques.');
      setSelectedClicks([]); setDeleteMessage(`${result.deletedCount || items.length} clique(s) apagado(s).`);
      onClicksDeleted?.();
      await loadAnalytics();
    } catch (err: any) { setError(err?.message || 'Erro ao apagar cliques.'); }
    finally { setDeleting(false); }
  };

  return (
    <section className="space-y-5" aria-label="Gráficos de cliques">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Gráficos da campanha</h1>
          <p className="mt-1 text-sm text-slate-400">Os dados são consultados ao abrir esta aba. Cliques marcados como bots ficam fora dos gráficos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-400">Campanha
            <select value={campaign} disabled={deleting} onChange={event => { setLinkId('all'); setCampaign(event.target.value); }} className="ml-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100">
              <option value="all">Todas</option>
              {campaigns.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Link
            <select value={linkId} disabled={deleting} onChange={event => setLinkId(event.target.value)} className="ml-2 max-w-48 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100">
              <option value="all">Todos os links</option>
              {campaignLinks.map(link => <option key={link.id} value={link.id}>{link.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Período
            <select value={days} disabled={deleting} onChange={event => setDays(Number(event.target.value))} className="ml-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100">
              <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option>
            </select>
          </label>
          <button type="button" onClick={() => void loadAnalytics()} disabled={loading || deleting} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-200">{error}</div>}
      {loading && !data && <div role="status" className={`${cardClass} py-12 text-center text-sm text-slate-400`}>Buscando os cliques nas planilhas desta seleção…</div>}
      {!loading && !error && data?.totalClicks === 0 && <div className={`${cardClass} py-12 text-center text-sm text-slate-400`}>Nenhum clique válido neste período para essa seleção.</div>}

      {data && (
        <>
          {loading && <p role="status" className="text-xs text-slate-500">Atualizando gráficos…</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className={cardClass}><div className="flex items-center gap-2 text-xs text-slate-400"><MousePointerClick className="h-4 w-4 text-emerald-400" /> Cliques válidos no período</div><p className="mt-3 text-3xl font-bold text-slate-100">{data.totalClicks.toLocaleString('pt-BR')}</p></div>
            <div className={cardClass}><div className="flex items-center gap-2 text-xs text-slate-400"><TrendingUp className="h-4 w-4 text-teal-400" /> Dia de maior movimento</div><p className="mt-3 text-2xl font-bold text-slate-100">{peakDay?.label || '—'} <span className="text-sm font-medium text-slate-400">· {peakDay?.clicks || 0} cliques</span></p></div>
            <div className={cardClass}><div className="flex items-center gap-2 text-xs text-slate-400"><Clock3 className="h-4 w-4 text-cyan-400" /> Horário de pico</div><p className="mt-3 text-2xl font-bold text-slate-100">{String(peakHour?.hour || 0).padStart(2, '0')}h <span className="text-sm font-medium text-slate-400">· {peakHour?.clicks || 0} cliques</span></p></div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className={cardClass}>
              <div className="mb-5 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-emerald-400" /><h2 className="text-sm font-semibold text-slate-100">Cliques por dia</h2></div>
              <div className="flex h-52 items-end gap-1 border-b border-l border-slate-700 px-2 pb-1">
                {data.daily.map((item, index) => <div key={item.date} title={`${item.label}: ${item.clicks} cliques`} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
                  <div className="w-full max-w-5 rounded-t bg-emerald-500/80 transition-colors group-hover:bg-emerald-300" style={{ height: `${item.clicks ? Math.max(3, item.clicks / maxDaily * 100) : 0}%` }} />
                  {(index === 0 || index === data.daily.length - 1 || index % Math.ceil(data.daily.length / 6) === 0) && <span className="absolute -bottom-6 whitespace-nowrap text-[9px] text-slate-500">{item.label}</span>}
                </div>)}
              </div>
              <p className="mt-8 text-[11px] text-slate-500">Últimos {days} dias · passe o mouse sobre as barras para ver os valores.</p>
            </div>

            <div className={cardClass}>
              <div className="mb-5 flex items-center gap-2"><Clock3 className="h-4 w-4 text-cyan-400" /><h2 className="text-sm font-semibold text-slate-100">Cliques por horário</h2></div>
              <div className="flex h-52 items-end gap-1 border-b border-l border-slate-700 px-2 pb-1">
                {data.hourly.map(item => <div key={item.hour} title={`${String(item.hour).padStart(2, '0')}h: ${item.clicks} cliques`} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
                  <div className="w-full rounded-t bg-cyan-500/70 transition-colors group-hover:bg-cyan-300" style={{ height: `${item.clicks ? Math.max(3, item.clicks / maxHourly * 100) : 0}%` }} />
                  {item.hour % 3 === 0 && <span className="absolute -bottom-6 text-[9px] text-slate-500">{String(item.hour).padStart(2, '0')}h</span>}
                </div>)}
              </div>
              <p className="mt-8 text-[11px] text-slate-500">Horário de Brasília · todos os dias do período selecionado.</p>
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="mb-4 text-sm font-semibold text-slate-100">Links com mais cliques</h2>
            <div className="space-y-3">
              {data.topLinks.length ? data.topLinks.map(item => <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_3fr_auto] items-center gap-3 text-xs">
                <span className="truncate text-slate-300" title={item.name}>{item.name}</span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.clicks / maxLink * 100}%` }} /></div>
                <span className="w-12 text-right tabular-nums text-slate-400">{item.clicks}</span>
              </div>) : <p className="text-xs text-slate-500">Sem cliques no período.</p>}
            </div>
          </div>
          <div ref={historyRef} tabIndex={-1} aria-label="Histórico de cliques" className={`${cardClass} scroll-mt-6`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-sm font-semibold text-slate-100">Histórico de cliques{linkId !== 'all' ? ` · ${links.find(link => link.id === linkId)?.name || linkId}` : ''}</h2><p className="mt-1 text-xs text-slate-400">Até 100 registros nos últimos {days} dias, incluindo bots suspeitos. Altere o período acima para consultar outros intervalos disponíveis. A exclusão remove a linha da planilha.</p></div>
              <button type="button" onClick={() => void deleteSelected()} disabled={!selectedClicks.length || deleting} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-300 disabled:opacity-40"><Trash2 className="h-4 w-4" />{deleting ? 'Apagando…' : `Apagar selecionados (${selectedClicks.length})`}</button>
            </div>
            {deleteMessage && <p role="status" className="mb-3 text-xs text-emerald-400">{deleteMessage}</p>}
            <div className="max-h-[28rem] overflow-auto rounded-lg border border-slate-800">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-800 text-slate-300"><tr><th className="p-2"><input aria-label="Selecionar todos os registros visíveis" type="checkbox" checked={Boolean(data.clickRecords.length) && selectedClicks.length === data.clickRecords.length} onChange={event => setSelectedClicks(event.target.checked ? data.clickRecords.map(clickKey) : [])} /></th><th className="p-2">Data e hora</th><th className="p-2">Campanha / link</th><th className="p-2">Origem</th><th className="p-2">Tipo</th></tr></thead>
                <tbody>{data.clickRecords.map(item => <tr key={clickKey(item)} className="border-t border-slate-800 text-slate-300"><td className="p-2"><input aria-label={`Selecionar clique de ${item.linkName} em ${item.timestamp}`} type="checkbox" checked={selectedClicks.includes(clickKey(item))} onChange={event => setSelectedClicks(current => event.target.checked ? [...current, clickKey(item)] : current.filter(key => key !== clickKey(item)))} /></td><td className="whitespace-nowrap p-2">{item.timestamp}</td><td className="p-2"><span className="block font-medium text-slate-200">{item.linkName}</span><span className="text-slate-500">{item.campaign}</span></td><td className="p-2">{item.source || 'Direto'}</td><td className="p-2">{item.isBot ? 'Bot suspeito' : 'Humano (est.)'}</td></tr>)}</tbody>
              </table>
              {!data.clickRecords.length && <p className="p-5 text-center text-xs text-slate-500">Nenhum registro recente neste período.</p>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
