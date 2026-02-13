import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

function useContainerSize(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = useState({ width: 640, height: 360 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setSize({ width, height });
      }
    });
    observer.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
import VideoUploader, { type VideoLoadOptions } from './VideoUploader';
import VideoControls from './VideoControls';
import AnnotationCanvas from './AnnotationCanvas';
import AnnotationToolbar from './AnnotationToolbar';
import AnnotationList from './AnnotationList';
import YouTubePlayer, { type YouTubePlayerHandle } from './YouTubePlayer';
import type { VideoSource, Annotation, AnnotationType } from '../types';
import { drawAnnotationOnContext } from '../utils/drawAnnotation';
import { getVisibleAnnotations } from '../utils/visibleAnnotations';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { saveVideo, getSavedVideos, getBaseNameAndNextVersion } from '../utils/savedVideos';
import { normalizeAnnotations } from '../utils/annotationCoords';

export interface VideoPlayerWorkspaceHandle {
  confirmLeave: () => Promise<boolean>;
}

const VideoPlayerWorkspace = forwardRef<VideoPlayerWorkspaceHandle>(function VideoPlayerWorkspace(_, ref) {
  const [videoSource, setVideoSource] = useState<VideoSource | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const {
    annotations,
    setAnnotations,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory,
  } = useUndoRedo([]);
  const [activeTool, setActiveTool] = useState<AnnotationType>('arrow');
  const [color, setColor] = useState('#e63946');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [, setVideoLoadError] = useState(false);
  const [youtubeMuted, setYoutubeMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [initialAutoPlay, setInitialAutoPlay] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [saveThenLeave, setSaveThenLeave] = useState(false);
  const leaveResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const pendingLeaveActionRef = useRef<(() => void) | null>(null);
  const lastSavedAnnotationsRef = useRef<Annotation[] | null>(null);
  const savedVideoIdRef = useRef<string | null>(null);
  const saveNameInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubePlayerRef = useRef<YouTubePlayerHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const containerSize = useContainerSize(containerRef);
  const desiredPlayStateRef = useRef(false);
  const videoSourceTypeRef = useRef<VideoSource['type'] | null>(null);
  const pauseDebounceRef = useRef<number | null>(null);

  videoSourceTypeRef.current = videoSource?.type ?? null;

  const enterFullscreen = useCallback(() => {
    const el = fullscreenRef.current;
    if (!el) return;
    desiredPlayStateRef.current =
      videoSourceTypeRef.current === 'file'
        ? !!(videoRef.current && !videoRef.current.paused)
        : videoSourceTypeRef.current === 'youtube'
          ? isPlaying
          : false;
    el.requestFullscreen?.()?.catch(() => {});
  }, [isPlaying]);

  const exitFullscreen = useCallback(() => {
    if (!document.fullscreenElement) return;
    desiredPlayStateRef.current =
      videoSourceTypeRef.current === 'file'
        ? !!(videoRef.current && !videoRef.current.paused)
        : videoSourceTypeRef.current === 'youtube'
          ? isPlaying
          : false;
    document.exitFullscreen?.()?.catch(() => {});
  }, [isPlaying]);

  const resumePlayback = useCallback(() => {
    if (!desiredPlayStateRef.current) return;
    const type = videoSourceTypeRef.current;
    if (type === 'file') {
      const v = videoRef.current;
      if (v?.paused) {
        const playPromise = v.play();
        if (playPromise?.catch) {
          playPromise.catch(() => {
            requestAnimationFrame(() => {
              if (v.paused && desiredPlayStateRef.current) v.play();
            });
          });
        }
      }
    } else if (type === 'youtube') {
      youtubePlayerRef.current?.play();
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const nowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(nowFullscreen);

      if (pauseDebounceRef.current) {
        clearTimeout(pauseDebounceRef.current);
        pauseDebounceRef.current = null;
      }

      setTimeout(resumePlayback, 50);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [resumePlayback]);

  const handlePlayPause = useCallback(() => {
    if (videoSource?.type === 'youtube') {
      const yt = youtubePlayerRef.current;
      if (yt) {
        if (isPlaying) {
          yt.pause();
          setIsPlaying(false);
          desiredPlayStateRef.current = false;
        } else {
          yt.play();
          setIsPlaying(true);
          desiredPlayStateRef.current = true;
        }
      } else {
        const next = !isPlaying;
        setIsPlaying(next);
        desiredPlayStateRef.current = next;
      }
    } else {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) {
        v.play();
        desiredPlayStateRef.current = true;
      } else {
        v.pause();
        desiredPlayStateRef.current = false;
      }
    }
  }, [videoSource?.type, isPlaying]);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (videoSource?.type === 'file') {
      const v = videoRef.current;
      if (v) v.playbackRate = rate;
    } else if (videoSource?.type === 'youtube') {
      youtubePlayerRef.current?.setPlaybackRate?.(rate);
    }
  }, [videoSource?.type]);

  const handleSeek = useCallback((time: number) => {
    if (videoSource?.type === 'youtube') {
      setSeekTo(time);
    } else {
      const v = videoRef.current;
      if (v) v.currentTime = time;
    }
    setCurrentTime(time);
  }, [videoSource?.type]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || videoSource?.type !== 'file') return;
    v.playbackRate = playbackRate;
  }, [videoSource?.type, playbackRate]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || videoSource?.type !== 'file') return;
    const onTimeUpdate = () => setCurrentTime(v.currentTime);
    const onDurationChange = () => setDuration(v.duration);
    const onPlay = () => {
      setIsPlaying(true);
      desiredPlayStateRef.current = true;
      if (pauseDebounceRef.current) {
        clearTimeout(pauseDebounceRef.current);
        pauseDebounceRef.current = null;
      }
    };
    const onPause = () => {
      setIsPlaying(false);
      pauseDebounceRef.current = window.setTimeout(() => {
        pauseDebounceRef.current = null;
        desiredPlayStateRef.current = false;
      }, 150);
    };
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('durationchange', onDurationChange);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('durationchange', onDurationChange);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      if (pauseDebounceRef.current) {
        clearTimeout(pauseDebounceRef.current);
      }
    };
  }, [videoSource?.type]);

  const handleAnnotationAdd = useCallback((a: Annotation) => {
    setAnnotations((prev) => [...prev, a]);
  }, [setAnnotations]);

  const handleAnnotationUpdate = useCallback((id: string, updates: Partial<Annotation>) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, [setAnnotations]);

  const handleAnnotationDelete = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, [setAnnotations]);

  const handleClearAll = useCallback(() => {
    const clearAction: Annotation = {
      id: crypto.randomUUID(),
      type: 'clear',
      points: [],
      startTime: currentTime,
      endTime: currentTime,
      color: '#000000',
      strokeWidth: 1,
    };
    setAnnotations((prev) => [...prev, clearAction]);
  }, [setAnnotations, currentTime]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key === 'y') {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    if (!videoSource) resetHistory([]);
    setVideoLoadError(false);
    setYoutubeMuted(true);
  }, [videoSource, resetHistory]);

  useEffect(() => {
    if (initialAutoPlay) {
      setIsPlaying(true);
      desiredPlayStateRef.current = true;
      setInitialAutoPlay(false);
    }
  }, [initialAutoPlay]);

  const handleVideoLoaded = useCallback(
    (source: VideoSource, options?: VideoLoadOptions) => {
      setVideoSource(source);
      if (options?.annotations?.length) {
        const normalized = normalizeAnnotations(options.annotations);
        resetHistory(normalized);
        lastSavedAnnotationsRef.current = options.annotations;
      } else {
        lastSavedAnnotationsRef.current = null;
      }
      savedVideoIdRef.current = options?.savedVideoId ?? null;
      setInitialAutoPlay(!!options?.autoPlay);
    },
    [resetHistory]
  );

  const annotationsUnchanged = useCallback(() => {
    const last = lastSavedAnnotationsRef.current;
    if (last === null) return false;
    if (annotations.length !== last.length) return false;
    const key = (a: Annotation) => `${a.startTime}-${a.id}`;
    const sorted = (arr: Annotation[]) => [...arr].sort((a, b) => key(a).localeCompare(key(b)));
    return JSON.stringify(sorted(annotations)) === JSON.stringify(sorted(last));
  }, [annotations]);

  const canSaveVideo =
    annotations.length > 0 &&
    (videoSource?.type === 'youtube' || (videoSource?.type === 'file' && videoSource.youtubeUrl));

  const openSaveModal = useCallback(() => {
    if (!canSaveVideo) return;
    const savedId = savedVideoIdRef.current;
    if (savedId) {
      const videos = getSavedVideos();
      const video = videos.find((v) => v.id === savedId);
      if (video) {
        const { baseName } = getBaseNameAndNextVersion(video);
        setSaveName(baseName);
      } else {
        setSaveName('My Annotated Video');
      }
    } else {
      setSaveName('My Annotated Video');
    }
    setSaveModalOpen(true);
  }, [canSaveVideo]);

  useEffect(() => {
    if (saveModalOpen) {
      const id = setTimeout(() => {
        const input = saveNameInputRef.current;
        if (input) {
          input.focus();
          input.select();
        }
      }, 0);
      return () => clearTimeout(id);
    }
  }, [saveModalOpen]);

  const closeSaveModal = useCallback(() => {
    setSaveModalOpen(false);
    setSaveName('');
    setSaveThenLeave(false);
  }, []);

  const performLeave = useCallback(() => {
    setLeaveConfirmOpen(false);
    pendingLeaveActionRef.current?.();
    pendingLeaveActionRef.current = null;
    leaveResolveRef.current?.(true);
    leaveResolveRef.current = null;
  }, []);

  const cancelLeave = useCallback(() => {
    setLeaveConfirmOpen(false);
    pendingLeaveActionRef.current = null;
    leaveResolveRef.current?.(false);
    leaveResolveRef.current = null;
  }, []);

  const requestNewVideo = useCallback(() => {
    if (!canSaveVideo) {
      setVideoSource(null);
      return;
    }
    pendingLeaveActionRef.current = () => setVideoSource(null);
    leaveResolveRef.current = null;
    setLeaveConfirmOpen(true);
  }, [canSaveVideo]);

  useImperativeHandle(ref, () => ({
    confirmLeave: () => {
      if (!canSaveVideo) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        leaveResolveRef.current = resolve;
        pendingLeaveActionRef.current = null;
        setLeaveConfirmOpen(true);
      });
    },
  }), [canSaveVideo]);

  const handleLeaveSave = useCallback(() => {
    const savedId = savedVideoIdRef.current;
    if (savedId) {
      const videos = getSavedVideos();
      const video = videos.find((v) => v.id === savedId);
      if (video) {
        const { baseName } = getBaseNameAndNextVersion(video);
        setSaveName(baseName);
      } else {
        setSaveName('My Annotated Video');
      }
    } else {
      setSaveName('My Annotated Video');
    }
    setSaveModalOpen(true);
    setSaveThenLeave(true);
    setLeaveConfirmOpen(false);
  }, []);

  const handleLeaveDontSave = useCallback(() => {
    performLeave();
  }, [performLeave]);

  const handleSaveVideo = useCallback(() => {
    if (!canSaveVideo || !videoSource) return;
    if (annotationsUnchanged()) {
      closeSaveModal();
      if (saveThenLeave) {
        performLeave();
      }
      return;
    }
    const youtubeUrl =
      videoSource.type === 'youtube' ? videoSource.url : videoSource.youtubeUrl;
    if (!youtubeUrl) return;
    let name: string;
    const savedId = savedVideoIdRef.current;
    if (savedId) {
      const videos = getSavedVideos();
      const video = videos.find((v) => v.id === savedId);
      if (video) {
        const { nextName } = getBaseNameAndNextVersion(video);
        name = nextName;
      } else {
        name = saveName.trim() || 'My Annotated Video';
      }
    } else {
      name = saveName.trim();
    }
    if (!name) return;
    try {
      const saved = saveVideo({ name, youtubeUrl, annotations });
      lastSavedAnnotationsRef.current = annotations;
      savedVideoIdRef.current = saved.id;
      closeSaveModal();
      if (saveThenLeave) {
        performLeave();
      }
    } catch {
      window.alert('Failed to save video.');
    }
  }, [canSaveVideo, videoSource, annotations, saveName, closeSaveModal, saveThenLeave, performLeave, annotationsUnchanged]);

  const startExport = useCallback(async () => {
    if (!containerRef.current || videoSource?.type !== 'file') return;
    setIsExporting(true);
    try {
      const video = videoRef.current;
      if (!video) throw new Error('No video');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `boxing-annotated-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setIsExporting(false);
      };

      recorder.start(100);
      video.currentTime = 0;
      await video.play();

        const drawFrame = () => {
        if (video.ended || video.paused) {
          recorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0);
        const scaleX = video.videoWidth;
        const scaleY = video.videoHeight;
        const visible = getVisibleAnnotations(annotations, video.currentTime);
        visible.forEach((a) => {
          drawAnnotationOnContext(ctx, a, scaleX, scaleY);
        });
        requestAnimationFrame(drawFrame);
      };
      drawFrame();
    } catch (err) {
      console.error(err);
      setIsExporting(false);
    }
  }, [videoSource?.type, annotations]);

  if (!videoSource) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <h1 className="font-display text-6xl tracking-widest text-white mb-4">
          BOXING VIDEO ANALYZER
        </h1>
        <VideoUploader onVideoLoaded={handleVideoLoaded} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-display text-3xl tracking-wider text-white">
            BOXING VIDEO ANALYZER
          </h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={requestNewVideo}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center gap-2"
              title="Back to home"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </button>
            <button
              type="button"
              onClick={enterFullscreen}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center gap-2"
              title="Fullscreen annotation mode"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Fullscreen
            </button>
            <button
              type="button"
              onClick={requestNewVideo}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              New Video
            </button>
            {canSaveVideo && (
              <button
                type="button"
                onClick={openSaveModal}
                className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center gap-2"
                title="Save video with annotations"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save
              </button>
            )}
            {videoSource.type === 'file' && (
              <button
                type="button"
                onClick={startExport}
                disabled={isExporting}
                className="px-4 py-2 rounded-lg bg-accent text-slate-900 font-medium hover:bg-orange-400 disabled:opacity-50"
              >
                {isExporting ? 'Exporting...' : 'Download Annotated Video'}
              </button>
            )}
          </div>
        </div>

        <div
          ref={fullscreenRef}
          className="fullscreen-annotator grid grid-cols-1 lg:grid-cols-4 gap-6"
        >
          <div className="fullscreen-video-area lg:col-span-3 space-y-4">
            <div
              ref={containerRef}
              className="relative aspect-video bg-black rounded-t-lg overflow-hidden fullscreen-video-container"
            >
              {videoSource.type === 'file' ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoSource.url}
                    className="w-full h-full object-contain pointer-events-none"
                    playsInline
                    preload="auto"
                    onError={() => setVideoLoadError(true)}
                    onLoadedData={() => setVideoLoadError(false)}
                  />
                </>
              ) : (
                <div className="absolute inset-0 pointer-events-none youtube-embed-root">
                  <YouTubePlayer
                    ref={youtubePlayerRef}
                    key={videoSource.videoId}
                    videoId={videoSource.videoId}
                    onTimeUpdate={(t, d) => {
                      setCurrentTime(t);
                      setDuration(d);
                    }}
                    onStateChange={setIsPlaying}
                    isPaused={!isPlaying}
                    seekTo={seekTo}
                    className="absolute inset-0"
                  />
                </div>
              )}
              <AnnotationCanvas
                width={containerSize.width}
                height={containerSize.height}
                annotations={annotations}
                currentTime={currentTime}
                activeTool={activeTool}
                color={color}
                strokeWidth={strokeWidth}
                onAnnotationAdd={handleAnnotationAdd}
                onAnnotationDelete={handleAnnotationDelete}
                isDrawing={isDrawing}
                onDrawingChange={setIsDrawing}
              />
            </div>
            <div className="fullscreen-controls-overlay flex flex-col gap-0 rounded-b-lg">
              <VideoControls
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
                onSeek={handleSeek}
                playbackRate={playbackRate}
                onPlaybackRateChange={handlePlaybackRateChange}
                isYouTube={videoSource.type === 'youtube'}
                isMuted={videoSource.type === 'youtube' && youtubeMuted}
                onUnmute={
                  videoSource.type === 'youtube'
                    ? () => {
                        youtubePlayerRef.current?.unMute?.();
                        setYoutubeMuted(false);
                      }
                    : undefined
                }
              />
              <AnnotationToolbar
                activeTool={activeTool}
                onToolChange={setActiveTool}
                color={color}
                onColorChange={setColor}
                strokeWidth={strokeWidth}
                onStrokeWidthChange={setStrokeWidth}
                onClearAll={handleClearAll}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
              />
            </div>
          </div>
          <div className="fullscreen-annotations-panel space-y-2">
            <h3 className="font-display text-xl text-slate-300">Annotations</h3>
            <AnnotationList
              annotations={annotations}
              onUpdate={handleAnnotationUpdate}
              onDelete={handleAnnotationDelete}
            />
          </div>
          {isFullscreen && (
            <div className="fixed top-4 left-4 z-[200] flex gap-2">
              <button
                type="button"
                onClick={exitFullscreen}
                className="p-2 rounded-lg bg-slate-800/95 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                title="Exit fullscreen (Esc)"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          {leaveConfirmOpen && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60" onClick={cancelLeave}>
              <div
                className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-full max-w-md shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-display text-xl text-white mb-2">Save before leaving?</h3>
                <p className="text-slate-400 text-sm mb-6">
                  You have unsaved annotations. Would you like to save this video before leaving?
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={cancelLeave}
                    className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleLeaveDontSave}
                    className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
                  >
                    Don&apos;t Save
                  </button>
                  <button
                    type="button"
                    onClick={handleLeaveSave}
                    className="px-4 py-2 rounded-lg bg-accent text-slate-900 font-medium hover:bg-orange-400"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
          {saveModalOpen && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60" onClick={closeSaveModal}>
              <div
                className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-full max-w-md shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-display text-xl text-white mb-4">Save Video</h3>
                <label className="block text-slate-400 text-sm mb-2">Name</label>
                <input
                  ref={saveNameInputRef}
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveVideo();
                    if (e.key === 'Escape') closeSaveModal();
                  }}
                  placeholder="My Annotated Video"
                  className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-accent mb-4"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={closeSaveModal}
                    className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveVideo}
                    disabled={!saveName.trim()}
                    className="px-4 py-2 rounded-lg bg-accent text-slate-900 font-medium hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default VideoPlayerWorkspace;
