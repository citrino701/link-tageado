import React from 'react';
import { Link2, ShieldCheck, FileSpreadsheet } from 'lucide-react';

interface NavbarProps {
  adminEmail: string;
  onOpenTests: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ adminEmail, onOpenTests }) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
            <Link2 className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-bold text-slate-100 text-lg tracking-tight">Hub de Links Rastreáveis</span>
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-medium">
                Admin
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Painel privado no Apps Script • Links públicos no GitHub Pages
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenTests}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Executar as validações do painel"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Validação</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-slate-400 leading-none">Planilhas</span>
              <span className="text-emerald-400 font-semibold text-xs leading-tight">Via Apps Script</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-medium text-slate-200">Administrador</span>
              <span className="text-[10px] text-slate-400">{adminEmail}</span>
            </div>
            <div
              className="w-8 h-8 rounded-full bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-xs font-semibold text-emerald-300"
              title={adminEmail}
            >
              {adminEmail[0]?.toUpperCase() || 'A'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
