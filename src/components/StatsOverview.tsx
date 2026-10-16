import React from 'react';
import { Link2, MousePointerClick, CheckCircle, Users, Bot, AlertTriangle, RefreshCw } from 'lucide-react';

interface StatsOverviewProps {
  totalLinks: number;
  realClicks: number;
  totalClicks: number;
  uniqueVisitors: number;
  suspectBots: number;
  syncFailuresCount: number;
  onOpenSyncQueue: () => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  totalLinks,
  realClicks,
  totalClicks,
  uniqueVisitors,
  suspectBots,
  syncFailuresCount,
  onOpenSyncQueue,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {/* Total Links */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium">Total de Links</span>
          <Link2 className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <span className="text-2xl font-bold text-slate-100">{totalLinks}</span>
          <p className="text-[11px] text-slate-400 mt-0.5">links rastreáveis</p>
        </div>
      </div>

      {/* Cliques Reais */}
      <div className="bg-slate-900 border border-emerald-500/30 bg-emerald-950/10 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-emerald-400 mb-2">
          <span className="text-xs font-semibold">Cliques Reais</span>
          <CheckCircle className="w-4 h-4" />
        </div>
        <div>
          <span className="text-2xl font-bold text-emerald-400">{realClicks}</span>
          <p className="text-[11px] text-emerald-400/70 mt-0.5">exclui bots e robôs</p>
        </div>
      </div>

      {/* Cliques Totais */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium">Cliques Totais</span>
          <MousePointerClick className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <span className="text-2xl font-bold text-slate-100">{totalClicks}</span>
          <p className="text-[11px] text-slate-400 mt-0.5">todos os acessos</p>
        </div>
      </div>

      {/* Navegadores Únicos */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium">Navegadores Únicos</span>
          <Users className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <span className="text-2xl font-bold text-slate-100">{uniqueVisitors}</span>
          <p className="text-[11px] text-slate-400 mt-0.5">visitantes únicos est.</p>
        </div>
      </div>

      {/* Bots Suspeitos */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium">Bots Suspeitos</span>
          <Bot className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <span className="text-2xl font-bold text-slate-100">{suspectBots}</span>
          <p className="text-[11px] text-slate-400 mt-0.5">crawlers e robôs</p>
        </div>
      </div>

      {/* Falhas de Sincronização */}
      <div
        onClick={syncFailuresCount > 0 ? onOpenSyncQueue : undefined}
        className={`rounded-xl p-4 flex flex-col justify-between border transition ${
          syncFailuresCount > 0
            ? 'bg-rose-950/20 border-rose-500/40 cursor-pointer hover:bg-rose-950/30'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className={`text-xs font-medium ${syncFailuresCount > 0 ? 'text-rose-400 font-semibold' : ''}`}>
            Fila de Falhas
          </span>
          {syncFailuresCount > 0 ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
          ) : (
            <RefreshCw className="w-4 h-4 text-slate-500" />
          )}
        </div>
        <div>
          <span className={`text-2xl font-bold ${syncFailuresCount > 0 ? 'text-rose-400' : 'text-slate-100'}`}>
            {syncFailuresCount}
          </span>
          <p className={`text-[11px] mt-0.5 ${syncFailuresCount > 0 ? 'text-rose-400 underline' : 'text-slate-400'}`}>
            {syncFailuresCount > 0 ? 'clique para reenviar' : 'tudo sincronizado'}
          </p>
        </div>
      </div>
    </div>
  );
};
