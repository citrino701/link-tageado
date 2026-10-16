import React, { useState } from 'react';
import { X, RefreshCw, AlertTriangle, CheckCircle2, FileSpreadsheet, Clock } from 'lucide-react';
import { SyncQueueItem } from '../services/store.ts';

interface SyncQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  queue: SyncQueueItem[];
  onRetry: () => Promise<void>;
}

export const SyncQueueModal: React.FC<SyncQueueModalProps> = ({
  isOpen,
  onClose,
  queue,
  onRetry,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRetry = async () => {
    setIsRetrying(true);
    setFeedback(null);
    try {
      await onRetry();
      setFeedback('Fila reprocessada com sucesso.');
    } catch (e: any) {
      setFeedback(`Erro ao tentar reprocessar: ${e.message}`);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Fila de Falhas de Sincronização</h3>
              <p className="text-xs text-slate-400">
                Eventos que falharam ao gravar na planilha e estão aguardando reprocessamento
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {feedback && (
            <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {queue.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Nenhuma falha na fila</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Todas as gravações nas planilhas foram executadas com sucesso e sincronizadas com a autorização persistente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((item) => (
                <div
                  key={item.queueId}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 space-y-2 text-xs transition"
                >
                  <div className="flex items-center justify-between text-slate-300 font-semibold">
                    <span className="text-slate-100">{item.linkName || `Link ${item.linkId}`}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                          item.status === 'failed'
                            ? 'bg-rose-950/50 text-rose-300 border-rose-500/40'
                            : 'bg-amber-950/50 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {item.status === 'failed' ? 'Falha Persistente (Aguardando Recuperação)' : 'Pendente (Retry Automático)'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                        {item.attempts} tentativa(s)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                    <span className="flex items-center gap-1">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      Planilha: <span className="font-mono text-slate-300 truncate max-w-[200px]">{item.spreadsheetId}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(item.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-rose-300 break-all">
                    {item.error || 'Aguardando primeira tentativa de sincronização...'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/80">
          <span className="text-xs text-slate-400">
            Total não resolvido: <strong className="text-slate-200">{queue.length}</strong> evento(s)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Fechar
            </button>
            <button
              onClick={handleRetry}
              disabled={isRetrying || queue.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Sincronizando...' : 'Recuperar e Reprocessar Todos'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
