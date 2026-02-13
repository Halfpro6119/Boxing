import { useState, useRef } from 'react';
import VideoPlayerWorkspace, { type VideoPlayerWorkspaceHandle } from './components/VideoPlayerWorkspace';
import RecordingMode from './components/RecordingMode';

export default function App() {
  const [mode, setMode] = useState<'analyzer' | 'recording'>('analyzer');
  const workspaceRef = useRef<VideoPlayerWorkspaceHandle>(null);

  const handleSwitchToRecording = async () => {
    const ok = await workspaceRef.current?.confirmLeave() ?? true;
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
              mode === 'analyzer'
                ? 'bg-ring text-white'
                : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600'
            }`}
          >
            Video Analyzer
          </button>
          <button
            type="button"
            onClick={handleSwitchToRecording}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              mode === 'recording'
                ? 'bg-ring text-white'
                : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600'
            }`}
          >
            Recording Mode
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0">
      {mode === 'analyzer' ? (
        <VideoPlayerWorkspace ref={workspaceRef} />
      ) : (
        <RecordingMode onBack={() => setMode('analyzer')} />
      )}
      </main>
    </div>
  );
}
