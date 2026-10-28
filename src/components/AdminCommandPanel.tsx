import React, { useState } from 'react';
import { fetchJson } from '../utils/apiConfig';
import { Sparkles, Send, Loader2, ShieldAlert, Fuel, Compass, AlertTriangle, MapPin, Database } from 'lucide-react';

interface AdminCommandPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminCommandPanel: React.FC<AdminCommandPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [command, setCommand] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const ADMIN_KEY_HINT = 'Enter your admin key';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !adminKey.trim()) {
      setError('Command and admin key are required.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchJson<any>('/api/ai-admin-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command.trim(), adminKey }),
      });
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Admin command failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const examples = [
    'Set petrol price to 200 rupees per liter',
    'Add a landslide on NH04 near Nagdhunga',
    'Update Nagdhunga tunnel toll to 70 rupees for cars',
  ];

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden animate-fadeIn">
        <div className="bg-slate-800/80 border-b border-slate-700/60 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white font-display">AI Admin Command</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <span className="sr-only">Close</span>
            <span className="text-[10px]">✕</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-400 font-mono mb-1">
            Tell the AI what data to update. It parses your instruction and applies it to live KV data.
          </p>
          <p className="text-[10px] text-slate-500 italic">
            Examples: {examples.join('  •  ')}
          </p>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Admin Key</label>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder={ADMIN_KEY_HINT}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Command</label>
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              rows={3}
              placeholder="e.g. Update diesel price to 198 rupees per liter"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-950/20 border border-rose-900/50 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="text-[11px] text-rose-300">{error}</span>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !command.trim() || !adminKey.trim()}
            className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-sm shadow-lg shadow-rose-500/20 disabled:opacity-50 transition flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Command...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Execute AI Command</span>
              </>
            )}
          </button>
        </div>

        {result && (
          <div className="border-t border-slate-700/60 p-4 bg-slate-800/50">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-2">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>AI Result</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={`text-[10px] px-2 py-1 rounded-full ${result.emotion === 'urgent' ? 'bg-rose-500/20 text-rose-300' : result.emotion === 'excited' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                {result.emotion || 'calm'}
              </span>
              <span className={`text-[10px] px-2 py-1 rounded-full ${result.confirmed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                {result.confirmed ? 'Confirmed' : 'Not confirmed'}
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] overflow-x-auto font-mono">
              <div className="text-slate-400 mb-1">AI Response:</div>
              <div className="text-slate-200 mb-2 whitespace-pre-wrap">{result.aiResponse || ''}</div>
              {result.execution && (
                <div className="mt-2">
                  <div className="text-slate-400 mb-1">Execution:</div>
                  <div className="text-xs text-slate-200 whitespace-pre-wrap">{JSON.stringify(result.execution, null, 2)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-slate-700/60 px-5 py-3 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
