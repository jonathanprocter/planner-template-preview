import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export interface Action {
  type: 'update' | 'delete' | 'create' | 'status_change';
  timestamp: Date;
  data: any;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  description: string;
}

export function useUndoRedo() {
  const [history, setHistory] = useState<Action[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const addAction = useCallback((action: Action) => {
    setHistory(prev => {
      // Remove any actions after current index (they were undone)
      const newHistory = prev.slice(0, currentIndex + 1);
      // Add new action
      newHistory.push(action);
      // Keep only last 50 actions
      if (newHistory.length > 50) {
        newHistory.shift();
        setCurrentIndex(prev => prev);
        return newHistory;
      }
      setCurrentIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [currentIndex]);

  const undo = useCallback(async () => {
    if (currentIndex < 0) {
      toast.info('Nothing to undo');
      return;
    }

    const action = history[currentIndex];
    if (!action) {
      toast.error('Action not found');
      return;
    }
    try {
      await action.undo();
      setCurrentIndex(prev => prev - 1);
      toast.success(`Undone: ${action.description}`);
    } catch (error) {
      toast.error('Failed to undo action');
      console.error('Undo error:', error);
    }
  }, [currentIndex, history]);

  const redo = useCallback(async () => {
    if (currentIndex >= history.length - 1) {
      toast.info('Nothing to redo');
      return;
    }

    const action = history[currentIndex + 1];
    if (!action) {
      toast.error('Action not found');
      return;
    }
    try {
      await action.redo();
      setCurrentIndex(prev => prev + 1);
      toast.success(`Redone: ${action.description}`);
    } catch (error) {
      toast.error('Failed to redo action');
      console.error('Redo error:', error);
    }
  }, [currentIndex, history]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const canUndo = currentIndex >= 0;
  const canRedo = currentIndex < history.length - 1;

  return {
    addAction,
    undo,
    redo,
    canUndo,
    canRedo,
    history,
    currentIndex,
  };
}
