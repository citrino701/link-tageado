import React, { useMemo, useRef, useState } from 'react';
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
import { campaignCatalog, campaignsForSheet, resolveCampaign, type CampaignTarget } from '../utils/campaigns.ts';
import { buildPublicLink, displayPublicLink } from '../utils/public-link.ts';

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinkCreated: (newLink: LinkRecord) => void;
  adminEmail: string;
  links: LinkRecord[];
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
  links,
}) => {
  // Form fields
  const [name, setName] = useState('');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [destinationType, setDestinationType] = useState<'whatsapp' | 'url'>('whatsapp');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [campaign, setCampaign] = useState('');
  const [campaignMode, setCampaignMode] = useState<'existing' | 'new'>('existing');
  const [aba, setAba] = useState('');
  const [associationMessage, setAssociationMessage] = useState('');
  const validationVersion = useRef(0);
  const catalog = useMemo(() => campaignCatalog(links), [links]);
  const effectiveMode = catalog.length ? campaignMode : 'new';
  const selectedCampaign = catalog.find(c => c.name === campaign);

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

  const invalidateSheetValidation = () => {
    validationVersion.current++;
    setSheetValidation(null);
    setIsValidatingSheet(false);
  };

  const useTarget = (target: CampaignTarget) => {
    setSpreadsheetUrl(target.spreadsheetUrl);
    setAba(target.aba);
    invalidateSheetValidation();
  };

  const selectCampaign = (value: string) => {
    setCampaign(value);
    setCampaignMode('existing');
    const entry = catalog.find(c => c.name === value);
    if (entry?.targets.length === 1) {
      useTarget(entry.targets[0]);
      setAssociationMessage('Planilha preenchida automaticamente pela campanha.');
    } else {
      setSpreadsheetUrl('');
      setAba('');
      invalidateSheetValidation();
      setAssociationMessage(entry ? 'Esta campanha tem mais de uma planilha ou aba. Escolha abaixo.' : '');
    }
  };

  const changeSpreadsheet = (value: string) => {
    setSpreadsheetUrl(value);
    setAba('');
    invalidateSheetValidation();
    const matches = campaignsForSheet(catalog, value);
    const current = matches.find(c => c.name === campaign);
    const match = matches.length === 1 ? matches[0] : current;
    if (match) {
      setCampaign(match.name);
      setCampaignMode('existing');
      const targets = match.targets.filter(t => t.spreadsheetId === extractSpreadsheetId(value));
      if (targets.length === 1) setAba(targets[0].aba);
      setAssociationMessage(`Campanha reconhecida: ${match.name}.`);
    } else if (matches.length > 1) {
      setCampaign('');
      setCampaignMode('existing');
      setAssociationMessage('Esta planilha pertence a mais de uma campanha. Selecione a campanha desejada.');
    } else {
      setAssociationMessage('');
      if (extractSpreadsheetId(value) && effectiveMode === 'existing') {
        setCampaign('');
        setCampaignMode('new');
      }
    }
  };

  const changeCampaignMode = (mode: 'existing' | 'new') => {
    setCampaignMode(mode);
    setCampaign('');
    setSpreadsheetUrl('');
    setAba('');
    setAssociationMessage('');
    invalidateSheetValidation();
  };

  const handleValidateSheet = async () => {
    const version = ++validationVersion.current;
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
        body: JSON.stringify({ spreadsheetUrl, aba: aba || 'Cliques' }),
      });
      const data = await res.json();
      if (version !== validationVersion.current) return;
      if (res.ok && data.success) {
        setSheetValidation({
          valid: true,
          title: data.title,
          id: data.spreadsheetId,
        });
      } else {
        setSheetValidation({
          valid: false,
          id: extractedId,
          error: data.error,
        });
      }
    } catch (e: any) {
      if (version !== validationVersion.current) return;
      setSheetValidation({ valid: false, error: e.message || 'Não foi possível verificar a planilha.' });
    } finally {
      if (version === validationVersion.current) setIsValidatingSheet(false);
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

    let association;
    try {
      association = resolveCampaign(catalog, campaign, spreadsheetUrl, aba);
    } catch (error: any) {
      setErrorMessage(error.message);
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
          spreadsheetUrl: association.spreadsheetUrl,
          aba: association.aba,
          destinationType,
          destinationUrl,
          whatsappNumber,
          whatsappMessage,
          campaign: association.campaign,
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

  const handleCopy = (link: LinkRecord) => {
    const fullUrl = buildPublicLink(link);
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
    setCampaignMode('existing');
    setAba('');
    setAssociationMessage('');
    invalidateSheetValidation();
    setSource('Instagram_Stories');
    setMedium('Social');
    setContent('');
    setCreatedLink(null);
    setSheetValidation(null);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden mx-auto my-4">
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
                A configuração foi salva na aba <strong>Links</strong> da planilha central.
              </p>
            </div>

            {/* Generated Link Display */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-left">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Endereço Curto Rastreável:
              </span>
              <div className="flex items-center justify-between gap-2 bg-slate-900/80 border border-slate-700/60 rounded-lg px-3 py-2">
                <span title={buildPublicLink(createdLink)} className="font-mono text-emerald-400 font-semibold text-sm truncate">
                  {displayPublicLink(createdLink)}
                </span>
                <button
                  onClick={() => handleCopy(createdLink)}
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
                href={buildPublicLink(createdLink)}
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

            <fieldset className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/30 p-4">
              <legend className="px-1 text-xs font-semibold text-slate-200">Campanha *</legend>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de campanha">
                {(['existing', 'new'] as const).map(mode => (
                  <button key={mode} type="button" aria-pressed={effectiveMode === mode}
                    disabled={mode === 'existing' && catalog.length === 0}
                    onClick={() => changeCampaignMode(mode)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ${effectiveMode === mode ? 'border-emerald-500 bg-emerald-600/15 text-emerald-400' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                    {mode === 'existing' ? 'Campanha existente' : 'Nova campanha'}
                  </button>
                ))}
              </div>
              {effectiveMode === 'existing' ? (
                <div>
                  <label htmlFor="campaign-select" className="block mb-1 text-xs text-slate-300">Selecione a campanha</label>
                  <select id="campaign-select" required value={campaign} onChange={e => selectCampaign(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-emerald-500">
                    <option value="">Escolha uma campanha</option>
                    {catalog.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label htmlFor="campaign-name" className="block mb-1 text-xs text-slate-300">Nome da nova campanha</label>
                  <input id="campaign-name" type="text" required value={campaign} onChange={e => setCampaign(e.target.value)}
                    onBlur={() => {
                      const existing = catalog.find(c => c.name.toLowerCase() === campaign.trim().toLowerCase());
                      if (existing) selectCampaign(existing.name);
                    }}
                    placeholder="Ex: Primavera_2026"
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500" />
                  <p className="mt-2 text-xs text-slate-400">A campanha será cadastrada junto com este link.</p>
                </div>
              )}
              {effectiveMode === 'existing' && selectedCampaign && selectedCampaign.targets.length > 1 && (
                <div>
                  <label htmlFor="campaign-sheet" className="block mb-1 text-xs text-slate-300">Planilha e aba da campanha</label>
                  <select id="campaign-sheet" required
                    value={selectedCampaign.targets.findIndex(t => t.spreadsheetId === extractSpreadsheetId(spreadsheetUrl) && t.aba === aba)}
                    onChange={e => { const target = selectedCampaign.targets[Number(e.target.value)]; if (target) useTarget(target); }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100">
                    <option value={-1}>Escolha onde registrar os cliques</option>
                    {selectedCampaign.targets.map((t, i) => <option key={`${t.spreadsheetId}:${t.aba}`} value={i}>{t.title} · {t.aba} · {t.spreadsheetId.slice(-6)}</option>)}
                  </select>
                </div>
              )}
              <p className="text-xs text-emerald-400" role="status">{associationMessage || (effectiveMode === 'existing' ? 'Escolha a campanha para preencher a planilha automaticamente. Você também pode colar uma planilha abaixo.' : 'Cole a planilha que receberá os cliques desta campanha.')}</p>
            </fieldset>

            {/* 2. Link da Planilha Google */}
            <div>
              <label htmlFor="spreadsheet-url" className="block text-xs font-semibold text-slate-200 mb-1.5">
                Link da Planilha Google <span className="text-emerald-400">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400 absolute left-3.5 top-3" />
                  <input
                    id="spreadsheet-url"
                    type="text"
                    required={effectiveMode === 'new'}
                    value={spreadsheetUrl}
                    onChange={(e) => changeSpreadsheet(e.target.value)}
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
                  {sheetValidation.valid ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span>{sheetValidation.valid ? `${sheetValidation.title}: aba ${aba || 'Cliques'} pronta para receber os acessos.` : sheetValidation.error}</span>
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

