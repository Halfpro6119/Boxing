import { useEffect, useRef, useCallback, useState, useImperativeHandle, forwardRef } from 'react';

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  setPlaybackRate?: (rate: number) => void;
  getPlaybackRate?: () => number;
  mute?: () => void;
  unMute?: () => void;
  isMuted?: () => boolean;
  destroy?: () => void;
}

interface YouTubePlayerProps {
  videoId: string;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onStateChange?: (playing: boolean) => void;
  isPaused?: boolean;
  seekTo?: number | null;
  playbackRate?: number;
  className?: string;
}

export interface YouTubePlayerHandle {
  play: () => void;
  pause: () => void;
  isReady: () => boolean;
  unMute: () => void;
  isMuted: () => boolean;
  setPlaybackRate?: (rate: number) => void;
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(function YouTubePlayer({
  videoId,
  onTimeUpdate,
  onStateChange,
  isPaused,
  seekTo,
  playbackRate = 1,
  className = '',
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const pendingPlayRef = useRef<boolean | null>(null);
  const wantPlayingRef = useRef(false);
  const retryCountRef = useRef(0);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onStateChangeRef = useRef(onStateChange);
  onTimeUpdateRef.current = onTimeUpdate;
  onStateChangeRef.current = onStateChange ?? (() => {});

  useEffect(() => {
    setIsReady(false);
    pendingPlayRef.current = null;
    wantPlayingRef.current = false;
    retryCountRef.current = 0;
  }, [videoId]);

  const initPlayer = useCallback(() => {
    if (!containerRef.current || !window.YT?.Player) return;
    setIsReady(false);
    if (playerRef.current?.destroy) playerRef.current.destroy();
    playerRef.current = null;
    if (intervalRef.current) clearInterval(intervalRef.current);
    new window.YT.Player(containerRef.current, {
      height: '100%',
      width: '100%',
      videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 0,
        fs: 1,
        modestbranding: 1,
        rel: 0,
        enablejsapi: 1,
        iv_load_policy: 3,
        playsinline: 1,
        mute: 1,
      },
      events: {
        onReady: (e: { target: YTPlayer }) => {
          playerRef.current = e.target;
          intervalRef.current = window.setInterval(() => {
            if (playerRef.current) {
              const currentTime = playerRef.current.getCurrentTime();
              const duration = playerRef.current.getDuration();
              onTimeUpdateRef.current(currentTime, duration);
            }
          }, 50);
          setIsReady(true);
        },
        onStateChange: (e: { data: number }) => {
          const state = e.data;
          const playing = state === 1 || state === 3;
          const cb = onStateChangeRef.current;
          if (cb) cb(playing);
          if (playing) {
            wantPlayingRef.current = false;
            retryCountRef.current = 0;
          } else if (wantPlayingRef.current && (state === -1 || state === 2) && retryCountRef.current < 5) {
            retryCountRef.current += 1;
            setTimeout(() => {
              if (playerRef.current && wantPlayingRef.current) {
                playerRef.current.playVideo();
              }
            }, 100 * retryCountRef.current);
          }
        },
      },
    });
  }, [videoId]);

  useEffect(() => {
    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      playerRef.current = null;
    };
  }, [videoId, initPlayer]);

  // Store play intent when user clicks before ready
  useEffect(() => {
    if (!isReady && isPaused !== undefined) {
      pendingPlayRef.current = !isPaused;
    }
  }, [isPaused, isReady]);

  // Apply play/pause when player is ready; also handle pending play from before ready
  useEffect(() => {
    if (!isReady) return;
    const p = playerRef.current;
    if (!p) return;

    const shouldPlay = pendingPlayRef.current ?? (isPaused !== undefined && !isPaused);
    if (pendingPlayRef.current !== null) {
      pendingPlayRef.current = null;
    }

    if (shouldPlay) {
      wantPlayingRef.current = true;
      retryCountRef.current = 0;
      p.playVideo();
    } else if (isPaused) {
      p.pauseVideo();
    }
  }, [isReady]);

  useEffect(() => {
    if (!isReady) return;
    const p = playerRef.current;
    if (!p || isPaused === undefined) return;
    if (isPaused) {
      wantPlayingRef.current = false;
      retryCountRef.current = 0;
      p.pauseVideo();
    } else {
      wantPlayingRef.current = true;
      retryCountRef.current = 0;
      p.playVideo();
    }
  }, [isPaused, isReady]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || seekTo == null) return;
    p.seekTo(seekTo);
  }, [seekTo]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || !isReady) return;
    p.setPlaybackRate?.(playbackRate);
  }, [isReady, playbackRate]);

  useImperativeHandle(ref, () => ({
    play: () => {
      wantPlayingRef.current = true;
      retryCountRef.current = 0;
      const p = playerRef.current;
      if (p) p.playVideo();
      else pendingPlayRef.current = true;
    },
    pause: () => {
      wantPlayingRef.current = false;
      retryCountRef.current = 0;
      const p = playerRef.current;
      if (p) p.pauseVideo();
      else pendingPlayRef.current = false;
    },
    isReady: () => isReady,
    unMute: () => {
      const p = playerRef.current;
      if (p?.unMute) p.unMute();
    },
    isMuted: () => {
      const p = playerRef.current;
      return p?.isMuted ? p.isMuted() : true;
    },
    setPlaybackRate: (rate: number) => playerRef.current?.setPlaybackRate?.(rate),
  }), [isReady]);

  return (
    <div
      className={`relative w-full h-full ${className}`}
      style={{ pointerEvents: 'none' }}
    >
      <div
        ref={containerRef}
        className="w-full h-full min-h-[200px]"
        style={{ pointerEvents: 'none' }}
      />
      {!isReady && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-[1]"
          style={{ pointerEvents: 'none' }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-ring border-t-transparent rounded-full animate-spin" />
            <span className="text-slate-400 text-sm">Loading YouTube player...</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default YouTubePlayer;
