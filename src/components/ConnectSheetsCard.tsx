import React from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  KeyRound,
  Lock,
  AlertTriangle,
  Copy,
} from 'lucide-react';

interface ConnectSheetsCardProps {
  isConnected: boolean;
  isOAuthConfigured: boolean;
  connectedEmail: string | null;
  connectedAt: string | null;
  adminEmail: string;
  onConnectGoogle: () => void;
  onOpenConfigOAuth: () => void;
  isLoading?: boolean;
}

export const ConnectSheetsCard: React.FC<ConnectSheetsCardProps> = ({
  isConnected,
  isOAuthConfigured,
  connectedEmail,
  connectedAt,
  adminEmail,
  onConnectGoogle,
  onOpenConfigOAuth,
  isLoading,
}) => {
  const currentRedirectUri = `${window.location.origin}/api/auth/google/callback`;
  const [copiedUri, setCopiedUri] = React.useState(false);

  const handleCopyUri = () => {
    navigator.clipboard.writeText(currentRedirectUri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Etapa Inicial Obrigatória: Autorização OAuth 2.0</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            Conectar Google Sheets
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            Autorize o acesso ao Google Sheets via OAuth 2.0 no backend. A rota pública de rastreamento{' '}
            <strong className="text-emerald-400">/r/:linkId</strong> registrará os cliques nas
            planilhas vinculadas com fila persistente e retry automático.{' '}
            <span className="text-slate-400">Nenhum visitante precisará fazer login ou interagir com o Google.</span>
          </p>

          {/* Transparência sobre Escopo e Ciclo de Vida do Token (Requisito 5) */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-700/80 text-xs space-y-2.5">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <KeyRound className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Transparência de Acesso & Ciclo de Vida do Token</span>
            </div>
            
            <p className="text-slate-300 text-[11px] leading-relaxed">
              <strong className="text-emerald-400">Escopo Spreadsheets Amplo:</strong> O aplicativo solicita o escopo{' '}
              <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-[10px] text-emerald-300">
                https://www.googleapis.com/auth/spreadsheets
              </code>
              . Esse escopo concede acesso amplo de leitura e edição às planilhas da conta conectada. Isso é necessário para que você possa colar a URL de qualquer planilha já criada no seu Google Drive, sem depender do seletor manual.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800 text-[11px]">
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="font-semibold text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Modo de Teste (7 dias)
                </span>
                <p className="text-slate-400 text-[10px] leading-normal">
                  Se a tela de consentimento no Google Cloud Console estiver com status <strong>"Em teste" (Testing)</strong>, o Google revoga o refresh token a cada <strong>7 dias</strong> por política de segurança. Para evitar isso, altere o status do app para <strong>"Em produção"</strong> no Cloud Console.
                </p>
              </div>

              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="font-semibold text-slate-300 flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> Quando reconectar?
                </span>
                <ul className="text-slate-400 text-[10px] space-y-0.5 list-disc list-inside">
                  <li>Após 7 dias se o app estiver no Modo de Teste;</li>
                  <li>Se a senha da Conta Google for alterada;</li>
                  <li>Se as permissões forem revogadas no painel da conta;</li>
                  <li>Se a conta ficar inativa por mais de 6 meses.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Admin restrito: <strong className="text-slate-200">{adminEmail}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>Criptografia AES-256-GCM para tokens</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Abas Links, Cliques e Resumo automáticas</span>
            </div>
          </div>

          {!isOAuthConfigured && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs space-y-2 mt-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Configuração de Credenciais OAuth 2.0</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Para conectar sua Conta Google, defina as variáveis de ambiente{' '}
                <code className="bg-amber-900/60 px-1 py-0.5 rounded font-mono text-[10px]">GOOGLE_CLIENT_ID</code> e{' '}
                <code className="bg-amber-900/60 px-1 py-0.5 rounded font-mono text-[10px]">GOOGLE_CLIENT_SECRET</code>{' '}
                com as credenciais do seu projeto no Google Cloud Console.
              </p>
              <div className="flex items-center justify-between gap-2 bg-slate-950/60 p-2 rounded-lg border border-amber-500/20 font-mono text-[11px] text-amber-300">
                <span className="truncate">Redirect URI: {currentRedirectUri}</span>
                <button
                  type="button"
                  onClick={handleCopyUri}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 text-[10px] font-sans transition shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedUri ? 'Copiado!' : 'Copiar URI'}</span>
                </button>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onOpenConfigOAuth}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition shadow-sm"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Inserir Client ID e Secret Aqui</span>
                </button>
              </div>
            </div>
          )}
          {isOAuthConfigured && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onOpenConfigOAuth}
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 underline transition"
              >
                <KeyRound className="w-3 h-3 text-emerald-400" />
                <span>Ver / Alterar Credenciais OAuth (Client ID)</span>
              </button>
            </div>
          )}
        </div>


        <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-3 shrink-0">
          {isConnected ? (
            <div className="bg-slate-800/80 border border-emerald-500/30 rounded-xl p-4 text-left w-full sm:w-auto">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Google Sheets Conectado</span>
              </div>
              <p className="text-xs text-slate-300">
                Conta: <strong className="text-slate-100">{connectedEmail || adminEmail}</strong>
              </p>
              {connectedAt && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Conectado em: {new Date(connectedAt).toLocaleDateString('pt-BR')}
                </p>
              )}
              <button
                onClick={onConnectGoogle}
                disabled={isLoading}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-700/80 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-600 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Renovar autorização</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onConnectGoogle}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 transition group"
            >
              <FileSpreadsheet className="w-5 h-5 text-white" />
              <span>Conectar Conta Google</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
