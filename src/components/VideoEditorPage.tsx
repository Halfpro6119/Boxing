import { useEffect, useRef, useState, useCallback } from 'react';
import { formatDuration } from '../context/RecordingContext';
import TrimTimeline from './TrimTimeline';
import { trimVideo } from '../utils/trimVideo';
import { preloadFFmpeg } from '../utils/ffmpeg';

interface VideoEditorPageProps {
  blob: Blob | null;
  duration: number;
  onBack: () => void;
}

export default function VideoEditorPage({ blob: propBlob, duration: propDuration, onBack }: VideoEditorPageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localBlob, setLocalBlob] = useState<Blob | null>(null);
  const [useLocal, setUseLocal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [startSeconds, setStartSeconds] = useState(0);
  const [endSeconds, setEndSeconds] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);

  const effectiveBlob = useLocal ? localBlob : propBlob;
  const effectiveDuration = videoDuration > 0 ? videoDuration : propDuration;

  // Preload FFmpeg when editor mounts
  useEffect(() => {
    preloadFFmpeg().catch(() => {});
  }, []);

  useEffect(() => {
    if (!effectiveBlob || effectiveBlob.size === 0) {
      setPreviewUrl(null);
      setError(useLocal && !localBlob ? null : 'No recording to play.');
      return;
    }
    setError(null);
    const url = URL.createObjectURL(effectiveBlob);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setPreviewUrl(null);
    };
  }, [effectiveBlob, useLocal, localBlob]);

  // Reset trim range when duration changes
  useEffect(() => {
    if (effectiveDuration > 0) {
      setStartSeconds(0);
      setEndSeconds(effectiveDuration);
    }
  }, [effectiveDuration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => {
      const d = video.duration;
      if (isFinite(d) && d > 0) {
        setVideoDuration(d);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      video.currentTime = startSeconds;
      if (startSeconds < endSeconds - 0.1) {
        video.play().catch(() => {});
      }
    };
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
  }, [previewUrl, startSeconds, endSeconds]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (currentTime < startSeconds || currentTime >= endSeconds - 0.1) {
        video.currentTime = startSeconds;
      }
      video.play().catch(() => setError('Playback failed'));
    } else {
      video.pause();
    }
  }, [currentTime, startSeconds, endSeconds]);

  const handleSeek = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;
      const t = Math.max(0, Math.min(effectiveDuration, time));
      video.currentTime = t;
      setCurrentTime(t);
    },
    [effectiveDuration]
  );

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file (MP4, WebM, MOV, etc.)');
      return;
    }
    setError(null);
    setLocalBlob(file);
    setUseLocal(true);
    e.target.value = '';
  }, []);

  const handleUploadDifferent = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleExport = useCallback(async () => {
    if (!effectiveBlob || effectiveBlob.size === 0) return;
    const start = Math.max(0, Math.min(startSeconds, effectiveDuration - 0.5));
    const end = Math.min(effectiveDuration, Math.max(endSeconds, start + 0.5));
    if (start >= end) {
      setExportError('Invalid trim range. Start must be before end.');
      return;
    }
    setExporting(true);
    setExportError(null);
    setExportProgress(0);
    try {
      const trimmed = await trimVideo(effectiveBlob, start, end, (p) => {
        setExportProgress(Math.round((p.progress ?? 0) * 100));
      });
      const url = URL.createObjectURL(trimmed);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boxing-trimmed-${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, [effectiveBlob, startSeconds, endSeconds, effectiveDuration]);

  const displayDuration = effectiveDuration;
  const displayCurrent = previewUrl ? currentTime : 0;
  const trimmedDuration = Math.max(0, endSeconds - startSeconds);
  const hasTrim = startSeconds > 0.1 || endSeconds < effectiveDuration - 0.1;

  // No video: show upload or recording prompt
  if (!effectiveBlob) {
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
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleUpload}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full max-w-md border-2 border-dashed border-slate-500 rounded-xl p-12 text-center cursor-pointer hover:border-accent hover:bg-slate-800/30 transition-all mb-6"
          >
            <div className="text-5xl mb-4">📹</div>
            <p className="text-slate-300 mb-1">Click to upload a video</p>
            <p className="text-slate-500 text-sm">MP4, WebM, MOV supported</p>
          </div>
          <h2 className="text-xl font-medium text-white mb-2">Or record first</h2>
          <p className="text-slate-400 text-sm mb-6">
            Record in Recording Mode, then choose &quot;Open in Video Editor&quot; when done.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 rounded-lg bg-slate-600 text-slate-200 hover:bg-slate-500 transition-colors"
          >
            Go to Recording Mode
          </button>
          {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="font-display text-3xl tracking-wider text-white">VIDEO EDITOR</h1>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleUploadDifferent}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm"
          >
            Upload different
          </button>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            ← Back
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full">
        <div className="rounded-xl border-2 border-slate-600 bg-black overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 flex items-center justify-center p-4">
            {previewUrl ? (
              <video
                ref={videoRef}
                src={previewUrl}
                playsInline
                preload="auto"
                onError={() => setError('Video failed to load')}
                className="w-full h-full max-h-[60vh] object-contain"
              />
            ) : (
              <div className="text-slate-500">Loading preview...</div>
            )}
          </div>
          {error && (
            <p className="text-red-400 text-sm px-4 py-2 bg-red-900/20">{error}</p>
          )}
          {previewUrl && (
            <div className="shrink-0 p-4 bg-slate-900/80 border-t border-slate-600 space-y-4">
              {/* Playback controls */}
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
                  {hasTrim && (
                    <span className="ml-2 text-emerald-400">
                      (trim: {formatDuration(Math.floor(trimmedDuration))})
                    </span>
                  )}
                </span>
                <input
                  type="range"
                  min={0}
                  max={displayDuration || 1}
                  step={0.1}
                  value={displayCurrent}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  className="flex-1 min-w-[120px] h-2 rounded-lg appearance-none bg-slate-600 accent-ring"
                />
              </div>

              {/* Trim timeline */}
              <TrimTimeline
                duration={displayDuration}
                startSeconds={startSeconds}
                endSeconds={endSeconds}
                currentTime={displayCurrent}
                onStartChange={setStartSeconds}
                onEndChange={setEndSeconds}
                onSeek={handleSeek}
                disabled={exporting}
              />

              {/* Export */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {exporting ? (
                    <>Exporting... {exportProgress}%</>
                  ) : hasTrim ? (
                    'Export Trimmed Video'
                  ) : (
                    'Export Video (MP4)'
                  )}
                </button>
                {exportError && (
                  <p className="text-red-400 text-sm">{exportError}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
