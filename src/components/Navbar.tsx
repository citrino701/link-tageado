import React from 'react';
import { Link2, ShieldCheck, FileSpreadsheet, CheckCircle2, AlertCircle, LogIn, LogOut, KeyRound } from 'lucide-react';

interface NavbarProps {
  currentUserEmail: string | null;
  adminEmail: string;
  isConnected: boolean;
  connectedEmail: string | null;
  onConnectGoogle: () => void;
  onLogout: () => void;
  onOpenTests: () => void;
  onOpenConfigOAuth?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUserEmail,
  adminEmail,
  isConnected,
  connectedEmail,
  onConnectGoogle,
  onLogout,
  onOpenTests,
  onOpenConfigOAuth,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
            <Link2 className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 text-lg tracking-tight">Hub de Links Rastreáveis</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-medium">
                Admin
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Central permanente de links rastreáveis integrados ao Google Sheets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Diagnostic tests button */}
          <button
            onClick={onOpenTests}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Verificar os 10 testes obrigatórios da especificação"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Validação</span>
          </button>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-slate-400 leading-none">Google Sheets</span>
              {isConnected ? (
                <span className="flex items-center gap-1 text-emerald-400 font-semibold text-xs leading-tight">
                  <CheckCircle2 className="w-3 h-3" /> Conectado
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400 font-semibold text-xs leading-tight">
                  <AlertCircle className="w-3 h-3" /> Desconectado
                </span>
              )}
            </div>
          </div>

          {/* Auth Button */}
          {currentUserEmail ? (
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-medium text-slate-200">Administrador</span>
                <span className="text-[10px] text-slate-400">{currentUserEmail}</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-xs font-semibold text-emerald-300">
                {currentUserEmail[0].toUpperCase()}
              </div>
              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                title="Desconectar"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onConnectGoogle}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition"
            >
              <LogIn className="w-4 h-4" />
              <span>Conectar Google</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
