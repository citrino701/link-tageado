import React from 'react';
import { Check, CloudUpload, LoaderCircle, Palette, ShieldCheck, UserRound } from 'lucide-react';

export type HubTheme = 'night' | 'paper' | 'violet' | 'ocean' | 'emerald-glass';

interface SettingsPanelProps {
  adminEmail: string;
  theme: HubTheme;
  onThemeChange: (theme: HubTheme) => void;
  onOpenTests: () => void;
  onSyncCloudflare: () => void;
  isCloudflareSyncing: boolean;
}

const themeOptions: Array<{ id: HubTheme; name: string; description: string; colors: string[] }> = [
  { id: 'night', name: 'Noite esmeralda', description: 'Tema escuro original', colors: ['#061512', '#0d2721', '#34d399'] },
  { id: 'emerald-glass', name: 'Noite esmeralda Glassmorphism', description: 'Vidro translúcido sobre fundo verde profundo', colors: ['#061512', '#155e4a', '#a7f3d0'] },
  { id: 'paper', name: 'Off-white e açafrão', description: 'Fundo claro e destaques suaves', colors: ['#f7f5ef', '#ead796', '#3d7458'] },
  { id: 'violet', name: 'Violeta e ciano', description: 'Roxo escuro com detalhes frios', colors: ['#100d1b', '#8b5cf6', '#22d3ee'] },
  { id: 'ocean', name: 'Azul atlântico', description: 'Azul claro e tons oceânicos', colors: ['#e8f1f2', '#1b98e0', '#247ba0'] },
];

export function SettingsPanel({
  adminEmail,
  theme,
  onThemeChange,
  onOpenTests,
  onSyncCloudflare,
  isCloudflareSyncing,
}: SettingsPanelProps) {
  return (
    <section className="space-y-5" aria-label="Configurações do Hub">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">Preferências</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-100">Configurações</h1>
        <p className="mt-1 text-sm text-slate-400">Ajustes visuais e ferramentas administrativas do painel.</p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Palette className="h-4 w-4 text-emerald-300" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Aparência</h2>
            <p className="text-xs text-slate-400">A escolha fica salva neste navegador.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {themeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={theme === option.id}
              onClick={() => onThemeChange(option.id)}
              className={'rounded-xl border p-3 text-left transition ' +
                (theme === option.id
                  ? 'border-emerald-400/50 bg-emerald-400/10'
                  : 'border-slate-800 bg-slate-950/30 hover:border-slate-700')}
            >
              <span className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-100">{option.name}</span>
                {theme === option.id && <Check className="h-4 w-4 text-emerald-300" />}
              </span>
              <span className="flex gap-1.5" aria-hidden="true">
                {option.colors.map((color) => <span key={color} className="h-5 flex-1 rounded-md border border-white/10" style={{ backgroundColor: color }} />)}
              </span>
              <span className="mt-2 block text-[11px] text-slate-400">{option.description}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-emerald-300" />
            <h2 className="text-sm font-semibold text-slate-100">Conta autorizada</h2>
          </div>
          <p className="mt-2 break-all text-sm text-slate-300">{adminEmail}</p>
          <p className="mt-1 text-xs text-slate-400">Acesso administrativo restrito às contas liberadas no projeto.</p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2">
            <CloudUpload className="h-4 w-4 text-emerald-300" />
            <h2 className="text-sm font-semibold text-slate-100">Manutenção</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">Sincronize os links existentes ou rode um diagnóstico do painel.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onSyncCloudflare} disabled={isCloudflareSyncing} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60">
              {isCloudflareSyncing ? <LoaderCircle className="h-4 w-4 animate-spin text-emerald-300" /> : <CloudUpload className="h-4 w-4 text-emerald-300" />}
              {isCloudflareSyncing ? 'Sincronizando…' : 'Sincronizar Cloudflare'}
            </button>
            <button type="button" onClick={onOpenTests} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700">
              <ShieldCheck className="h-4 w-4 text-emerald-300" /> Validar painel
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
