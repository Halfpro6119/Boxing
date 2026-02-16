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
    if (isRecording) {
      if (!window.confirm('This will stop your current recording. Continue?')) return;
      recording.stopRecording();
    }
    const ok = (await workspaceRef.current?.confirmLeave()) ?? true;
    if (ok) setMode('recording');
  };

  const handleSwitchToAnalyzer = async () => {
    if (isRecording) {
      if (!window.confirm('This will stop your current recording. Continue?')) return;
      recording.stopRecording();
    }
    const ok = (await workspaceRef.current?.confirmLeave()) ?? true;
    if (ok) setMode('analyzer');
  };

  const handleSwitchToEditor = () => {
    if (isRecording) {
      if (!window.confirm('This will stop your current recording. Continue?')) return;
      recording.stopRecording();
    }
    setMode('editor');
  };

  const handleBackFromRecording = () => {
    if (isRecording) {
      if (!window.confirm('This will stop your current recording. Continue?')) return;
      recording.stopRecording();
    }
    setMode('analyzer');
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
    setCompleteRecording(null);
    setMode('editor');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="shrink-0 px-6 py-4 border-b border-slate-700/50 bg-slate-900/50">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleSwitchToAnalyzer}
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
            onClick={handleSwitchToEditor}
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
          <div key="recording-container" className="min-h-full">
            <RecordingMode
              key="recording-mode"
              onBack={handleBackFromRecording}
              onRecordingComplete={handleRecordingComplete}
            />
          </div>
        )}
        {mode === 'analyzer' && !isRecording && (
          <VideoPlayerWorkspace
            ref={workspaceRef}
            initialRecordingBlob={openInAnalyzerBlob}
            onRecordingConsumed={clearOpenInAnalyzer}
          />
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
