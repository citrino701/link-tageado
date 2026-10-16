import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, XCircle, Play, RefreshCw, AlertCircle } from 'lucide-react';

interface DiagnosticTestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminEmail: string;
}

export const DiagnosticTestsModal: React.FC<DiagnosticTestsModalProps> = ({
  isOpen,
  onClose,
  adminEmail,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<
    Array<{ id: number; title: string; passed: boolean; details: string }>
  >([]);
  const [lastRunTime, setLastRunTime] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunTests = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/admin/run-diagnostic-tests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail,
        },
      });
      const data = await res.json();
      if (data.results) {
        setTestResults(data.results);
        setLastRunTime(new Date().toLocaleTimeString('pt-BR'));
      }
    } catch (e) {
      console.error('Error running diagnostic tests:', e);
    } finally {
      setIsRunning(false);
    }
  };

  const allPassed = testResults.length > 0 && testResults.every((t) => t.passed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Validação da implantação</h3>
              <p className="text-xs text-slate-400">
                Confere acesso ao Apps Script, planilha central e cadastro de links
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
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {/* Status banner */}
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
              allPassed
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                : testResults.length === 0
                  ? 'bg-slate-950/50 border-slate-700 text-slate-300'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {allPassed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
              <span>
                {testResults.length === 0
                  ? <strong>Execute a validação para conferir a implantação.</strong>
                  : allPassed
                    ? <strong>Validação concluída sem erros.</strong>
                    : <strong>Há verificações que precisam de atenção.</strong>}
              </span>
            </div>
            {lastRunTime && (
              <span className="text-[11px] text-slate-400">Última execução: {lastRunTime}</span>
            )}
          </div>

          {/* Test items list */}
          <div className="space-y-2">
            {testResults.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-3 text-xs"
              >
                <div className="mt-0.5 shrink-0">
                  {t.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">
                      {t.id}. {t.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        t.passed
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {t.passed ? 'Aprovado' : 'Falha'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/80">
          <span className="text-xs text-slate-400">
            Lógica determinística • Sem uso da API Gemini em tempo de execução
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Fechar
            </button>
            <button
              onClick={handleRunTests}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Executando testes...' : 'Reexecutar Validação'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
