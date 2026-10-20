import React from 'react';
import { Link2 } from 'lucide-react';

interface NavbarProps {
  adminEmail: string;
}

export const Navbar: React.FC<NavbarProps> = ({ adminEmail }) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="nav-icon-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-400/15 text-emerald-300 shadow-lg shadow-emerald-900/20">
            <Link2 className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-bold tracking-tight text-slate-100 sm:text-lg">Hub de Links Rastreáveis</span>
              <span className="hidden shrink-0 rounded-full border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 sm:inline-flex">Admin</span>
            </div>
            <p className="hidden text-xs text-slate-400 sm:block">Painel privado · links públicos rastreáveis</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-800/60 px-2.5 py-1.5">
          <span className="hidden max-w-56 truncate text-[11px] text-slate-300 sm:block">{adminEmail}</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/15 text-xs font-bold text-emerald-200" title={adminEmail}>
            {adminEmail[0]?.toUpperCase() || 'A'}
          </span>
        </div>
      </div>
    </header>
  );
};
