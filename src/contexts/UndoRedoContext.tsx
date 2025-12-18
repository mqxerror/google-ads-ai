'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

interface UndoableAction {
  id: string;
  description: string;
  timestamp: Date;
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
}

interface UndoRedoContextType {
  canUndo: boolean;
  canRedo: boolean;
  undoStack: UndoableAction[];
  redoStack: UndoableAction[];
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  pushAction: (action: Omit<UndoableAction, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  lastAction: UndoableAction | null;
}

const UndoRedoContext = createContext<UndoRedoContextType | undefined>(undefined);

const MAX_UNDO_STACK = 50;
let actionId = 0;

export function UndoRedoProvider({ children }: { children: ReactNode }) {
  const [undoStack, setUndoStack] = useState<UndoableAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoableAction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const canUndo = undoStack.length > 0 && !isProcessing;
  const canRedo = redoStack.length > 0 && !isProcessing;
  const lastAction = undoStack[undoStack.length - 1] || null;

  const pushAction = useCallback((action: Omit<UndoableAction, 'id' | 'timestamp'>) => {
    const newAction: UndoableAction = {
      ...action,
      id: `action-${++actionId}`,
      timestamp: new Date(),
    };

    setUndoStack((prev) => {
      const newStack = [...prev, newAction];
      // Keep stack size limited
      if (newStack.length > MAX_UNDO_STACK) {
        return newStack.slice(-MAX_UNDO_STACK);
      }
      return newStack;
    });

    // Clear redo stack when new action is performed
    setRedoStack([]);
  }, []);

  const undo = useCallback(async () => {
    if (!canUndo) return;

    const action = undoStack[undoStack.length - 1];
    if (!action) return;

    setIsProcessing(true);
    try {
      await action.undo();

      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, action]);
    } catch (error) {
      console.error('Undo failed:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [canUndo, undoStack]);

  const redo = useCallback(async () => {
    if (!canRedo) return;

    const action = redoStack[redoStack.length - 1];
    if (!action) return;

    setIsProcessing(true);
    try {
      await action.redo();

      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, action]);
    } catch (error) {
      console.error('Redo failed:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [canRedo, redoStack]);

  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Z for undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Cmd/Ctrl + Shift + Z for redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      // Cmd/Ctrl + Y for redo (alternative)
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <UndoRedoContext.Provider
      value={{
        canUndo,
        canRedo,
        undoStack,
        redoStack,
        undo,
        redo,
        pushAction,
        clearHistory,
        lastAction,
      }}
    >
      {children}
    </UndoRedoContext.Provider>
  );
}

export function useUndoRedo() {
  const context = useContext(UndoRedoContext);
  if (!context) {
    throw new Error('useUndoRedo must be used within an UndoRedoProvider');
  }
  return context;
}
