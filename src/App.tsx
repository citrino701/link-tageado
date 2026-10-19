import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

import { fetchAdminStatus } from './api.ts';
import { Navbar } from './components/Navbar.tsx';
import { ConnectSheetsCard } from './components/ConnectSheetsCard.tsx';
import { StatsOverview } from './components/StatsOverview.tsx';
import { CreateLinkModal } from './components/CreateLinkModal.tsx';
import { LinkCard } from './components/LinkCard.tsx';
import { SyncQueueModal } from './components/SyncQueueModal.tsx';
import { DiagnosticTestsModal } from './components/DiagnosticTestsModal.tsx';
import { LinkRecord, SyncQueueItem } from './services/store.ts';

export default function App() {
  const [adminEmail, setAdminEmail] = useState('hugoviajante@gmail.com');
  const [setupAt, setSetupAt] = useState<string | null>(null);

  // Links & Stats
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sheetFilter, setSheetFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'grid'>('grouped');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [isTestsModalOpen, setIsTestsModalOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch initial app state
  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Status via backend API
      const statusData = await fetchAdminStatus();
      setAdminEmail(statusData.adminEmail || 'hugoviajante@gmail.com');
      setSetupAt(statusData.setupAt || statusData.connectedAt || null);

      // 2. Links
      const linksRes = await fetch('/api/admin/links');
      if (linksRes.ok) {
        const linksData = await linksRes.json();
        setLinks(linksData.links || []);
      }

      // 3. Queue
      const queueRes = await fetch('/api/admin/queue');
      if (queueRes.ok) {
        const queueData = await queueRes.json();
        setSyncQueue(queueData.queue || []);
      }
    } catch (err: any) {
      console.warn('Error fetching admin data:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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

  // Delete link
  const handleDeleteLink = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/links/${id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-email': adminEmail,
        },
      });
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== id));
        showToast('Link removido com sucesso. Os dados na planilha foram mantidos.');
      }
    } catch {
      showToast('Erro ao excluir link.', 'error');
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
  }, {});
  const campaignNames = Object.keys(campaignGroups).sort();

  return (

    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
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
        </div>
      )}

      {/* Navbar */}
      <Navbar
        adminEmail={adminEmail}
        onOpenTests={() => setIsTestsModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
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
              onClick={loadData}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
              title="Atualizar métricas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>

          <StatsOverview
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
          {filteredLinks.length === 0 ? (
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
                          Cliques Reais: <strong className="text-emerald-400 font-semibold">{groupRealClicks}</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 text-[11px]">
                          Total: <strong className="text-slate-100 font-semibold">{groupTotalClicks}</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 text-[11px]">
                          Visitantes Únicos: <strong className="text-teal-400 font-semibold">{groupUniqueVisitors}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Cards de Links dentro da Campanha */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupLinks.map((link) => (
                        <LinkCard
                          key={link.id}
                          link={link}
                          onToggleStatus={handleToggleStatus}
                          onDelete={handleDeleteLink}
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
                  key={link.id}
                  link={link}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDeleteLink}
                />
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Modals */}
      <CreateLinkModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onLinkCreated={(newLink) => {
          setLinks((prev) => [newLink, ...prev]);
          showToast(`Link "${newLink.name}" criado com sucesso!`);
        }}
        adminEmail={adminEmail}
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
