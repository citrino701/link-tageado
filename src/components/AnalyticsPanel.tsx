import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Clock3, MousePointerClick, RefreshCw, TrendingUp } from 'lucide-react';
import { LinkRecord } from '../services/store.ts';

type AnalyticsData = {
  campaign: string;
  linkId: string;
  days: number;
  totalClicks: number;
  daily: Array<{ date: string; label: string; clicks: number }>;
  hourly: Array<{ hour: number; clicks: number }>;
  topLinks: Array<{ id: string; name: string; clicks: number }>;
};

type Props = { links: LinkRecord[]; campaigns: string[] };

const cardClass = 'rounded-2xl border border-slate-800 bg-slate-900/80 p-5';

export function AnalyticsPanel({ links, campaigns }: Props) {
  const [campaign, setCampaign] = useState(campaigns[0] || 'all');
  const [linkId, setLinkId] = useState('all');
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const campaignLinks = useMemo(
    () => links.filter(link => campaign === 'all' || link.campaign === campaign),
    [links, campaign]
  );

  useEffect(() => {
    if (linkId !== 'all' && !campaignLinks.some(link => link.id === linkId)) setLinkId('all');
  }, [campaignLinks, linkId]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign, linkId, days }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Não foi possível montar os gráficos.');
      setData(result as AnalyticsData);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAnalytics(); }, [campaign, linkId, days]);

  const peakHour = data?.hourly.reduce((best, item) => item.clicks > best.clicks ? item : best, { hour: 0, clicks: 0 });
  const peakDay = data?.daily.reduce((best, item) => item.clicks > best.clicks ? item : best, { date: '', label: '—', clicks: 0 });
  const maxDaily = Math.max(1, ...(data?.daily.map(item => item.clicks) || [0]));
  const maxHourly = Math.max(1, ...(data?.hourly.map(item => item.clicks) || [0]));
  const maxLink = Math.max(1, ...(data?.topLinks.map(item => item.clicks) || [0]));

  return (
    <section className="space-y-5" aria-label="Gráficos de cliques">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Gráficos da campanha</h1>
          <p className="mt-1 text-sm text-slate-400">Os dados são consultados ao abrir esta aba. Cliques marcados como bots ficam fora dos gráficos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-400">Campanha
            <select value={campaign} onChange={event => setCampaign(event.target.value)} className="ml-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100">
              <option value="all">Todas</option>
              {campaigns.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Link
            <select value={linkId} onChange={event => setLinkId(event.target.value)} className="ml-2 max-w-48 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100">
              <option value="all">Todos os links</option>
              {campaignLinks.map(link => <option key={link.id} value={link.id}>{link.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Período
            <select value={days} onChange={event => setDays(Number(event.target.value))} className="ml-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100">
              <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option>
            </select>
          </label>
          <button type="button" onClick={() => void loadAnalytics()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50">
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
        </>
      )}
    </section>
  );
}
