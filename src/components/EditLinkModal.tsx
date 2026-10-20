import React, { useEffect, useState } from 'react';
import { CheckCircle2, Globe, MessageCircle, Save, X } from 'lucide-react';
import type { LinkRecord } from '../services/store.ts';

type Props = {
  link: LinkRecord | null;
  onClose: () => void;
  onSaved: (link: LinkRecord) => void;
};

export function EditLinkModal({ link, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [destinationType, setDestinationType] = useState<'url' | 'whatsapp'>('url');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [source, setSource] = useState('');
  const [medium, setMedium] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!link) return;
    setName(link.name || '');
    setDestinationType(link.destinationType || 'url');
    setDestinationUrl(link.destinationUrl || '');
    setWhatsappNumber(link.whatsappNumber || '');
    setWhatsappMessage(link.whatsappMessage || '');
    setSource(link.source || '');
    setMedium(link.medium || '');
    setContent(link.content || '');
    setError('');
  }, [link]);

  if (!link) return null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin/links/' + encodeURIComponent(link.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, destinationType, destinationUrl, whatsappNumber, whatsappMessage, source, medium, content }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Não consegui salvar as alterações.');
      onSaved(result.link as LinkRecord);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Não consegui salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Editar link</h2>
            <p className="mt-1 text-xs text-slate-400">O endereço público curto permanece igual; esta alteração troca o destino ou os dados do link.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={save} className="space-y-4 p-5">
          <label className="block text-xs font-medium text-slate-300">Nome do link
            <input required value={name} onChange={e => setName(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500" />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-slate-300">Tipo de destino</legend>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDestinationType('url')} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${destinationType === 'url' ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-300'}`}><Globe className="h-4 w-4" /> Site / página</button>
              <button type="button" onClick={() => setDestinationType('whatsapp')} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${destinationType === 'whatsapp' ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-300'}`}><MessageCircle className="h-4 w-4" /> WhatsApp</button>
            </div>
          </fieldset>

          {destinationType === 'url' ? (
            <label className="block text-xs font-medium text-slate-300">URL de destino
              <input required type="url" value={destinationUrl} onChange={e => setDestinationUrl(e.target.value)} placeholder="https://exemplo.com/pagina" className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500" />
            </label>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-300">WhatsApp com DDI e DDD
                <input required value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} placeholder="5511999999999" className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500" />
              </label>
              <label className="block text-xs font-medium text-slate-300">Mensagem preenchida
                <input value={whatsappMessage} onChange={e => setWhatsappMessage(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500" />
              </label>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-xs font-medium text-slate-300">Origem
              <input value={source} onChange={e => setSource(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500" />
            </label>
            <label className="block text-xs font-medium text-slate-300">Meio
              <input value={medium} onChange={e => setMedium(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500" />
            </label>
            <label className="block text-xs font-medium text-slate-300">Conteúdo
              <input value={content} onChange={e => setContent(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500" />
            </label>
          </div>

          {error && <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">Cancelar</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
              {saving ? <><CheckCircle2 className="h-4 w-4 animate-pulse" /> Salvando e sincronizando…</> : <><Save className="h-4 w-4" /> Salvar alteração</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
