import { useRecording, formatDuration } from '../context/RecordingContext';

export default function RecordingToolbar() {
  const { recording } = useRecording();
  const { status, duration, pauseRecording, resumeRecording, stopRecording } = recording;

  if (status !== 'recording' && status !== 'paused') return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]">
      <div className="rounded-xl border border-slate-600/50 bg-slate-900/95 backdrop-blur-sm shadow-xl px-5 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              status === 'paused' ? 'bg-amber-500' : 'bg-red-500 animate-pulse'
            }`}
          />
          <span className="text-white font-medium">
            {status === 'paused' ? 'Paused' : 'Recording'}
          </span>
        </div>
        <span className="text-slate-400 font-mono tabular-nums text-lg">
          {formatDuration(duration)}
        </span>
        <div className="h-4 w-px bg-slate-600" />
        {status === 'recording' && (
          <button
            type="button"
            onClick={pauseRecording}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 transition-colors flex items-center gap-2"
          >
            <span>⏸</span> Pause
          </button>
        )}
        {status === 'paused' && (
          <button
            type="button"
            onClick={resumeRecording}
            className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-500 transition-colors flex items-center gap-2"
          >
            <span>▶</span> Resume
          </button>
        )}
        <button
          type="button"
          onClick={stopRecording}
          className="px-4 py-2 rounded-lg bg-red-900/80 text-white font-medium hover:bg-red-800 border border-red-500/50 transition-colors flex items-center gap-2"
        >
          <span>⏹</span> End
        </button>
      </div>
    </div>
  );
}
