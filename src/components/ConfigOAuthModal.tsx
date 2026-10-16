import React, { useState } from 'react';
import {
  X,
  KeyRound,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';

interface ConfigOAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  adminEmail: string;
}

export const ConfigOAuthModal: React.FC<ConfigOAuthModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  adminEmail,
}) => {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [hasExistingSecret, setHasExistingSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      fetch('/api/admin/status')
        .then((r) => r.json())
        .then((data) => {
          if (data.clientId) {
            setClientId(data.clientId);
          }
          if (data.hasClientSecret) {
            setHasExistingSecret(true);
          }
        })
        .catch((err) => console.warn('Could not fetch status for OAuth modal:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentRedirectUri = `${window.location.origin}/api/auth/google/callback`;
  const devRedirectUri = 'https://ais-dev-ijtfx7avdwg54sn74mqctd-152896923697.us-east1.run.app/api/auth/google/callback';
  const preRedirectUri = 'https://ais-pre-ijtfx7avdwg54sn74mqctd-152896923697.us-east1.run.app/api/auth/google/callback';

  const urisToCopy = [
    { label: 'URI Atual deste Ambiente (Recomendado)', uri: currentRedirectUri },
    { label: 'URI de Desenvolvimento (Cloud Run)', uri: devRedirectUri },
    { label: 'URI de Pré-visualização (Cloud Run)', uri: preRedirectUri },
  ];

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clientId.trim()) {
      setError('O Client ID é obrigatório.');
      return;
    }
    if (!clientSecret.trim() && !hasExistingSecret) {
      setError('O Client Secret é obrigatório.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/config-oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail,
        },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar credenciais.');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar credenciais.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Configurar Credenciais OAuth 2.0</h3>
              <p className="text-xs text-slate-400">
                Insira as credenciais do seu próprio projeto Google Cloud
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Instructions Box */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs space-y-2 text-slate-300">
            <div className="flex items-center justify-between font-semibold text-slate-200">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Passo 1: Criar Cliente OAuth no Google Cloud
              </span>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px]"
              >
                <span>Console GCP</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              1. Acesse o console do Google Cloud e crie uma credencial do tipo <strong>OAuth client ID</strong> (Aplicativo Web).<br />
              2. Na seção <strong>Authorized redirect URIs</strong>, cadastre a URI abaixo:
            </p>

            <div className="space-y-1.5 pt-1">
              {urisToCopy.map((item, idx) => (
                <div
                  key={item.uri}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800"
                >
                  <div className="truncate font-mono text-[11px] text-emerald-400">
                    <span className="text-[10px] text-slate-400 block font-sans">{item.label}</span>
                    {item.uri}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(item.uri, idx)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] shrink-0 border border-slate-700 transition"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                GOOGLE_CLIENT_ID <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Ex: 1234567890-abcdef.apps.googleusercontent.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-200">
                  GOOGLE_CLIENT_SECRET {!hasExistingSecret && <span className="text-emerald-400">*</span>}
                </label>
                {hasExistingSecret && (
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Configurado no servidor
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  required={!hasExistingSecret}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={hasExistingSecret ? 'Deixe em branco para manter o secret atual ou digite para atualizar' : 'Ex: GOCSPX-xxxxxxxxxxxxxxxxxxxx'}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {hasExistingSecret && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Se você não digitar nada, o Client Secret atualmente salvo será mantido.
                </p>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Salvando...' : 'Salvar e Ativar OAuth'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
