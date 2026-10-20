import React, { useEffect, useState } from 'react';
import { ChevronRight, Link2 } from 'lucide-react';
import { LinkRecord } from '../services/store.ts';
import { LinkCard } from './LinkCard.tsx';

interface LinkListViewProps {
  links: LinkRecord[];
  campaigns: string[];
  metricsReady: boolean;
  onToggleStatus: (id: string, newStatus: 'active' | 'inactive') => void;
  onDelete: (id: string) => void;
  onEdit: (link: LinkRecord) => void;
}

export function LinkListView({
  links,
  campaigns,
  metricsReady,
  onToggleStatus,
  onDelete,
  onEdit,
}: LinkListViewProps) {
  const [campaignSelection, setCampaignSelection] = useState('');
  const [selectedLinkId, setSelectedLinkId] = useState('');

  const activeCampaign = campaignSelection || campaigns[0] || '__all__';
  const visibleLinks = links.filter((link) =>
    activeCampaign === '__all__' ||
    (link.campaign || 'Sem Campanha') === activeCampaign
  );
  const selectedLink = visibleLinks.find((link) => link.id === selectedLinkId) || null;

  useEffect(() => {
    if (activeCampaign !== '__all__' && !campaigns.includes(activeCampaign)) {
      setCampaignSelection(campaigns[0] || '__all__');
    }
  }, [activeCampaign, campaigns]);

  useEffect(() => {
    if (selectedLinkId && !visibleLinks.some((link) => link.id === selectedLinkId)) {
      setSelectedLinkId('');
    }
  }, [selectedLinkId, visibleLinks]);

  const countFor = (campaign: string) => links.filter((link) =>
    (link.campaign || 'Sem Campanha') === campaign
  ).length;

  return (
    <section className="space-y-4" aria-label="Links em lista">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Escolha uma campanha</h3>
            <p className="mt-0.5 text-xs text-slate-400">A lista abre em uma campanha. Use “Ver todos” quando quiser reunir os links.</p>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-[11px] text-slate-300">
            {visibleLinks.length} link{visibleLinks.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {campaigns.map((campaign) => (
            <button
              key={campaign}
              type="button"
              aria-pressed={activeCampaign === campaign}
              onClick={() => {
                setCampaignSelection(campaign);
                setSelectedLinkId('');
              }}
              className={'inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ' +
                (activeCampaign === campaign
                  ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200'
                  : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-100')}
            >
              <span>{campaign}</span>
              <span className="rounded-full bg-black/15 px-1.5 py-0.5 text-[10px]">{countFor(campaign)}</span>
            </button>
          ))}
          <button
            type="button"
            aria-pressed={activeCampaign === '__all__'}
            onClick={() => {
              setCampaignSelection('__all__');
              setSelectedLinkId('');
            }}
            className={'shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition ' +
              (activeCampaign === '__all__'
                ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200'
                : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-100')}
          >
            Ver todos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="min-w-0 space-y-2">
          {visibleLinks.length ? visibleLinks.map((link) => (
            <button
              key={link.id}
              type="button"
              aria-pressed={selectedLinkId === link.id}
              onClick={() => setSelectedLinkId(link.id)}
              className={'flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition sm:px-4 ' +
                (selectedLinkId === link.id
                  ? 'border-emerald-400/45 bg-emerald-400/10 shadow-lg shadow-emerald-950/20'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/85')}
            >
              <span className="link-list-icon-glass flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-300">
                <Link2 className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-100">{link.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                  <span className="truncate">{link.source || 'Direto'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{link.campaign || 'Sem Campanha'}</span>
                </span>
              </span>
              <span className={'hidden shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide sm:inline-flex ' +
                (link.status === 'active'
                  ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-800/70 text-slate-400')}
              >
                {link.status === 'active' ? 'Ativo' : 'Pausado'}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
            </button>
          )) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
              Não encontrei links nessa campanha com os filtros atuais.
            </div>
          )}
        </div>

        <aside className="min-w-0 xl:sticky xl:top-24" aria-label="Detalhes do link selecionado">
          {selectedLink ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Detalhes do link</h3>
                <p className="mt-0.5 text-xs text-slate-400">As métricas aparecem somente após selecionar um link.</p>
              </div>
              <LinkCard
                metricsReady={metricsReady}
                link={selectedLink}
                onToggleStatus={onToggleStatus}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/45 p-8 text-center">
              <span className="link-list-icon-glass mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-300">
                <Link2 className="h-6 w-6" />
              </span>
              <h3 className="text-sm font-semibold text-slate-200">Selecione um link</h3>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-400">As métricas detalhadas e ações aparecem aqui quando você escolher um item da lista.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
