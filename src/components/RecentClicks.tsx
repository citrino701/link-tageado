import React from 'react';
import { Bot, Clock3, History } from 'lucide-react';
import type { RecentClick } from '../services/store.ts';

type Props = {
  clicks?: RecentClick[] | null;
  ready: boolean;
  linkName: string;
  onViewHistory: () => void;
};

export function RecentClicks({ clicks, ready, linkName, onViewHistory }: Props) {
  return (
    <section aria-label={`Últimos cliques de ${linkName}`} className="mt-3 border-t border-slate-800/80 pt-3">
      <h5 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
        <Clock3 className="h-3.5 w-3.5" /> Últimos 3 cliques
      </h5>
      {!ready ? (
        <p role="status" className="text-xs text-slate-400">Carregando últimos cliques…</p>
      ) : clicks === undefined ? (
        <p className="text-xs text-slate-400">Atualize o Apps Script administrativo para exibir os últimos cliques.</p>
      ) : clicks === null ? (
        <p role="status" className="text-xs text-slate-400">Não foi possível ler os últimos cliques. Use Atualizar para tentar novamente.</p>
      ) : clicks.length ? (
        <ol className="space-y-1.5">
          {clicks.slice(0, 3).map((click, index) => (
            <li key={`${click.timestampMs}-${index}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
              <time dateTime={new Date(click.timestampMs).toISOString()} className="tabular-nums text-slate-300">{click.timestamp}</time>
              <span className={`inline-flex items-center gap-1 ${click.isBot ? 'text-amber-400' : 'text-emerald-400'}`}>
                {click.isBot && <Bot className="h-3 w-3" />}
                {click.isBot ? 'Bot suspeito' : 'Humano (est.)'}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-slate-400">Nenhum clique com horário disponível.</p>
      )}
      <button type="button" onClick={onViewHistory} aria-label={`Ver histórico de cliques de ${linkName}`} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700">
        <History className="h-3.5 w-3.5" /> Ver histórico de cliques
      </button>
    </section>
  );
}
