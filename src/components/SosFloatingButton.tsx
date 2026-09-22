import React from 'react';
import { Phone } from 'lucide-react';

interface SosFloatingButtonProps {
  onClick: () => void;
  className?: string;
}

/** Compact emergency entry — short label, large tap target, mobile-safe. */
export const SosFloatingButton: React.FC<SosFloatingButtonProps> = ({ onClick, className = '' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Emergency"
      className={`group fixed z-[45] flex items-center gap-2 rounded-full border border-red-500/60 bg-red-600 px-3.5 py-2.5 text-white shadow-lg shadow-red-900/40 transition active:scale-95 hover:bg-red-500 ${className}`}
      style={{
        bottom: 'max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))',
        right: 'max(0.75rem, env(safe-area-inset-right))',
      }}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/90">
        <Phone className="h-4.5 w-4.5" strokeWidth={2.5} />
      </span>
      <span className="pr-1 text-left leading-tight">
        <span className="block text-sm font-black tracking-wide">SOS</span>
        <span className="block text-[10px] font-semibold text-red-100/90">Call · Share GPS</span>
      </span>
    </button>
  );
};

export default SosFloatingButton;
