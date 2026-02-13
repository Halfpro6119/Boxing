import { useState, useEffect } from 'react';

interface VideoControlsProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  isYouTube?: boolean;
  isMuted?: boolean;
  onUnmute?: () => void;
}

function formatTime(sec: number) {
  if (!isFinite(sec) || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoControls({
  currentTime,
  duration,
  isPlaying,
  onPlayPause,
  onSeek,
  isYouTube,
  isMuted,
  onUnmute,
  playbackRate = 1,
  onPlaybackRateChange,
}: VideoControlsProps) {
  const [inputValue, setInputValue] = useState(String(playbackRate));
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    if (!isInputFocused) {
      setInputValue(String(playbackRate));
    }
  }, [playbackRate, isInputFocused]);

  const clampedRate = (r: number) =>
    Math.max(0.25, Math.min(4, Math.round(r * 100) / 100));

  const handleSpeedChange = (rate: number) => {
    const r = clampedRate(rate);
    onPlaybackRateChange?.(r);
    setInputValue(String(r));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
    const parsed = parseFloat(inputValue);
    if (!Number.isNaN(parsed)) {
      handleSpeedChange(parsed);
    } else {
      setInputValue(String(playbackRate));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-slate-900/95 rounded-b-lg">
      <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onPlayPause}
        className="w-10 h-10 rounded-full bg-ring flex items-center justify-center hover:bg-red-600 transition-colors"
      >
        {isPlaying ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      {isYouTube && isMuted && onUnmute && (
        <button
          type="button"
          onClick={onUnmute}
          className="p-2 rounded-lg bg-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-600 transition-colors"
          title="Unmute"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
          </svg>
        </button>
      )}
      <span className="text-slate-400 text-sm tabular-nums">{formatTime(currentTime)}</span>
      <div className="flex-1 relative group">
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none bg-slate-700 cursor-pointer accent-ring"
        />
      </div>
      <span className="text-slate-400 text-sm tabular-nums">{formatTime(duration)}</span>
      </div>
      {onPlaybackRateChange && (
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm shrink-0">Speed</span>
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.05}
            value={playbackRate}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            className="flex-1 min-w-0 h-2 rounded-full appearance-none bg-slate-700 cursor-pointer accent-ring"
          />
          <input
            type="number"
            min={0.25}
            max={4}
            step={0.05}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setIsInputFocused(true)}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className="w-16 px-2 py-1 text-sm rounded bg-slate-700 text-slate-200 border border-slate-600 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
          />
          <span className="text-slate-500 text-sm shrink-0">×</span>
        </div>
      )}
    </div>
  );
}
