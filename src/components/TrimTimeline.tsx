import { formatDuration } from '../context/RecordingContext';
import { useCallback, useEffect, useRef, useState } from 'react';

interface TrimTimelineProps {
  duration: number;
  startSeconds: number;
  endSeconds: number;
  currentTime: number;
  onStartChange: (start: number) => void;
  onEndChange: (end: number) => void;
  onSeek: (time: number) => void;
  disabled?: boolean;
}

const MIN_TRIM_DURATION = 0.5;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function TrimTimeline({
  duration,
  startSeconds,
  endSeconds,
  currentTime,
  onStartChange,
  onEndChange,
  onSeek,
  disabled = false,
}: TrimTimelineProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  const timeToPercent = useCallback(
    (t: number) => (duration > 0 ? clamp((t / duration) * 100, 0, 100) : 0),
    [duration]
  );
  const percentToTime = useCallback(
    (p: number) => clamp((p / 100) * duration, 0, duration),
    [duration]
  );

  const handleRailClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !railRef.current) return;
    const rect = railRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x / rect.width) * 100;
    const time = percentToTime(pct);
    onSeek(time);
  };

  const handleDragStart = (which: 'start' | 'end') => (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    setDragging(which);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !railRef.current) return;
      const rect = railRef.current.getBoundingClientRect();
      const x = clamp(e.clientX - rect.left, 0, rect.width);
      const pct = (x / rect.width) * 100;
      const time = percentToTime(pct);
      if (dragging === 'start') {
        const newStart = clamp(time, 0, endSeconds - MIN_TRIM_DURATION);
        onStartChange(newStart);
      } else {
        const newEnd = clamp(time, startSeconds + MIN_TRIM_DURATION, duration);
        onEndChange(newEnd);
      }
    },
    [dragging, duration, startSeconds, endSeconds, percentToTime, onStartChange, onEndChange]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      const step = e.shiftKey ? 1 : 0.1;
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const newStart = clamp(startSeconds - step, 0, endSeconds - MIN_TRIM_DURATION);
        onStartChange(newStart);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newEnd = clamp(endSeconds + step, startSeconds + MIN_TRIM_DURATION, duration);
        onEndChange(newEnd);
      }
    },
    [disabled, startSeconds, endSeconds, duration, onStartChange, onEndChange]
  );

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  const startPct = timeToPercent(startSeconds);
  const endPct = timeToPercent(endSeconds);
  const currentPct = timeToPercent(currentTime);
  const trimmedDuration = endSeconds - startSeconds;

  const formatTimeInput = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const secInt = Math.floor(sec);
    const secFrac = Math.round((sec - secInt) * 10);
    return `${m}:${secInt.toString().padStart(2, '0')}.${secFrac}`;
  };

  const parseTimeInput = (v: string): number | null => {
    const parts = v.trim().split(':');
    if (parts.length === 1) {
      const n = parseFloat(parts[0]);
      return isNaN(n) ? null : clamp(n, 0, duration);
    }
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const s = parseFloat(parts[1]);
      if (isNaN(m) || isNaN(s)) return null;
      return clamp(m * 60 + s, 0, duration);
    }
    return null;
  };

  return (
    <div className="space-y-2" onKeyDown={handleKeyDown}>
      <div
        ref={railRef}
        role="slider"
        aria-label="Trim timeline"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        tabIndex={0}
        onClick={handleRailClick}
        className={`relative h-10 rounded-lg bg-slate-800 cursor-pointer select-none overflow-hidden ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {/* Dimmed left (before start) */}
        <div
          className="absolute inset-y-0 left-0 bg-slate-700/70"
          style={{ width: `${startPct}%` }}
        />
        {/* Dimmed right (after end) */}
        <div
          className="absolute inset-y-0 right-0 bg-slate-700/70"
          style={{ width: `${100 - endPct}%` }}
        />
        {/* Keep range highlight */}
        <div
          className="absolute inset-y-0 bg-emerald-600/30"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
          style={{ left: `${currentPct}%` }}
        />
        {/* Start handle */}
        <div
          role="button"
          aria-label="Trim start"
          onMouseDown={handleDragStart('start')}
          className="absolute top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center z-20 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400"
          style={{ left: `${startPct}%`, transform: 'translateX(-50%)' }}
        >
          <div className="w-1 h-4 bg-white/90 rounded" />
        </div>
        {/* End handle */}
        <div
          role="button"
          aria-label="Trim end"
          onMouseDown={handleDragStart('end')}
          className="absolute top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center z-20 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400"
          style={{ left: `${endPct}%`, transform: 'translateX(-50%)' }}
        >
          <div className="w-1 h-4 bg-white/90 rounded" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-slate-400">
          Trim: <span className="text-emerald-400 font-medium">{formatDuration(Math.floor(trimmedDuration))}</span>
        </span>
        <label className="flex items-center gap-2 text-slate-400">
          Start
          <input
            type="text"
            value={formatTimeInput(startSeconds)}
            onChange={(e) => {
              const t = parseTimeInput(e.target.value);
              if (t != null) onStartChange(clamp(t, 0, endSeconds - MIN_TRIM_DURATION));
            }}
            onBlur={(e) => {
              const t = parseTimeInput(e.target.value);
              if (t != null) onStartChange(clamp(t, 0, endSeconds - MIN_TRIM_DURATION));
            }}
            disabled={disabled}
            className="w-16 px-2 py-1 rounded bg-slate-800 border border-slate-600 text-white font-mono text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-slate-400">
          End
          <input
            type="text"
            value={formatTimeInput(endSeconds)}
            onChange={(e) => {
              const t = parseTimeInput(e.target.value);
              if (t != null) onEndChange(clamp(t, startSeconds + MIN_TRIM_DURATION, duration));
            }}
            onBlur={(e) => {
              const t = parseTimeInput(e.target.value);
              if (t != null) onEndChange(clamp(t, startSeconds + MIN_TRIM_DURATION, duration));
            }}
            disabled={disabled}
            className="w-16 px-2 py-1 rounded bg-slate-800 border border-slate-600 text-white font-mono text-sm"
          />
        </label>
        <span className="text-slate-500 text-xs">
          Full: {formatDuration(Math.floor(duration))}
        </span>
      </div>
    </div>
  );
}
