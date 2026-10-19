import React from 'react';
import { FileSpreadsheet, ShieldCheck, CheckCircle2, ExternalLink } from 'lucide-react';

interface ConnectSheetsCardProps {
  adminEmail: string;
  setupAt: string | null;
}

export const ConnectSheetsCard: React.FC<ConnectSheetsCardProps> = ({
  adminEmail,
  setupAt,
}) => {
  return (
    <section className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-3 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Painel privado do Apps Script</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            Planilhas acessadas pela sua conta Google
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            O Apps Script usa as permissões da sua conta para abrir as planilhas informadas e registrar os cliques.
            Visitantes só seguem os links; não precisam entrar no Google nem abrir este painel.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Gravação na aba Cliques de cada planilha
            </span>
            <a
              href="https://script.google.com/home"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
            >
              <span>Ver execuções do Apps Script</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <div className="shrink-0 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300">Acesso privado autorizado</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{adminEmail}</p>
          {setupAt && (
            <p className="mt-1 text-[10px] text-slate-500">
              Painel configurado em {new Date(setupAt).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
