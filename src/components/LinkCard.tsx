import React, { useState } from 'react';
import {
  Link2,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Power,
  Trash2,
  Pencil,
  CheckCircle2,
  ChevronDown,
  MessageCircle,
  Globe,
  Bot,
  Users,
  MousePointerClick,
} from 'lucide-react';
import { LinkRecord } from '../services/store.ts';
import { buildPublicLink, displayPublicLink } from '../utils/public-link.ts';

interface LinkCardProps {
  metricsReady?: boolean;
  link: LinkRecord;
  onToggleStatus: (id: string, newStatus: 'active' | 'inactive') => void;
  onDelete: (id: string) => void;
  onEdit: (link: LinkRecord) => void;
}

export const LinkCard: React.FC<LinkCardProps> = ({ link, onToggleStatus, onDelete, onEdit, metricsReady = true }) => {
  const [copied, setCopied] = useState(false);
  const [showLinkFormatMenu, setShowLinkFormatMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fullShortUrl = buildPublicLink(link, 'short');
  const fullLongUrl = buildPublicLink(link, 'long');

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setShowLinkFormatMenu(false);
    setTimeout(() => setCopied(false), 2000);
  };

  const isActive = link.status === 'active';

  return (
    <div
      className={`bg-slate-900 border rounded-2xl p-5 sm:p-6 transition shadow-md hover:shadow-lg flex flex-col justify-between ${
        isActive
          ? 'border-slate-800 hover:border-slate-700'
          : 'border-slate-800/60 opacity-75 bg-slate-950/40'
      }`}
    >
      <div>
        {/* Top Badges & Status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Destination Type badge */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                link.destinationType === 'whatsapp'
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                  : 'bg-blue-950/60 text-blue-400 border border-blue-500/30'
              }`}
            >
              {link.destinationType === 'whatsapp' ? (
                <>
                  <MessageCircle className="w-3 h-3" />
                  <span>WhatsApp</span>
                </>
              ) : (
                <>
                  <Globe className="w-3 h-3" />
                  <span>URL</span>
                </>
              )}
            </span>

            {/* Campaign badge */}
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
              {link.campaign}
            </span>

            {/* Source badge */}
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-950/50 text-indigo-300 border border-indigo-500/20">
              {link.source}
            </span>
          </div>

          {/* Active / Inactive switch */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isActive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
            }`}
          >
            {isActive ? 'Ativo' : 'Desativado'}
          </span>
        </div>

        {/* Link Name & Content Details */}
        <h4 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight leading-snug">
          {link.name}
        </h4>

        {link.content && (
          <p className="text-xs text-slate-400 mt-0.5">
            Conteúdo: <span className="text-slate-300">{link.content}</span>
            {link.medium && <span> • Meio: {link.medium}</span>}
          </p>
        )}

        {/* Short link with a full-length GitHub Pages alternative */}
        <div className="mt-4 bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <Link2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span title={fullShortUrl} className="font-mono text-xs font-semibold text-emerald-400 truncate">
              {displayPublicLink(link, 'short')}
            </span>
          </div>
          <div className="relative flex shrink-0">
            <button
              type="button"
              onClick={() => handleCopy(fullShortUrl)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-l-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
              title="Copiar link curto do Cloudflare"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowLinkFormatMenu((open) => !open)}
              className="rounded-r-lg border-l border-slate-700 bg-slate-800 px-1.5 text-slate-300 hover:bg-slate-700"
              aria-label="Escolher outro formato de link"
              aria-haspopup="menu"
              aria-expanded={showLinkFormatMenu}
              title="Outros formatos de link"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {showLinkFormatMenu && (
              <div role="menu" className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleCopy(fullLongUrl)}
                  className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-800"
                  title={fullLongUrl}
                >
                  <span className="block text-xs font-semibold text-slate-100">Copiar link completo</span>
                  <span className="block text-[10px] text-slate-400">GitHub Pages · sem o domínio pages.dev</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Linked Spreadsheet */}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400 bg-slate-850/50 px-3 py-1.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-1.5 truncate">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{link.spreadsheetTitle || 'Planilha Google'}</span>
          </div>
          <a
            href={link.spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:text-emerald-300 hover:underline shrink-0 text-[11px] font-medium ml-2"
          >
            Abrir planilha ↗
          </a>
        </div>

        {/* Performance Statistics */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center">
          <div className="bg-slate-950/40 p-2 rounded-lg">
            <span title="Estimativa: cliques não marcados como bot pelos sinais disponíveis." className="text-[10px] text-slate-400 block">Humanos est.</span>
            <span className="text-sm font-bold text-emerald-400">{metricsReady ? link.realClicksCount || 0 : '—'}</span>
          </div>
          <div className="bg-slate-950/40 p-2 rounded-lg">
            <span className="text-[10px] text-slate-400 block">Totais</span>
            <span className="text-sm font-bold text-slate-200">{metricsReady ? link.totalClicksCount || 0 : '—'}</span>
          </div>
          <div className="bg-slate-950/40 p-2 rounded-lg">
            <span title="Navegadores identificados por cookie; não identifica pessoas." className="text-[10px] text-slate-400 block">Navegadores</span>
            <span className="text-sm font-bold text-cyan-400">{metricsReady ? link.uniqueVisitorsCount || 0 : '—'}</span>
          </div>
          <div className="bg-slate-950/40 p-2 rounded-lg">
            <span className="text-[10px] text-slate-400 block">Bots suspeitos</span>
            <span className="text-sm font-bold text-amber-400">{metricsReady ? link.suspectBotsCount || 0 : '—'}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {/* Test Link button */}
          <a
            href={fullShortUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            title="Testar redirecionamento em nova aba"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Testar</span>
          </a>

          {/* Open Sheet button */}
          <a
            href={link.spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            title="Abrir Planilha Google no Drive"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Planilha</span>
          </a>
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => onEdit(link)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition" title="Editar link">
            <Pencil className="w-3.5 h-3.5" /><span>Editar</span>
          </button>
          {/* Deactivate / Activate button */}
          <button
            onClick={() => onToggleStatus(link.id, isActive ? 'inactive' : 'active')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              isActive
                ? 'bg-amber-950/20 text-amber-400 border-amber-500/30 hover:bg-amber-950/40'
                : 'bg-emerald-950/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-950/40'
            }`}
            title={isActive ? 'Desativar link' : 'Ativar link'}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isActive ? 'Desativar' : 'Ativar'}</span>
          </button>

          {/* Delete button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
            title="Excluir link do Hub"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h5 className="text-base font-bold text-slate-100 mb-2">Excluir link "{link.name}"?</h5>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              O registro sairá da aba <strong className="text-slate-200">Links</strong> e o atalho será removido do Cloudflare.
              <br />
              <strong className="text-slate-200">
                Os cliques na planilha da campanha serão mantidos. Você pode desfazer logo após excluir.
              </strong>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDelete(link.id);
                  setShowDeleteConfirm(false);
                }}
                className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition"
              >
                Sim, excluir link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

