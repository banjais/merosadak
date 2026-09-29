import React from 'react';
import { Archive, MapPin, Bookmark, Check, ChevronRight, Settings, X, Share2, Bell } from 'lucide-react';
import { useCardSwipe, SwipeAction } from '../hooks/useCardSwipe';
import { useCardArchive } from '../context/CardArchiveContext';

export interface TravelTip {
  id: string;
  title: string;
  description: string;
  category: string;
  highwayCorridor?: string;
  isPriority?: boolean;
  actionText?: string;
}

interface TipCardProps {
  tip: TravelTip;
  isChecked: boolean;
  onToggleCheck: (id: string) => void;
  onAction: (tip: TravelTip) => void;
}

/**
 * A single tactical tip card with swipe gestures.
 *
 * Extracted into its own component on purpose: the previous version called
 * `useCardSwipe` (18 hooks) inside a `.map()` over the filtered tip list. The
 * category filter changes that list's length, which changed the hook order and
 * made React throw — taking down the whole app via the root error boundary.
 */
export const TipCard: React.FC<TipCardProps> = ({ tip, isChecked, onToggleCheck, onAction }) => {
  const { archiveCard, isArchived } = useCardArchive();

  const leftAction: SwipeAction = {
    id: 'archive',
    label: 'Archive',
    icon: <Archive className="w-5 h-5" />,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/20',
    onTrigger: () => {
      archiveCard({
        id: tip.id,
        type: 'tip',
        data: { title: tip.title, category: tip.category },
      });
    },
  };

  const rightAction: SwipeAction = {
    id: 'action',
    label: 'Action',
    icon: <MapPin className="w-5 h-5" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    onTrigger: () => tip.actionText && onAction(tip),
  };

  const longPressAction: SwipeAction = {
    id: 'pin',
    label: 'Pin',
    icon: <Bookmark className="w-5 h-5" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    onTrigger: () => onToggleCheck(tip.id),
  };

  const {
    dragOffset,
    showQuickOverlay,
    setShowQuickOverlay,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onContextMenu,
    dragStyles,
    leftActionStyles,
    rightActionStyles,
    cardRef,
    isArchived: swipedArchived,
  } = useCardSwipe({
    cardId: `tip-${tip.id}`,
    leftAction,
    rightAction,
    longPressAction,
    threshold: 80,
    longPressDelay: 500,
    haptics: true,
  });

  const archived = swipedArchived || isArchived(tip.id, 'tip');
  if (archived) return null;

  return (
    <div
      ref={cardRef}
      className={`p-3 rounded-xl border transition space-y-2 relative overflow-hidden ${
        isChecked
          ? 'bg-slate-950/60 border-slate-800/60 opacity-80 card card-flat'
          : 'bg-slate-900/90 border border-slate-800 card card-interactive'
      }`}
      style={dragStyles as React.CSSProperties}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onContextMenu={onContextMenu}
    >
      {/* Swipe Action Backgrounds */}
      <div className="absolute inset-0 z-0 flex items-center justify-between pointer-events-none">
        <div
          className="absolute inset-y-0 left-0 w-32 flex items-center justify-start pl-6 text-rose-400 font-bold text-xs uppercase tracking-wider bg-rose-500/10 border-r border-rose-500/20 transition-opacity"
          style={leftActionStyles as React.CSSProperties}
        >
          <Archive className="w-5 h-5 mr-2" />
          Archive
        </div>

        <div
          className="absolute inset-y-0 right-0 w-32 flex items-center justify-end pr-6 text-emerald-400 font-bold text-xs uppercase tracking-wider bg-emerald-500/10 border-l border-emerald-500/20 transition-opacity"
          style={rightActionStyles as React.CSSProperties}
        >
          <MapPin className="w-5 h-5 ml-2" />
          Action
        </div>
      </div>

      {/* Card Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start space-x-2 min-w-0">
            <button
              onClick={() => onToggleCheck(tip.id)}
              className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                isChecked
                  ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                  : 'border-slate-600 hover:border-slate-400 text-transparent'
              }`}
              title={isChecked ? 'Mark as unread' : 'Mark as reviewed'}
            >
              <Check className="w-3 h-3 stroke-[3]" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono font-semibold">
                  {tip.category}
                </span>
                {tip.highwayCorridor && (
                  <span className="text-[9px] text-slate-400 font-mono truncate">
                    • {tip.highwayCorridor}
                  </span>
                )}
                {tip.isPriority && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    Key Recommendation
                  </span>
                )}
              </div>

              <h5
                className={`text-xs font-bold mt-1 leading-snug ${
                  isChecked ? 'line-through text-slate-400' : 'text-white'
                }`}
              >
                {tip.title}
              </h5>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-300 leading-relaxed pl-6">
          {tip.description}
        </p>

        {tip.actionText && (
          <div className="flex items-center justify-end pl-6 pt-1">
            <button
              onClick={() => onAction(tip)}
              className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center space-x-1 transition"
            >
              <span>{tip.actionText}</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions Overlay (Long Press) */}
      {showQuickOverlay && (
        <div
          className="absolute inset-0 z-20 bg-slate-950/95 backdrop-blur-md flex flex-col p-4 border border-amber-500/30 rounded-xl"
          onClick={() => setShowQuickOverlay(false)}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2 text-amber-400">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">Quick Actions</div>
                <div className="text-[10px] text-slate-400 font-mono">{tip.category}</div>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setShowQuickOverlay(false); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 flex-1">
            {tip.actionText && (
              <button
                onClick={(e) => { e.stopPropagation(); onAction(tip); setShowQuickOverlay(false); }}
                className="p-3 rounded-xl border bg-slate-800/50 border-slate-700 text-slate-200 hover:border-emerald-500/40 hover:text-emerald-300 flex flex-col items-center justify-center gap-1.5 transition"
              >
                <MapPin className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-bold">Take Action</span>
                <span className="text-[9px] text-slate-500">{tip.actionText}</span>
              </button>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); onToggleCheck(tip.id); setShowQuickOverlay(false); }}
              className="p-3 rounded-xl border bg-slate-800/50 border-slate-700 text-slate-200 hover:border-amber-500/40 hover:text-amber-300 flex flex-col items-center justify-center gap-1.5 transition"
            >
              <Bookmark className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-bold">{isChecked ? 'Unpin' : 'Pin Tip'}</span>
              <span className="text-[9px] text-slate-500">Save for later</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); setShowQuickOverlay(false); }}
              className="p-3 rounded-xl border bg-slate-800/50 border-slate-700 text-slate-200 hover:border-sky-500/40 hover:text-sky-300 flex flex-col items-center justify-center gap-1.5 transition"
            >
              <Share2 className="w-5 h-5 text-sky-400" />
              <span className="text-xs font-bold">Share Tip</span>
              <span className="text-[9px] text-slate-500">Copy Link</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); setShowQuickOverlay(false); }}
              className="p-3 rounded-xl border bg-slate-800/50 border-slate-700 text-slate-200 hover:border-rose-500/40 hover:text-rose-300 flex flex-col items-center justify-center gap-1.5 transition"
            >
              <Bell className="w-5 h-5 text-rose-400" />
              <span className="text-xs font-bold">Remind Me</span>
              <span className="text-[9px] text-slate-500">Set Notification</span>
            </button>
          </div>

          <div className="pt-3 border-t border-slate-800/50 flex items-center justify-between text-[10px] text-slate-400">
            <span className="font-mono">Tap outside to close</span>
            <span>{tip.category}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TipCard;
