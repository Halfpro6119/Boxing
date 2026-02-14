import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type RecordingStatus = 'idle' | 'connecting' | 'recording' | 'paused' | 'stopped';

export interface RecordingState {
  status: RecordingStatus;
  duration: number;
  blob: Blob | null;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
}

const defaultState: RecordingState = {
  status: 'idle',
  duration: 0,
  blob: null,
  pauseRecording: () => {},
  resumeRecording: () => {},
  stopRecording: () => {},
};

const RecordingContext = createContext<{
  recording: RecordingState;
  setRecording: (state: Partial<RecordingState>) => void;
  dismissRecording: () => void;
  openInAnalyzerBlob: Blob | null;
  openRecordingInAnalyzer: (blob: Blob) => void;
  clearOpenInAnalyzer: () => void;
}>({
  recording: defaultState,
  setRecording: () => {},
  dismissRecording: () => {},
  openInAnalyzerBlob: null,
  openRecordingInAnalyzer: () => {},
  clearOpenInAnalyzer: () => {},
});

export function RecordingProvider({ children }: { children: ReactNode }) {
  const [recording, setRecordingState] = useState<RecordingState>(defaultState);
  const [openInAnalyzerBlob, setOpenInAnalyzerBlob] = useState<Blob | null>(null);

  const setRecording = useCallback((state: Partial<RecordingState>) => {
    setRecordingState((prev) => ({ ...prev, ...state }));
  }, []);

  const dismissRecording = useCallback(() => {
    setRecordingState(defaultState);
  }, []);

  const openRecordingInAnalyzer = useCallback((blob: Blob) => {
    setOpenInAnalyzerBlob(blob);
  }, []);

  const clearOpenInAnalyzer = useCallback(() => {
    setOpenInAnalyzerBlob(null);
  }, []);

  return (
    <RecordingContext.Provider
      value={{
        recording,
        setRecording,
        dismissRecording,
        openInAnalyzerBlob,
        openRecordingInAnalyzer,
        clearOpenInAnalyzer,
      }}
    >
      {children}
    </RecordingContext.Provider>
  );
}

export function useRecording() {
  return useContext(RecordingContext);
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
