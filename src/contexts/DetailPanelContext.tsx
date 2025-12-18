'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Campaign, AdGroup, Keyword } from '@/types/campaign';

type EntityType = 'campaign' | 'adGroup' | 'keyword';

interface DetailPanelContextType {
  isOpen: boolean;
  entity: Campaign | AdGroup | Keyword | null;
  entityType: EntityType;
  openPanel: (entity: Campaign | AdGroup | Keyword, type: EntityType) => void;
  closePanel: () => void;
}

const DetailPanelContext = createContext<DetailPanelContextType | undefined>(undefined);

export function DetailPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [entity, setEntity] = useState<Campaign | AdGroup | Keyword | null>(null);
  const [entityType, setEntityType] = useState<EntityType>('campaign');

  const openPanel = useCallback((newEntity: Campaign | AdGroup | Keyword, type: EntityType) => {
    setEntity(newEntity);
    setEntityType(type);
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    // Delay clearing entity to allow for close animation
    setTimeout(() => {
      setEntity(null);
    }, 300);
  }, []);

  return (
    <DetailPanelContext.Provider
      value={{
        isOpen,
        entity,
        entityType,
        openPanel,
        closePanel,
      }}
    >
      {children}
    </DetailPanelContext.Provider>
  );
}

export function useDetailPanel() {
  const context = useContext(DetailPanelContext);
  if (context === undefined) {
    throw new Error('useDetailPanel must be used within a DetailPanelProvider');
  }
  return context;
}
