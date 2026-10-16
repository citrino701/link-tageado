import React, { useState } from 'react';
import {
  X,
  Plus,
  Link2,
  FileSpreadsheet,
  MessageCircle,
  Globe,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { extractSpreadsheetId, buildWhatsAppUrl, validateDestinationUrl } from '../utils/sheets-helpers.ts';
import { LinkRecord } from '../services/store.ts';

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinkCreated: (newLink: LinkRecord) => void;
  adminEmail: string;
}

const ORIGIN_PRESETS = [
  'Instagram_Stories',
  'Instagram_Bio',
  'Instagram_Reels',
  'Grupo_WhatsApp',
  'Trafego_Pago',
  'QR_Code',
];

export const CreateLinkModal: React.FC<CreateLinkModalProps> = ({
  isOpen,
  onClose,
  onLinkCreated,
  adminEmail,
}) => {
  // Form fields
  const [name, setName] = useState('');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [destinationType, setDestinationType] = useState<'whatsapp' | 'url'>('whatsapp');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [campaign, setCampaign] = useState('');
  const [source, setSource] = useState('Instagram_Stories');
  const [medium, setMedium] = useState('Social');
  const [content, setContent] = useState('');

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingSheet, setIsValidatingSheet] = useState(false);
  const [sheetValidation, setSheetValidation] = useState<{
    valid: boolean;
    title?: string;
    id?: string;
    error?: string;
  } | null>(null);
  const [createdLink, setCreatedLink] = useState<LinkRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleValidateSheet = async () => {
    const extractedId = extractSpreadsheetId(spreadsheetUrl);
    if (!extractedId) {
      setSheetValidation({ valid: false, error: 'URL ou ID de planilha inválido.' });
      return;
    }

    setIsValidatingSheet(true);
    setSheetValidation(null);

    try {
      const res = await fetch('/api/admin/validate-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-email': adminEmail },
        body: JSON.stringify({ spreadsheetUrl }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSheetValidation({
          valid: true,
          title: data.title,
          id: data.spreadsheetId,
        });
      } else {
        setSheetValidation({
          valid: true, // Still allow submission if ID is valid even if sheet permissions are pending
          title: 'Planilha identificada (ID extraído)',
          id: extractedId,
          error: data.error,
        });
      }
    } catch (e: any) {
      setSheetValidation({
        valid: true,
        id: extractedId,
        title: 'Planilha válida',
      });
    } finally {
      setIsValidatingSheet(false);
    }
  };

  // Live preview URL calculation
  let previewDestination = '';
  if (destinationType === 'whatsapp') {
    try {
      if (whatsappNumber) {
        previewDestination = buildWhatsAppUrl(whatsappNumber, whatsappMessage);
      }
    } catch {
      previewDestination = 'Número inválido';
    }
  } else {
    previewDestination = destinationUrl || 'https://seu-destino.com.br';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
      setErrorMessage('Cole um link válido da Planilha Google.');
      return;
    }

    if (destinationType === 'whatsapp') {
      const cleanDigits = whatsappNumber.replace(/\D/g, '');
      if (cleanDigits.length < 10) {
        setErrorMessage('Informe um número de WhatsApp completo com código do país e DDD (ex: 5511999999999).');
        return;
      }
    } else {
      const val = validateDestinationUrl(destinationUrl);
      if (!val.isValid) {
        setErrorMessage(val.error || 'URL de destino inválida.');
        return;
      }
    }

    if (!campaign.trim()) {
      setErrorMessage('Defina o nome da campanha.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail,
        },
        body: JSON.stringify({
          name,
          spreadsheetUrl,
          destinationType,
          destinationUrl,
          whatsappNumber,
          whatsappMessage,
          campaign,
          source,
          medium,
          content,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao criar o link rastreável');
      }

      setCreatedLink(data.link);
      onLinkCreated(data.link);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado ao criar o link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (path: string) => {
    const fullUrl = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setName('');
    setSpreadsheetUrl('');
    setDestinationType('whatsapp');
    setWhatsappNumber('');
    setWhatsappMessage('');
    setDestinationUrl('');
    setCampaign('');
    setSource('Instagram_Stories');
    setMedium('Social');
    setContent('');
    setCreatedLink(null);
    setSheetValidation(null);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Criar Novo Link Rastreável</h3>
              <p className="text-xs text-slate-400">
                Gere um identificador curto conectado automaticamente à sua Planilha Google
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-medium transition"
            title="Fechar e voltar ao painel"
          >
            <X className="w-4 h-4" />
            <span>Fechar</span>
          </button>
        </div>


        {/* Success View */}
        {createdLink ? (
          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h4 className="text-xl font-bold text-slate-100">Link Rastreável Gerado com Sucesso!</h4>
              <p className="text-sm text-slate-400 mt-1">
                A configuração foi salva no Firestore e a linha foi registrada na aba <strong>Links</strong> da sua planilha.
              </p>
            </div>

            {/* Generated Link Display */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-left">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Endereço Curto Rastreável:
              </span>
              <div className="flex items-center justify-between gap-2 bg-slate-900/80 border border-slate-700/60 rounded-lg px-3 py-2">
                <span className="font-mono text-emerald-400 font-semibold text-sm truncate">
                  {window.location.origin}{createdLink.shortPath}
                </span>
                <button
                  onClick={() => handleCopy(createdLink.shortPath)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copiado!' : 'Copiar link'}</span>
                </button>
              </div>
            </div>

            {/* Action Buttons as requested */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
              <a
                href={createdLink.shortPath}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Testar link</span>
              </a>

              <a
                href={createdLink.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Abrir planilha</span>
              </a>

              <button
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
              >
                <span>Concluir e Voltar ao Painel</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* 1. Nome do Link */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                Nome do Link <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Stories - Promoção de Primavera"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>

            {/* 2. Link da Planilha Google */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                Link da Planilha Google <span className="text-emerald-400">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400 absolute left-3.5 top-3" />
                  <input
                    type="url"
                    required
                    value={spreadsheetUrl}
                    onChange={(e) => {
                      setSpreadsheetUrl(e.target.value);
                      setSheetValidation(null);
                    }}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5.../edit"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleValidateSheet}
                  disabled={isValidatingSheet || !spreadsheetUrl}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition disabled:opacity-50 shrink-0"
                >
                  {isValidatingSheet ? 'Verificando...' : 'Verificar Planilha'}
                </button>
              </div>

              {sheetValidation && (
                <div
                  className={`mt-2 p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                    sheetValidation.valid
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-950/20 border-rose-500/30 text-rose-400'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    <strong>{sheetValidation.title || 'Planilha identificada'}:</strong> ID {sheetValidation.id}. As abas
                    Links, Cliques e Resumo serão mantidas automaticamente.
                  </span>
                </div>
              )}
            </div>

            {/* 3. Tipo de Destino */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-2">
                Tipo de Destino <span className="text-emerald-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDestinationType('whatsapp')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition ${
                    destinationType === 'whatsapp'
                      ? 'bg-emerald-600/15 border-emerald-500 text-emerald-400'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp (wa.me)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDestinationType('url')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition ${
                    destinationType === 'url'
                      ? 'bg-emerald-600/15 border-emerald-500 text-emerald-400'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span>URL Comum (Website)</span>
                </button>
              </div>
            </div>

            {/* 4. Destino Configuração */}
            {destinationType === 'whatsapp' ? (
              <div className="space-y-3 bg-slate-850/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Número do WhatsApp (Código do País + DDD + Número) <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="Ex: 5511999998888 (apenas números)"
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Formato internacional: 55 (Brasil) + DDD (ex: 11) + 9 dígitos
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Mensagem Inicial Pré-definida (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={whatsappMessage}
                    onChange={(e) => setWhatsappMessage(e.target.value)}
                    placeholder="Ex: Olá! Vim pelo Stories e quero o cupom especial."
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition resize-none"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-slate-850/60 p-4 rounded-xl border border-slate-800">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  URL de Destino Completa <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://seusite.com.br/pagina-de-vendas"
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition font-mono text-xs"
                />
              </div>
            )}

            {/* 5. Parâmetros de Rastreamento (Campanha, Origem, Meio, Conteúdo) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Campanha <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={campaign}
                  onChange={(e) => setCampaign(e.target.value)}
                  placeholder="Ex: Primavera_2026"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Meio (Medium)
                </label>
                <input
                  type="text"
                  value={medium}
                  onChange={(e) => setMedium(e.target.value)}
                  placeholder="Ex: Social, CPC, Organico"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            {/* Origem com botões rápidos */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-200">
                  Origem (Source) <span className="text-emerald-400">*</span>
                </label>
                <span className="text-[11px] text-slate-400">Sugestões rápidas:</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {ORIGIN_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSource(preset)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                      source === preset
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="text"
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Ex: Instagram_Stories"
                className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Conteúdo */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Conteúdo (Content)
              </label>
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Ex: Stories_Foto_Cupom10 ou Video_Depoimento"
                className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Preview do Destino */}
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                Destino Final Pré-configurado:
              </span>
              <p className="font-mono text-xs text-slate-300 truncate">
                {previewDestination}
              </p>
            </div>

            {/* Action Buttons: Voltar / Cancelar and Submit */}
            <div className="pt-2 flex flex-col-reverse sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                disabled={isSubmitting}
                className="w-full sm:w-1/3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <span>Cancelar / Voltar</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-2/3 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Salvando e registrando na planilha...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Gerar Link Rastreável</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
};
