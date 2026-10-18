'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { COMPONENT_REGISTRY } from '../componentRegistry';
import { TwinComponentDefinition } from '@/lib/simulator/types';

interface SelectionContextType {
  selectedComponentId: string | null;
  hoveredComponentId: string | null;
  selectedComponent: TwinComponentDefinition | null;
  hoveredComponent: TwinComponentDefinition | null;
  selectComponent: (id: string | null) => void;
  setHoveredComponent: (id: string | null) => void;
  clearSelection: () => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(null);

  const selectComponent = useCallback((id: string | null) => {
    setSelectedComponentId(id);
  }, []);

  const setHoveredComponent = useCallback((id: string | null) => {
    setHoveredComponentId(id);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedComponentId(null);
  }, []);

  const selectedComponent = useMemo(() => {
    return selectedComponentId ? COMPONENT_REGISTRY[selectedComponentId] || null : null;
  }, [selectedComponentId]);

  const hoveredComponent = useMemo(() => {
    return hoveredComponentId ? COMPONENT_REGISTRY[hoveredComponentId] || null : null;
  }, [hoveredComponentId]);

  const value = useMemo(
    () => ({
      selectedComponentId,
      hoveredComponentId,
      selectedComponent,
      hoveredComponent,
      selectComponent,
      setHoveredComponent,
      clearSelection,
    }),
    [
      selectedComponentId,
      hoveredComponentId,
      selectedComponent,
      hoveredComponent,
      selectComponent,
      setHoveredComponent,
      clearSelection,
    ]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionContextType {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
}
