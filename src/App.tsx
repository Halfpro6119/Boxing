import { useState, useRef } from 'react';
import VideoPlayerWorkspace, { type VideoPlayerWorkspaceHandle } from './components/VideoPlayerWorkspace';
import RecordingMode from './components/RecordingMode';
import RecordingToolbar from './components/RecordingToolbar';
import RecordingCompletePage from './components/RecordingCompletePage';
import { RecordingProvider, useRecording } from './context/RecordingContext';

function AppContent() {
  const [mode, setMode] = useState<'analyzer' | 'recording'>('analyzer');
  const workspaceRef = useRef<VideoPlayerWorkspaceHandle>(null);
  const { recording } = useRecording();
  const isRecording = recording.status === 'recording' || recording.status === 'paused';
  const showCompletePage = recording.status === 'stopped' && recording.blob;

  const handleSwitchToRecording = async () => {
    const ok = (await workspaceRef.current?.confirmLeave()) ?? true;
    if (ok) setMode('recording');
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
            <RecordingMode key="recording-mode" onBack={() => setMode('analyzer')} hidden={isRecording} />
          </div>
        )}
        {mode === 'analyzer' && (
          <VideoPlayerWorkspace ref={workspaceRef} />
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
      </main>

      <RecordingToolbar />

      {showCompletePage && (
        <RecordingCompletePage onClose={() => setMode('recording')} />
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
