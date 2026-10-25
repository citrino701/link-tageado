import React, { useEffect, useState } from 'react';
import {
  Bot,
  ChevronRight,
  Globe,
  Link2,
  MessageCircle,
  MousePointerClick,
  Phone,
  Users,
} from 'lucide-react';
import { LinkRecord } from '../services/store.ts';
import { LinkCard } from './LinkCard.tsx';
import { RecentClicks } from './RecentClicks.tsx';

interface LinkListViewProps {
  links: LinkRecord[];
  allLinks: LinkRecord[];
  campaigns: string[];
  metricsReady: boolean;
  onToggleStatus: (id: string, newStatus: 'active' | 'inactive') => void;
  onDelete: (id: string) => void;
  onEdit: (link: LinkRecord) => void;
  onViewHistory: (link: LinkRecord) => void;
}

type DestinationIconKind = 'whatsapp' | 'website' | 'link';

function destinationIconKind(link: LinkRecord): DestinationIconKind {
  const destination = String(link.destinationUrl || '').trim();
  const declaredType = String(link.destinationType || '').toLowerCase();

  if (
    declaredType === 'whatsapp' ||
    /(?:^|\/\/)(?:wa\.me|(?:api\.|web\.)?whatsapp\.com)(?:\/|$)/i.test(destination)
  ) {
    return 'whatsapp';
  }

  try {
    const url = new URL(destination);
    if (url.protocol === 'http:' || url.protocol === 'https:') return 'website';
  } catch {
    // Destino ausente ou fora do formato de site: usa o ícone genérico de link.
  }

  return 'link';
}

function DestinationIcon({ kind }: { kind: DestinationIconKind }) {
  if (kind === 'whatsapp') {
    return (
      <span className="relative inline-flex h-6 w-6 items-center justify-center" aria-label="WhatsApp">
        <MessageCircle className="h-6 w-6" />
        <Phone className="absolute h-3 w-3 fill-current" />
      </span>
    );
  }

  if (kind === 'website') return <Globe className="h-5 w-5" aria-label="Site" />;
  return <Link2 className="h-5 w-5" aria-label="Link" />;
}

export function LinkListView({
  links,
  allLinks,
  campaigns,
  metricsReady,
  onToggleStatus,
  onDelete,
  onEdit,
  onViewHistory,
}: LinkListViewProps) {
  const [campaignSelection, setCampaignSelection] = useState('');
  const [selectedLinkId, setSelectedLinkId] = useState('');

  const activeCampaign = campaignSelection || campaigns[0] || '__all__';
  const visibleLinks = links.filter((link) =>
    activeCampaign === '__all__' ||
    (link.campaign || 'Sem Campanha') === activeCampaign
  );
  const campaignMetricLinks = activeCampaign === '__all__'
    ? allLinks
    : allLinks.filter((link) => (link.campaign || 'Sem Campanha') === activeCampaign);
  const selectedLink = visibleLinks.find((link) => link.id === selectedLinkId) || null;

  const campaignMetrics = campaignMetricLinks.reduce(
    (totals, link) => ({
      clicks: totals.clicks + (link.totalClicksCount || 0),
      humans: totals.humans + (link.realClicksCount || 0),
      browsers: totals.browsers + (link.uniqueVisitorsCount || 0),
      bots: totals.bots + (link.suspectBotsCount || 0),
    }),
    { clicks: 0, humans: 0, browsers: 0, bots: 0 }
  );

  const number = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

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

  const campaignMetricItems = [
    { label: 'Cliques totais', value: campaignMetrics.clicks, icon: MousePointerClick },
    { label: 'Humanos est.', value: campaignMetrics.humans, icon: Users },
    { label: 'Navegadores*', value: campaignMetrics.browsers, icon: Users },
    { label: 'Bots suspeitos', value: campaignMetrics.bots, icon: Bot },
  ];

  return (
    <section className="space-y-4" aria-label="Links em lista">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 xl:max-w-sm">
            <h3 className="text-sm font-semibold text-slate-100">Escolha uma campanha</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
              A lista abre em uma campanha. Use “Ver todos” quando quiser reunir os links.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[560px] xl:flex-1">
            {campaignMetricItems.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                title={label === 'Navegadores*'
                  ? 'Soma dos navegadores únicos por link; a mesma pessoa pode aparecer em mais de um link da campanha.'
                  : label}
                className="min-w-0 rounded-xl border border-slate-700/70 bg-slate-950/35 px-3 py-2"
              >
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span className="truncate">{label}</span>
                </span>
                <span className="mt-1 block text-lg font-semibold leading-none text-slate-100">
                  {metricsReady ? number(value) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">
            {activeCampaign === '__all__' ? 'Todas as campanhas' : activeCampaign}
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-[11px] text-slate-300">
            {visibleLinks.length} link{visibleLinks.length === 1 ? '' : 's'} exibido{visibleLinks.length === 1 ? '' : 's'}
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
                  ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                  : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-100')}
            >
              <span>{campaign}</span>
              <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">{countFor(campaign)}</span>
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
                ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-100')}
          >
            Ver todos
          </button>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          * Navegadores únicos somados por link; uma mesma pessoa pode aparecer em mais de um link.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="min-w-0 space-y-2">
          {visibleLinks.length ? visibleLinks.map((link) => {
            const kind = destinationIconKind(link);
            const iconColor = kind === 'whatsapp'
              ? 'text-[#25D366]'
              : kind === 'website'
                ? 'text-amber-200'
                : 'text-slate-100';

            return (
              <div key={link.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                <button
                  type="button"
                  aria-pressed={selectedLinkId === link.id}
                  onClick={() => setSelectedLinkId(link.id)}
                  className={'flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition sm:px-4 ' +
                    (selectedLinkId === link.id
                      ? 'border-amber-400/50 bg-amber-400/10 shadow-lg shadow-black/20'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/85')}
                >
                  <span className={'link-list-icon-glass flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ' + iconColor}>
                    <DestinationIcon kind={kind} />
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
                      ? 'border-amber-400/25 bg-amber-400/10 text-amber-200'
                      : 'border-slate-700 bg-slate-800/70 text-slate-400')}
                  >
                    {link.status === 'active' ? 'Ativo' : 'Pausado'}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                </button>
                <RecentClicks clicks={link.recentClicks} ready={metricsReady} linkName={link.name} onViewHistory={() => onViewHistory(link)} />
              </div>
            );
          }) : (
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
                onViewHistory={onViewHistory}
              />
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/45 p-8 text-center">
              <span className="link-list-icon-glass mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 text-slate-100">
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
