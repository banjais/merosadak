import React from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colorMap = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
};

const toast = {
  info: (msg: string) => console.log('[toast info]', msg),
  success: (msg: string) => console.log('[toast success]', msg),
  warning: (msg: string) => console.log('[toast warning]', msg),
  error: (msg: string) => console.log('[toast error]', msg),
};

export { toast };

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-20 right-4 z-[4000] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-white/20 dark:border-slate-700/40 min-w-[200px] max-w-[calc(100vw-2rem)] max-w-sm animate-in slide-in-from-right-8 fade-in duration-300"
          >
            <div className={`p-1.5 rounded-full ${colorMap[toast.type]} text-white shrink-0`}>
              <Icon size={14} />
            </div>
            <p className="text-sm font-medium text-on-surface dark:text-slate-200 flex-1">{toast.message}</p>
            <button
              onClick={() => onRemove(toast.id)}
              className="p-1 hover:bg-surface-container-low dark:hover:bg-slate-700 rounded-full text-on-surface-variant dark:text-slate-400 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};