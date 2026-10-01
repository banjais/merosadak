import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Archive,
  ArchiveRestore,
  Route,
  AlertTriangle,
  FileText,
  Navigation,
  MapPin,
  X,
} from 'lucide-react';
import { useCardArchive } from '../context/CardArchiveContext';

interface CardReelItem {
  id: string;
  type: 'highway' | 'incident' | 'tip' | 'custom' | 'report' | 'distance';
  title: string;
  subtitle?: string;
  content: React.ReactNode;
  data: Record<string, unknown>;
  actionLabel?: string;
  onAction?: () => void;
}

interface CardReelCarouselProps {
  cards: CardReelItem[];
  title?: string;
  showArchiveControls?: boolean;
}

const typeConfig = {
  highway: {
    icon: Route,
    color: 'emerald',
    label: 'Highway',
  },
  incident: {
    icon: AlertTriangle,
    color: 'rose',
    label: 'Incident',
  },
  report: {
    icon: FileText,
    color: 'cyan',
    label: 'Report',
  },
  distance: {
    icon: Navigation,
    color: 'amber',
    label: 'Distance',
  },
  tip: {
    icon: MapPin,
    color: 'purple',
    label: 'Tip',
  },
  custom: {
    icon: MapPin,
    color: 'slate',
    label: 'Custom',
  },
};

export const CardReelCarousel: React.FC<CardReelCarouselProps> = ({
  cards,
  title = 'Cards',
  showArchiveControls = true,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeStart, setSwipeStart] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { archiveCard, restoreCard, isArchived } = useCardArchive();

  const currentCard = cards[currentIndex];
  const typeInfo = typeConfig[currentCard?.type || 'custom'];
  const Icon = typeInfo.icon;

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    setSwipeOffset(0);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % cards.length);
    setSwipeOffset(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setSwipeStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (swipeStart === null) return;
    const currentX = e.touches[0].clientX;
    setSwipeOffset(currentX - swipeStart);
  };

  const handleTouchEnd = () => {
    if (swipeStart === null) return;
    const threshold = 50;

    if (swipeOffset > threshold) {
      handlePrevious();
    } else if (swipeOffset < -threshold) {
      handleNext();
    }

    setSwipeStart(null);
    setSwipeOffset(0);
  };

  const handleArchive = () => {
    if (currentCard && showArchiveControls) {
      archiveCard({
        id: currentCard.id,
        type: currentCard.type,
        data: currentCard.data,
      });
      handleNext();
    }
  };

  const handleRestore = () => {
    if (currentCard && showArchiveControls) {
      restoreCard(currentCard.id);
    }
  };

  const isCurrentArchived = currentCard && isArchived(currentCard.id);

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <span className="text-[10px] rounded-full bg-slate-800 text-slate-400 px-2 py-0.5">
            {currentIndex + 1} / {cards.length}
          </span>
        </div>
      </div>

      {/* Card Container */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Card */}
        <div
          className="w-full bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 min-h-[320px] flex flex-col justify-between transition-transform"
          style={{
            transform: `translateX(${swipeOffset * 0.3}px)`,
            opacity: 1 - Math.abs(swipeOffset) / 500,
          }}
        >
          {/* Card Header */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`p-1.5 rounded-lg bg-${typeInfo.color}-500/10 text-${typeInfo.color}-400`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider text-${typeInfo.color}-400`}
                  >
                    {typeInfo.label}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white truncate">
                  {currentCard?.title}
                </h3>
                {currentCard?.subtitle && (
                  <p className="text-[11px] text-slate-400 mt-1 truncate">
                    {currentCard.subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Card Content */}
          <div className="flex-1 py-3 text-sm text-slate-200 overflow-y-auto max-h-40">
            {currentCard?.content}
          </div>

          {/* Card Footer - Actions */}
          <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
            {currentCard?.actionLabel && currentCard?.onAction && (
              <button
                onClick={currentCard.onAction}
                className="flex-1 px-3 py-2 text-xs font-bold rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition"
              >
                {currentCard.actionLabel}
              </button>
            )}

            {showArchiveControls && (
              <>
                {isCurrentArchived ? (
                  <button
                    onClick={handleRestore}
                    className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition inline-flex items-center gap-1"
                    title="Restore this card"
                  >
                    <ArchiveRestore className="w-3 h-3" />
                    Restore
                  </button>
                ) : (
                  <button
                    onClick={handleArchive}
                    className="px-3 py-2 text-xs font-bold rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition inline-flex items-center gap-1"
                    title="Archive this card"
                  >
                    <Archive className="w-3 h-3" />
                    Archive
                  </button>
                )}
              </>
            )}
          </div>

          {/* Swipe Hint */}
          <div className="absolute bottom-2 left-2 right-2 text-[9px] text-slate-500 text-center pointer-events-none">
            ← Swipe →
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={handlePrevious}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition disabled:opacity-50"
          title="Previous card"
          aria-label="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Progress Bar */}
        <div className="flex-1 flex gap-1">
          {cards.map((_, idx) => (
            <div
              key={idx}
              className={`flex-1 h-1 rounded-full transition ${
                idx === currentIndex
                  ? 'bg-emerald-500'
                  : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition disabled:opacity-50"
          title="Next card"
          aria-label="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
