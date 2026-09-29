import React, { useState } from 'react';
import { Archive, ArchiveRestore, Trash2, X } from 'lucide-react';
import { useCardArchive } from '../context/CardArchiveContext';

/**
 * Floating archive tray — restore or clear archived swipe cards.
 */
export const ArchiveTray: React.FC = () => {
  const { archivedCards, restoreCard, clearArchived, getArchivedCount } = useCardArchive();
  const [open, setOpen] = useState(false);
  const count = getArchivedCount();

  if (count === 0 && !open) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-3 z-40 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/95 px-3 py-2 text-[11px] font-bold text-slate-200 shadow-xl backdrop-blur-md hover:border-emerald-500/40 hover:text-emerald-300 sm:bottom-6"
        aria-label={`Open archive (${count})`}
      >
        <Archive className="h-3.5 w-3.5 text-rose-400" />
        <span>Archive</span>
        {count > 0 && (
          <span className="min-w-[1.25rem] rounded-full bg-rose-500/20 px-1.5 py-0.5 text-center text-[10px] text-rose-300">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3">
          <div
            className="w-full max-w-md max-h-[70vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl flex flex-col"
            role="dialog"
            aria-label="Archived cards"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-rose-400" />
                <span className="text-sm font-black text-white">Archived cards</span>
                <span className="text-[11px] text-slate-500">{count}</span>
              </div>
              <div className="flex items-center gap-1">
                {count > 0 && (
                  <button
                    type="button"
                    onClick={() => clearArchived()}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-950/40"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {archivedCards.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">Nothing archived.</p>
              ) : (
                archivedCards
                  .slice()
                  .sort((a, b) => b.archivedAt - a.archivedAt)
                  .map((card) => (
                    <div
                      key={`${card.type}-${card.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {(card.data?.title as string) || card.id}
                        </div>
                        <div className="text-[10px] text-slate-500 capitalize">{card.type}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => restoreCard(card.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-700/40 bg-emerald-950/40 px-2 py-1 text-[10px] font-bold text-emerald-300"
                      >
                        <ArchiveRestore className="h-3 w-3" />
                        Restore
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
