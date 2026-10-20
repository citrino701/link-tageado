import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  Link2,
  CheckCircle2,
  AlertCircle,
  Layers,
  LayoutGrid,
  Tag,
  BarChart3,
} from 'lucide-react';

import { fetchCatalog, readAdmin } from './api.ts';
import { Navbar } from './components/Navbar.tsx';
import { ConnectSheetsCard } from './components/ConnectSheetsCard.tsx';
import { StatsOverview } from './components/StatsOverview.tsx';
import { CreateLinkModal } from './components/CreateLinkModal.tsx';
import { LinkCard } from './components/LinkCard.tsx';
import { EditLinkModal } from './components/EditLinkModal.tsx';
import { SyncQueueModal } from './components/SyncQueueModal.tsx';
import { DiagnosticTestsModal } from './components/DiagnosticTestsModal.tsx';
import { LinkRecord, SyncQueueItem } from './services/store.ts';
import { AnalyticsPanel } from './components/AnalyticsPanel.tsx';

export default function App() {
  const [adminEmail, setAdminEmail] = useState('hugoviajante@gmail.com');
  const [setupAt, setSetupAt] = useState<string | null>(null);

  // Links & Stats
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isCloudflareSyncing, setIsCloudflareSyncing] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [metricsReady, setMetricsReady] = useState(false);
  const [queueReady, setQueueReady] = useState(false);
  const loadVersion = useRef(0);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sheetFilter, setSheetFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'grid'>('grouped');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkRecord | null>(null);
  const [theme, setTheme] = useState<'night' | 'paper' | 'violet' | 'ocean'>(() => {
    const saved = localStorage.getItem('hub-theme');
    return saved === 'paper' || saved === 'violet' || saved === 'ocean' ? saved : 'night';
  });
  useEffect(() => { localStorage.setItem('hub-theme', theme); }, [theme]);

  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [isTestsModalOpen, setIsTestsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'links' | 'analytics'>('links');

  // Toast
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    action?: { label: string; onClick: () => void | Promise<void> };
  } | null>(null);
  const toastTimeout = useRef<number | null>(null);

  const showToast = (
    message: string,
    type: 'success' | 'error' = 'success',
    action?: { label: string; onClick: () => void | Promise<void> }
  ) => {
    if (toastTimeout.current !== null) window.clearTimeout(toastTimeout.current);
    setToast({ message, type, action });
    toastTimeout.current = window.setTimeout(() => {
      setToast(null);
      toastTimeout.current = null;
    }, action ? 12000 : 4000);
  };

  // Campaigns use only the registry; click history loads after the catalog is visible.
  const loadData = async () => {
    const version = ++loadVersion.current;
    setIsLoading(true);
    setIsCatalogLoading(true);
    setCatalogError('');
    try {
      const data = await fetchCatalog();
      if (version !== loadVersion.current) return;
      setAdminEmail(data.adminEmail || 'hugoviajante@gmail.com');
      setSetupAt(data.setupAt || data.connectedAt || null);
      setLinks(data.links || []);
      setMetricsReady(data.metricsIncluded);
      setIsCatalogLoading(false);

      const results = await Promise.allSettled([
        data.metricsIncluded ? Promise.resolve() : readAdmin<{ links: LinkRecord[] }>('/api/admin/links').then(result => {
          if (version !== loadVersion.current) return;
          const byId = new Map(result.links.map(link => [link.id, link]));
          // Only update counters: a delayed response must not undo a create/delete/status change.
          setLinks(current => current.map(link => {
            const metric = byId.get(link.id);
            return metric ? { ...link,
              totalClicksCount: metric.totalClicksCount,
              realClicksCount: metric.realClicksCount,
              uniqueVisitorsCount: metric.uniqueVisitorsCount,
              suspectBotsCount: metric.suspectBotsCount,
            } : link;
          }));
          setMetricsReady(true);
        }),
        readAdmin<{ queue: SyncQueueItem[] }>('/api/admin/queue').then(result => {
          if (version !== loadVersion.current) return;
          setSyncQueue(result.queue || []);
          setQueueReady(true);
        }),
      ]);
      if (version === loadVersion.current && results.some(r => r.status === 'rejected')) {
        showToast('As campanhas carregaram, mas algumas métricas não atualizaram. Tente Atualizar.', 'error');
      }
    } catch (err: any) {
      if (version === loadVersion.current) setCatalogError(err.message || 'Não foi possível carregar as campanhas.');
    } finally {
      if (version === loadVersion.current) {
        setIsLoading(false);
        setIsCatalogLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadData();
    return () => { loadVersion.current++; };
  }, []);

  // Toggle link status
  const handleToggleStatus = async (id: string, newStatus: 'active' | 'inactive') => {
    try {
      const res = await fetch(`/api/admin/links/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setLinks((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
        );
        showToast(`Link ${newStatus === 'active' ? 'ativado' : 'desativado'} com sucesso.`);
      }
    } catch {
      showToast('Erro ao alterar status do link.', 'error');
    }
  };

  // Delete the registry row and KV entry; click history stays in the campaign sheet.
  const handleDeleteLink = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/links/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-email': adminEmail },
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.error || 'Não foi possível excluir o link.');
      setLinks((prev) => prev.filter((link) => link.id !== id));
      showToast('Link removido da aba Links. O histórico de cliques foi preservado.', 'success', {
        label: 'Desfazer',
        onClick: () => handleRestoreLink(id),
      });
    } catch (error: any) {
      showToast(error.message || 'Erro ao excluir link.', 'error');
    }
  };

  const handleRestoreLink = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/links/${id}/restore`, {
        method: 'POST',
        headers: { 'x-admin-email': adminEmail },
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.error || 'Não foi possível desfazer a exclusão.');
      setLinks((prev) => [...prev, result.link].sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      ));
      showToast('Link restaurado na planilha e sincronizado com o Cloudflare.');
    } catch (error: any) {
      showToast(error.message || 'Não foi possível desfazer a exclusão.', 'error');
    }
  };

  const handleSyncCloudflare = async () => {
    setIsCloudflareSyncing(true);
    try {
      const res = await fetch('/api/admin/cloudflare/sync', {
        method: 'POST',
        headers: { 'x-admin-email': adminEmail },
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.error || 'Não foi possível sincronizar os links.');
      showToast(`${Number(result.synchronized || 0)} link(s) sincronizado(s) com o Cloudflare.`);
    } catch (error: any) {
      showToast(error.message || 'Falha ao sincronizar com o Cloudflare.', 'error');
    } finally {
      setIsCloudflareSyncing(false);
    }
  };

  // Retry sync queue
  const handleRetryQueue = async () => {
    const res = await fetch('/api/admin/queue/retry', {
      method: 'POST',
      headers: { 'x-admin-email': adminEmail },
    });
    if (res.ok) {
      await loadData();
      showToast('Fila de falhas reprocessada.');
    } else {
      throw new Error('Falha ao reprocessar fila.');
    }
  };

  // Computed totals for Stats Overview
  const totalLinks = links.length;
  const totalClicks = links.reduce((sum, l) => sum + (l.totalClicksCount || 0), 0);
  const realClicks = links.reduce((sum, l) => sum + (l.realClicksCount || 0), 0);
  const uniqueVisitors = links.reduce((sum, l) => sum + (l.uniqueVisitorsCount || 0), 0);
  const suspectBots = links.reduce((sum, l) => sum + (l.suspectBotsCount || 0), 0);

  // Distinct filter values
  const availableCampaigns = Array.from(new Set(links.map((l) => l.campaign).filter(Boolean)));
  const availableSources = Array.from(new Set(links.map((l) => l.source).filter(Boolean)));
  const availableSheets = Array.from(new Set(links.map((l) => l.spreadsheetTitle || l.spreadsheetId).filter(Boolean)));

  // Filtered links
  const filteredLinks = links.filter((link) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = link.name.toLowerCase().includes(term);
      const matchCamp = link.campaign.toLowerCase().includes(term);
      const matchSrc = link.source.toLowerCase().includes(term);
      const matchPath = link.shortPath.toLowerCase().includes(term);
      if (!matchName && !matchCamp && !matchSrc && !matchPath) return false;
    }
    if (campaignFilter !== 'all' && link.campaign !== campaignFilter) return false;
    if (sourceFilter !== 'all' && link.source !== sourceFilter) return false;
    if (sheetFilter !== 'all' && (link.spreadsheetTitle !== sheetFilter && link.spreadsheetId !== sheetFilter))
      return false;
    if (statusFilter !== 'all' && link.status !== statusFilter) return false;

    return true;
  });

  // Group filtered links by campaign for grouped visualization (Requisito 4)
  const campaignGroups = filteredLinks.reduce<Record<string, LinkRecord[]>>((acc, link) => {
    const camp = link.campaign || 'Sem Campanha';
    if (!acc[camp]) acc[camp] = [];
    acc[camp].push(link);
    return acc;
  }, Object.create(null));
  const campaignNames = Object.keys(campaignGroups).sort();

  return (

    <div data-theme={theme} className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200 ${
            toast.type === 'success'
              ? 'bg-slate-900 border-emerald-500/50 text-emerald-400'
              : 'bg-slate-900 border-rose-500/50 text-rose-400'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                const action = toast.action;
                if (toastTimeout.current !== null) window.clearTimeout(toastTimeout.current);
                toastTimeout.current = null;
                setToast(null);
                void action?.onClick();
              }}
              className="ml-2 rounded-lg border border-current/30 px-2.5 py-1 text-xs font-bold hover:bg-white/10"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}

      {/* Navbar */}
      <Navbar
        adminEmail={adminEmail}
        onOpenTests={() => setIsTestsModalOpen(true)}
        theme={theme}
        onThemeChange={setTheme}
        onSyncCloudflare={handleSyncCloudflare}
        isCloudflareSyncing={isCloudflareSyncing}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex gap-2 border-b border-slate-800" role="tablist" aria-label="Seções do dashboard">
          <button type="button" role="tab" aria-selected={activeTab === 'links'} onClick={() => setActiveTab('links')} className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${activeTab === 'links' ? 'border-emerald-400 text-emerald-300' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <Link2 className="w-4 h-4" /> Links e campanhas
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${activeTab === 'analytics' ? 'border-emerald-400 text-emerald-300' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <BarChart3 className="w-4 h-4" /> Gráficos
          </button>
        </div>
        {activeTab === 'analytics' ? <AnalyticsPanel links={links} campaigns={availableCampaigns} /> : <>
        {/* Planilhas acessadas pelo Apps Script */}
        <ConnectSheetsCard
          adminEmail={adminEmail}
          setupAt={setupAt}
        />

        {/* Step 2: KPI Metrics Overview */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Métricas Consolidadas
            </h3>
            <button
              onClick={() => void loadData()}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
              title="Atualizar métricas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>

          <StatsOverview
            metricsReady={metricsReady}
            queueReady={queueReady}
            totalLinks={totalLinks}
            realClicks={realClicks}
            totalClicks={totalClicks}
            uniqueVisitors={uniqueVisitors}
            suspectBots={suspectBots}
            syncFailuresCount={syncQueue.length}
            onOpenSyncQueue={() => setIsQueueModalOpen(true)}
          />
        </section>

        {/* Step 3: Links Management & Filtering */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 tracking-tight">Links Rastreáveis Criados</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Crie, organize e acompanhe links de diferentes campanhas e planilhas.
              </p>
            </div>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              disabled={isCatalogLoading || !!catalogError}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Novo Link</span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, campanha ou link..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Campaign Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">Campanha:</span>
              <select
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">Todas as Campanhas</option>
                {availableCampaigns.map((camp) => (
                  <option key={camp} value={camp}>
                    {camp}
                  </option>
                ))}
              </select>
            </div>

            {/* Source Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">Origem:</span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">Todas as Origens</option>
                {availableSources.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>

            {/* Sheet Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">Planilha:</span>
              <select
                value={sheetFilter}
                onChange={(e) => setSheetFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 max-w-[160px] truncate"
              >
                <option value="all">Todas as Planilhas</option>
                {availableSheets.map((sh) => (
                  <option key={sh} value={sh}>
                    {sh}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">Todos</option>
                <option value="active">Apenas Ativos</option>
                <option value="inactive">Apenas Inativos</option>
              </select>
            </div>

            {/* View Mode Switcher: Agrupado por Campanha vs Grade Individual (Requisito 4) */}
            <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-lg border border-slate-700 sm:ml-auto">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  viewMode === 'grouped'
                    ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Agrupar múltiplos links por campanha"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Agrupado por Campanha</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  viewMode === 'grid'
                    ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Visualizar links em grade individual"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grade</span>
              </button>
            </div>
          </div>

          {/* Links Rendering */}
          {isCatalogLoading ? <p role="status" className="text-sm text-slate-400 py-8">Carregando campanhas e links...</p> : catalogError ? (
            <div role="alert" className="rounded-xl border border-rose-500/40 p-4 text-sm text-rose-300">
              <p>{catalogError}</p>
              <button onClick={() => void loadData()} className="mt-2 underline">Tentar novamente</button>
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
                <Link2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-200">Nenhum link encontrado</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  {searchTerm || campaignFilter !== 'all' || sourceFilter !== 'all' || statusFilter !== 'all'
                    ? 'Nenhum link corresponde aos filtros atuais. Tente ajustar os termos de busca.'
                    : 'Comece criando o primeiro link rastreável vinculado a uma Planilha Google.'}
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                disabled={isCatalogLoading || !!catalogError}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Link Rastreável</span>
              </button>
            </div>
          ) : viewMode === 'grouped' ? (
            /* Visualização Agrupada por Campanha */
            <div className="space-y-6">
              {campaignNames.map((campName) => {
                const groupLinks = campaignGroups[campName] || [];
                const groupTotalClicks = groupLinks.reduce((sum, l) => sum + (l.totalClicksCount || 0), 0);
                const groupRealClicks = groupLinks.reduce((sum, l) => sum + (l.realClicksCount || 0), 0);
                const groupUniqueVisitors = groupLinks.reduce((sum, l) => sum + (l.uniqueVisitorsCount || 0), 0);

                return (
                  <div key={campName} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
                    {/* Header da Campanha */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                          <Tag className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-100">{campName}</h3>
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-medium">
                              {groupLinks.length} link{groupLinks.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Links e canais associados a esta campanha
                          </p>
                        </div>
                      </div>

                      {/* Métricas da Campanha */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 text-[11px]">
                          Humanos (est.): <strong className="text-emerald-400 font-semibold">{metricsReady ? groupRealClicks : '—'}</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 text-[11px]">
                          Total: <strong className="text-slate-100 font-semibold">{metricsReady ? groupTotalClicks : '—'}</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 text-[11px]">
                          Navegadores por link: <strong className="text-teal-400 font-semibold">{metricsReady ? groupUniqueVisitors : '—'}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Cards de Links dentro da Campanha */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupLinks.map((link) => (
                        <LinkCard
                          metricsReady={metricsReady}
                          key={link.id}
                          link={link}
                          onToggleStatus={handleToggleStatus}
                          onDelete={handleDeleteLink}
                          onEdit={setEditingLink}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Visualização em Grade Plana */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLinks.map((link) => (
                <LinkCard
                  metricsReady={metricsReady}
                  key={link.id}
                  link={link}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDeleteLink}
                  onEdit={setEditingLink}
                />
              ))}
            </div>
          )}
        </section>

        </>}

      </main>

      {/* Modals */}
      <CreateLinkModal
        links={links}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onLinkCreated={(newLink) => {
          setLinks((prev) => [newLink, ...prev]);
          showToast(`Link "${newLink.name}" criado com sucesso!`);
        }}
        adminEmail={adminEmail}
      />

      <EditLinkModal
        link={editingLink}
        onClose={() => setEditingLink(null)}
        onSaved={(updated) => {
          setLinks(current => current.map(link => link.id === updated.id ? updated : link));
          setEditingLink(null);
          showToast(`Link \"${updated.name}\" atualizado.`);
        }}
      />

      <SyncQueueModal
        isOpen={isQueueModalOpen}
        onClose={() => setIsQueueModalOpen(false)}
        queue={syncQueue}
        onRetry={handleRetryQueue}
      />

      <DiagnosticTestsModal
        isOpen={isTestsModalOpen}
        onClose={() => setIsTestsModalOpen(false)}
        adminEmail={adminEmail}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-400">
        <p>Hub de Links Rastreáveis • Painel privado no Apps Script • Links públicos no GitHub Pages</p>
      </footer>
    </div>
  );
}

