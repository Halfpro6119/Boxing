import { useState, useRef, useCallback, useEffect } from 'react';
import VideoPlayerWorkspace, { type VideoPlayerWorkspaceHandle } from './components/VideoPlayerWorkspace';
import RecordingMode from './components/RecordingMode';
import RecordingToolbar from './components/RecordingToolbar';
import RecordingCompletePage from './components/RecordingCompletePage';
import VideoEditorPage from './components/VideoEditorPage';
import { RecordingProvider, useRecording } from './context/RecordingContext';

type CompleteRecording = { blob: Blob; duration: number };

function AppContent() {
  const [mode, setMode] = useState<'analyzer' | 'recording' | 'editor'>('analyzer');
  const [completeRecording, setCompleteRecording] = useState<CompleteRecording | null>(null);
  const workspaceRef = useRef<VideoPlayerWorkspaceHandle>(null);
  const {
    recording,
    openInAnalyzerBlob,
    openRecordingInAnalyzer,
    clearOpenInAnalyzer,
    dismissRecording,
  } = useRecording();
  const isRecording = recording.status === 'recording' || recording.status === 'paused';
  const showCompletePage = completeRecording !== null;

  const handleRecordingComplete = useCallback((blob: Blob, duration: number) => {
    setCompleteRecording({ blob, duration });
  }, []);

  // Fallback: show complete page when context has stopped + blob (in case callback didn't run)
  useEffect(() => {
    if (
      recording.status === 'stopped' &&
      recording.blob &&
      recording.blob.size > 0 &&
      completeRecording === null
    ) {
      setCompleteRecording({
        blob: recording.blob,
        duration: recording.duration,
      });
    }
  }, [recording.status, recording.blob, recording.duration, completeRecording]);

  const handleSwitchToRecording = async () => {
    const ok = (await workspaceRef.current?.confirmLeave()) ?? true;
    if (ok) setMode('recording');
  };

  const handleOpenInAnalyzer = (blob: Blob) => {
    openRecordingInAnalyzer(blob);
    dismissRecording();
    setCompleteRecording(null);
    setMode('analyzer');
  };

  const handleCloseCompletePage = () => {
    setCompleteRecording(null);
    setMode('recording');
  };

  const handleOpenInEditor = () => {
    setMode('editor');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="shrink-0 px-6 py-4 border-b border-slate-700/50 bg-slate-900/50">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('analyzer')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              mode === 'analyzer' ? 'bg-ring text-white' : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600'
            }`}
          >
            Video Analyzer
          </button>
          <button
            type="button"
            onClick={handleSwitchToRecording}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              mode === 'recording' ? 'bg-ring text-white' : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600'
            }`}
          >
            Recording Mode
          </button>
          <button
            type="button"
            onClick={() => setMode('editor')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              mode === 'editor' ? 'bg-ring text-white' : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600'
            }`}
          >
            Video Editor
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 relative">
        {(mode === 'recording' || isRecording) && (
          <div
            key="recording-container"
            className={
              isRecording
                ? 'absolute inset-0 w-px h-px overflow-hidden opacity-0 pointer-events-none -z-10'
                : 'min-h-full'
            }
            aria-hidden={isRecording}
          >
            <RecordingMode
              key="recording-mode"
              onBack={() => setMode('analyzer')}
              hidden={isRecording}
              onRecordingComplete={handleRecordingComplete}
            />
          </div>
        )}
        {mode === 'analyzer' && (
          <VideoPlayerWorkspace
            ref={workspaceRef}
            initialRecordingBlob={openInAnalyzerBlob}
            onRecordingConsumed={clearOpenInAnalyzer}
          />
        )}
        {mode === 'recording' && isRecording && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <p className="text-slate-400 mb-2">Recording in progress</p>
            <p className="text-slate-500 text-sm mb-4">
              Use the floating toolbar to pause or end.
            </p>
            <button
              type="button"
              onClick={() => setMode('analyzer')}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              Switch to Video Analyzer
            </button>
          </div>
        )}
        {mode === 'editor' && (
          <VideoEditorPage
            blob={completeRecording?.blob ?? recording.blob}
            duration={completeRecording?.duration ?? recording.duration}
            onBack={() => setMode('recording')}
          />
        )}
      </main>

      <RecordingToolbar />

      {showCompletePage && (
        <RecordingCompletePage
          blob={completeRecording!.blob}
          duration={completeRecording!.duration}
          onClose={handleCloseCompletePage}
          onOpenInAnalyzer={handleOpenInAnalyzer}
          onOpenInEditor={handleOpenInEditor}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <RecordingProvider>
      <AppContent />
    </RecordingProvider>
  );
}
