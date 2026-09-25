import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface ArchivedCard {
  id: string;
  type: 'highway' | 'incident' | 'tip' | 'custom';
  data: Record<string, unknown>;
  archivedAt: number;
}

interface CardArchiveContextType {
  archivedCards: ArchivedCard[];
  isArchived: (id: string, type?: string) => boolean;
  archiveCard: (card: Omit<ArchivedCard, 'archivedAt'>) => void;
  restoreCard: (id: string) => void;
  clearArchived: (type?: string) => void;
  getArchivedCount: (type?: string) => number;
}

const CardArchiveContext = createContext<CardArchiveContextType | null>(null);

const STORAGE_KEY = 'merosadak-card-archive';

export function CardArchiveProvider({ children }: { children: ReactNode }) {
  const [archivedCards, setArchivedCards] = useState<ArchivedCard[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setArchivedCards(JSON.parse(stored));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(archivedCards));
    } catch {}
  }, [archivedCards]);

  const isArchived = useCallback((id: string, type?: string) => {
    return archivedCards.some(c => c.id === id && (!type || c.type === type));
  }, [archivedCards]);

  const archiveCard = useCallback((card: Omit<ArchivedCard, 'archivedAt'>) => {
    setArchivedCards(prev => {
      if (prev.some(c => c.id === card.id && c.type === card.type)) return prev;
      return [...prev, { ...card, archivedAt: Date.now() }];
    });
  }, []);

  const restoreCard = useCallback((id: string) => {
    setArchivedCards(prev => prev.filter(c => c.id !== id));
  }, []);

  const clearArchived = useCallback((type?: string) => {
    setArchivedCards(prev => type ? prev.filter(c => c.type !== type) : []);
  }, []);

  const getArchivedCount = useCallback((type?: string) => {
    return archivedCards.filter(c => !type || c.type === type).length;
  }, [archivedCards]);

  return (
    <CardArchiveContext.Provider value={{
      archivedCards,
      isArchived,
      archiveCard,
      restoreCard,
      clearArchived,
      getArchivedCount,
    }}>
      {children}
    </CardArchiveContext.Provider>
  );
}

export function useCardArchive() {
  const context = useContext(CardArchiveContext);
  if (!context) {
    throw new Error('useCardArchive must be used within a CardArchiveProvider');
  }
  return context;
}