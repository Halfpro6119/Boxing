import { useEffect, useRef, useState } from 'react';
import { formatDuration } from '../context/RecordingContext';

interface VideoEditorPageProps {
  blob: Blob | null;
  duration: number;
  onBack: () => void;
}

export default function VideoEditorPage({ blob, duration, onBack }: VideoEditorPageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  useEffect(() => {
    if (!blob || blob.size === 0) {
      setPreviewUrl(null);
      setError('No recording to play.');
      return;
    }
    setError(null);
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setPreviewUrl(null);
    };
  }, [blob]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setVideoDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, [previewUrl]);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => setError('Playback failed'));
    } else {
      video.pause();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const value = Number(e.target.value);
    if (!video || !isFinite(value)) return;
    video.currentTime = value;
    setCurrentTime(value);
  };

  const displayDuration = videoDuration > 0 ? videoDuration : duration;
  const displayCurrent = previewUrl ? currentTime : 0;

  if (!blob) {
    return (
      <div className="min-h-screen flex flex-col p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-display text-3xl tracking-wider text-white">VIDEO EDITOR</h1>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            ← Back
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-slate-700/50 flex items-center justify-center mb-6">
            <svg
              className="w-10 h-10 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-white mb-2">No recording to edit</h2>
          <p className="text-slate-400 text-sm mb-6">
            Record a video in Recording Mode, then when you finish choose &quot;Open in Video Editor&quot;
            to view and edit it here.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 rounded-lg bg-ring text-white font-medium hover:bg-red-600 transition-colors"
          >
            Go to Recording Mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-3xl tracking-wider text-white">VIDEO EDITOR</h1>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
        >
          ← Back
        </button>
      </div>

      <p className="text-slate-400 mb-4">
        Preview your recording. Duration: {formatDuration(Math.floor(displayDuration))}
      </p>

      <div className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full">
        <div className="rounded-xl border-2 border-slate-600 bg-black overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 flex items-center justify-center p-4">
            {previewUrl ? (
              <video
                ref={videoRef}
                src={previewUrl}
                controls
                playsInline
                preload="auto"
                onError={() => setError('Video failed to load')}
                className="w-full h-full max-h-[70vh] object-contain"
              />
            ) : (
              <div className="text-slate-500">Loading preview...</div>
            )}
          </div>
          {error && (
            <p className="text-red-400 text-sm px-4 py-2 bg-red-900/20">{error}</p>
          )}
          {previewUrl && (
            <div className="shrink-0 p-4 bg-slate-900/80 border-t border-slate-600">
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 font-medium flex items-center gap-2"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <>
                      <span>⏸</span> Pause
                    </>
                  ) : (
                    <>
                      <span>▶</span> Play
                    </>
                  )}
                </button>
                <span className="text-slate-400 font-mono tabular-nums text-sm">
                  {formatDuration(Math.floor(displayCurrent))} / {formatDuration(Math.floor(displayDuration))}
                </span>
                <div className="flex-1 min-w-[200px] flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={displayDuration || 1}
                    step={0.1}
                    value={displayCurrent}
                    onChange={handleSeek}
                    className="flex-1 h-2 rounded-lg appearance-none bg-slate-600 accent-ring"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
