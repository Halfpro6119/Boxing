import { useRef, useEffect, useMemo } from 'react';
import { useRecording, formatDuration } from '../context/RecordingContext';

interface RecordingCompletePageProps {
  onClose: () => void;
}

export default function RecordingCompletePage({ onClose }: RecordingCompletePageProps) {
  const { recording, dismissRecording } = useRecording();
  const { blob, duration } = recording;
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!blob) return null;

  const handleClose = () => {
    dismissRecording();
    onClose();
  };

  const handleDownload = () => {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boxing-recording-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const videoUrl = useMemo(() => URL.createObjectURL(blob), [blob]);

  useEffect(() => {
    return () => URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/98 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-0">
        <h2 className="text-2xl font-display tracking-wider text-white mb-2">
          Recording Complete
        </h2>
        <p className="text-slate-400 mb-6">Duration: {formatDuration(duration)}</p>

        <div className="w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden border border-slate-600 mb-6">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDownload}
            className="px-6 py-3 rounded-lg bg-accent text-slate-900 font-medium hover:bg-orange-400 transition-colors"
          >
            Download Recording
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-3 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
