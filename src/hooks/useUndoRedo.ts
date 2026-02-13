import { useState, useCallback } from 'react';
import type { Annotation } from '../types';

const MAX_HISTORY = 50;

export function useUndoRedo(initial: Annotation[] = []) {
  const [history, setHistory] = useState<Annotation[][]>([initial]);
  const [index, setIndex] = useState(0);

  const current = history[index] ?? [];

  const pushState = useCallback((next: Annotation[]) => {
    setHistory((prev) => {
      const truncated = prev.slice(0, index + 1);
      const newHistory = [...truncated, next];
      return newHistory.length > MAX_HISTORY ? newHistory.slice(-MAX_HISTORY) : newHistory;
    });
    setIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [index]);

  const setAnnotations = useCallback((value: Annotation[] | ((prev: Annotation[]) => Annotation[])) => {
    const next = typeof value === 'function' ? value(current) : value;
    pushState(next);
  }, [current, pushState]);

  const undo = useCallback(() => {
    setIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const redo = useCallback(() => {
    setIndex((prev) => (prev < history.length - 1 ? prev + 1 : prev));
  }, [history.length]);

  const canUndo = index > 0;
  const canRedo = index < history.length - 1;

  const reset = useCallback((annotations: Annotation[] = []) => {
    setHistory([annotations]);
    setIndex(0);
  }, []);

  return {
    annotations: current,
    setAnnotations,
    undo,
    redo,
    canUndo,
    canRedo,
    pushState,
    reset,
  };
}
