import { useState, useRef, useCallback, useEffect } from 'react';
import { useRecording } from '../context/RecordingContext';

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

interface RecordingModeProps {
  onBack: () => void;
  hidden?: boolean;
  onRecordingComplete?: (blob: Blob, duration: number) => void;
}

export default function RecordingMode({ onBack, hidden = false, onRecordingComplete }: RecordingModeProps) {
  const { setRecording, recording: contextRecording } = useRecording();
  const [status, setStatus] = useState<'idle' | 'connecting' | 'recording' | 'paused' | 'stopped'>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [selectedMicId, setSelectedMicId] = useState<string>('');

  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [facePosition, setFacePosition] = useState<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('top-right');
  const [countdownEnabled, setCountdownEnabled] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const screenPreviewRef = useRef<HTMLVideoElement>(null);
  const recordingStreamsRef = useRef<MediaStream[]>([]);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const drawFrameRef = useRef<number | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const facePositionRef = useRef(facePosition);
  const countdownFiredRef = useRef(false);
  const recordingDurationRef = useRef(0);
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  facePositionRef.current = facePosition;
  recordingDurationRef.current = recordingDuration;
  onRecordingCompleteRef.current = onRecordingComplete;

  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(
        devices
          .filter((d) => d.kind === 'videoinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 8)}`, kind: d.kind }))
      );
      setMics(
        devices
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`, kind: d.kind }))
      );
      if (devices.length && !selectedCameraId) {
        const firstCam = devices.find((d) => d.kind === 'videoinput');
        if (firstCam) setSelectedCameraId(firstCam.deviceId);
      }
      if (devices.length && !selectedMicId) {
        const firstMic = devices.find((d) => d.kind === 'audioinput');
        if (firstMic) setSelectedMicId(firstMic.deviceId);
      }
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
      setError('Could not list devices');
    }
  }, [selectedCameraId, selectedMicId]);

  useEffect(() => {
    enumerateDevices();
  }, [enumerateDevices]);

  useEffect(() => {
    const onDeviceChange = () => enumerateDevices();
    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange);
  }, [enumerateDevices]);

  useEffect(() => {
    if (status !== 'recording' && status !== 'paused') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [status]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => (c ?? 0) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  screenStreamRef.current = screenStream;
  cameraStreamRef.current = cameraStream;
  micStreamRef.current = micStream;

  const stopAllStreams = useCallback(() => {
    screenStream?.getTracks().forEach((t) => t.stop());
    cameraStream?.getTracks().forEach((t) => t.stop());
    micStream?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
    setCameraStream(null);
    setMicStream(null);
  }, [screenStream, cameraStream, micStream]);

  useEffect(() => {
    return () => {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      if (drawFrameRef.current != null) {
        cancelAnimationFrame(drawFrameRef.current);
        drawFrameRef.current = null;
      }
      const rec = mediaRecorderRef.current;
      if (rec?.state !== 'inactive') {
        try {
          rec?.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const connectCamera = useCallback(async () => {
    setError(null);
    try {
      cameraStream?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user', deviceId: selectedCameraId || undefined },
      });
      setCameraStream(stream);
      if (cameraPreviewRef.current) {
        cameraPreviewRef.current.srcObject = stream;
      }
      await enumerateDevices();
    } catch (err) {
      console.error('Failed to connect camera:', err);
      setError(err instanceof Error ? err.message : 'Could not access camera');
      setCameraStream(null);
    }
  }, [selectedCameraId, cameraStream, enumerateDevices]);

  const disconnectCamera = useCallback(() => {
    cameraStream?.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
  }, [cameraStream]);

  const connectMic = useCallback(async () => {
    setError(null);
    try {
      micStream?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selectedMicId || undefined },
      });
      setMicStream(stream);
      await enumerateDevices();
    } catch (err) {
      console.error('Failed to connect microphone:', err);
      setError(err instanceof Error ? err.message : 'Could not access microphone');
      setMicStream(null);
    }
  }, [selectedMicId, micStream, enumerateDevices]);

  const disconnectMic = useCallback(() => {
    micStream?.getTracks().forEach((t) => t.stop());
    setMicStream(null);
  }, [micStream]);

  // Sync screen stream to preview video when either changes (ref can attach after stream is set)
  useEffect(() => {
    const video = screenPreviewRef.current;
    if (!video || !screenStream) return;
    if (video.srcObject !== screenStream) {
      video.srcObject = screenStream;
      video.play().catch(() => {});
    }
  }, [screenStream]);

  const connectScreen = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Screen sharing is not supported in this browser. Try Chrome, Edge, or Firefox.');
      return;
    }
    try {
      screenStream?.getTracks().forEach((t) => t.stop());
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      } catch (audioErr) {
        const msg = audioErr instanceof Error ? audioErr.message : String(audioErr);
        if (msg.toLowerCase().includes('not supported')) {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        } else {
          throw audioErr;
        }
      }
      setScreenStream(stream);
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
      };
    } catch (err) {
      console.error('Failed to connect screen:', err);
      const msg = err instanceof Error ? err.message : 'Could not share screen';
      const hint =
        msg.toLowerCase().includes('not supported') || msg.toLowerCase().includes('not allowed')
          ? ' Screen sharing requires HTTPS (or localhost) and a supported browser (Chrome, Edge, Firefox, Safari).'
          : '';
      setError(`Could not share screen.${hint}`);
      setScreenStream(null);
    }
  }, [screenStream]);

  const disconnectScreen = useCallback(() => {
    screenStream?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
  }, [screenStream]);

  const startRecording = useCallback(async () => {
    setError(null);
    setStatus('connecting');
    let displayStream = screenStream;
    let camStream: MediaStream | null = null;
    if (cameraEnabled && cameraStream?.active && cameraStream.getVideoTracks().length) {
      camStream = cameraStream;
    }
    let audioStream = micEnabled ? micStream : null;

    try {
      if (!displayStream) {
        try {
          displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } catch {
          displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        }
        setScreenStream(displayStream);
      }
      if (!displayStream?.getVideoTracks().length) {
        setError('Could not capture screen. Make sure you selected a window or screen to share.');
        setStatus('idle');
        return;
      }
      displayStream.getVideoTracks()[0].onended = () => {
        const rec = mediaRecorderRef.current;
        if (rec?.state === 'recording' || rec?.state === 'paused') {
          rec.stop();
        }
      };

      if (cameraEnabled && !camStream) {
        try {
          camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          setCameraStream(camStream);
        } catch (camErr) {
          camStream = null;
          setError(
            'Could not access camera (it may be in use by another app). Recording without face camera.'
          );
        }
      }

      if (micEnabled && !audioStream) {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: selectedMicId || undefined },
        });
        setMicStream(audioStream);
      }

      const screenVideo = document.createElement('video');
      screenVideo.srcObject = displayStream;
      screenVideo.muted = true;
      await screenVideo.play();
      // Wait for first frame so canvas isn't black at start
      if (screenVideo.readyState < 2) {
        await new Promise<void>((resolve) => {
          screenVideo.onloadeddata = () => resolve();
          setTimeout(resolve, 500);
        });
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        setError('Recording canvas not ready. Please try again.');
        setStatus('idle');
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Could not initialize recording canvas.');
        setStatus('idle');
        return;
      }

      const videoTracks = displayStream.getVideoTracks();
      if (!videoTracks.length) {
        setError('No video track from screen share.');
        setStatus('idle');
        stopAllStreams();
        return;
      }
      const screenTrack = videoTracks[0];
      const { width, height } = screenTrack.getSettings();
      canvas.width = width || 1920;
      canvas.height = height || 1080;

      const faceVideo = document.createElement('video');
      if (camStream) {
        faceVideo.srcObject = camStream;
        faceVideo.muted = true;
        await faceVideo.play();
        if (faceVideo.readyState < 2) {
          await new Promise<void>((resolve) => {
            faceVideo.onloadeddata = () => resolve();
            setTimeout(resolve, 300);
          });
        }
      }

      const audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      const dest = audioCtx.createMediaStreamDestination();
      if (displayStream.getAudioTracks().length) {
        const screenSource = audioCtx.createMediaStreamSource(
          new MediaStream(displayStream.getAudioTracks())
        );
        screenSource.connect(dest);
      }
      if (audioStream) {
        const micSource = audioCtx.createMediaStreamSource(audioStream);
        micSource.connect(dest);
      }

      // Only vp9/vp8 produce valid WebM - 'video/webm' and avc1 produce Matroska which Chrome can't play
      const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8'];
      const hasAudio = dest.stream.getAudioTracks().length > 0;
      const createRecorder = (stream: MediaStream): { recorder: MediaRecorder; mimeType: string } => {
        for (const mime of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mime)) {
            try {
              const rec = new MediaRecorder(stream, {
                mimeType: mime,
                videoBitsPerSecond: 5000000,
                ...(hasAudio && { audioBitsPerSecond: 128000 }),
              });
              return { recorder: rec, mimeType: mime };
            } catch {
              continue;
            }
          }
        }
        try {
          const rec = new MediaRecorder(stream);
          return { recorder: rec, mimeType: rec.mimeType || 'video/webm;codecs=vp9' };
        } catch (e) {
          throw new Error('Recording not supported in this browser. Try Chrome or Edge.');
        }
      };

      const margin = 16;
      const faceSizeRatio = 0.2;
      const drawToCanvas = () => {
        if (screenVideo.readyState >= 2) {
          ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
          if (camStream && faceVideo.readyState >= 2) {
            const faceW = Math.floor(canvas.width * faceSizeRatio);
            const faceH = Math.floor(faceW * (faceVideo.videoHeight / faceVideo.videoWidth));
            const pos = facePositionRef.current;
            const x =
              pos === 'top-right' || pos === 'bottom-right'
                ? canvas.width - faceW - margin
                : margin;
            const y =
              pos === 'top-right' || pos === 'top-left' ? margin : canvas.height - faceH - margin;
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(x - 4, y - 4, faceW + 8, faceH + 8);
            ctx.drawImage(faceVideo, x, y, faceW, faceH);
          }
        }
      };
      drawToCanvas(); // Prime canvas before starting recorder
      const drawFrame = () => {
        drawToCanvas();
        if (mediaRecorderRef.current?.state === 'recording' || mediaRecorderRef.current?.state === 'paused') {
          drawFrameRef.current = requestAnimationFrame(drawFrame);
        }
      };

      const canvasStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);
      const result = createRecorder(combinedStream);
      const recorder = result.recorder;
      const mimeType = result.mimeType;

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      recorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        setError('Recording failed. Try again or use a different browser.');
      };

      mediaRecorderRef.current = recorder;
      // Use a timeslice so browsers emit data periodically. 250ms gives the encoder time to produce keyframes.
      recorder.start(250);
      setRecordingDuration(0);
      setStatus('recording');
      drawFrame();

      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);

      recordingStreamsRef.current = [displayStream];
      if (camStream) recordingStreamsRef.current.push(camStream);
      if (audioStream) recordingStreamsRef.current.push(audioStream);

      recorder.onstop = () => {
        if (drawFrameRef.current != null) {
          cancelAnimationFrame(drawFrameRef.current);
          drawFrameRef.current = null;
        }
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
        recordingStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
        recordingStreamsRef.current = [];
        setScreenStream(null);
        setCameraStream(null);
        setMicStream(null);
        if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
        if (screenPreviewRef.current) screenPreviewRef.current.srcObject = null;

        const durationSec = recordingDurationRef.current;
        const processChunks = () => {
          const chunks = chunksRef.current;
          try {
            if (chunks.length === 0) {
              setError('Recording produced no data. Try recording for at least a few seconds.');
              setStatus('idle');
              return;
            }
            const actualMime = recorder.mimeType.startsWith('video/webm') ? recorder.mimeType : mimeType;
            const blob = new Blob(chunks, { type: actualMime });
            setRecordedBlob(blob);
            setStatus('stopped');
            setRecording({ status: 'stopped', duration: durationSec, blob });
            const notify = onRecordingCompleteRef.current;
            if (notify) {
              notify(blob, durationSec);
            }
          } catch (err) {
            console.error('Recording onstop error:', err);
            setError(err instanceof Error ? err.message : 'Recording failed to finalize.');
            setStatus('idle');
          }
        };

        // Defer so the final ondataavailable (from requestData/stop) is delivered first.
        // Some browsers emit the last chunk asynchronously after onstop is queued.
        setTimeout(processChunks, 150);
      };
    } catch (err) {
      console.error('Failed to start recording:', err);
      const msg = err instanceof Error ? err.message : 'Failed to start recording';
      let hint = '';
      if (
        msg.toLowerCase().includes('video source') ||
        msg.toLowerCase().includes('videosource') ||
        msg.toLowerCase().includes('failed to allocate')
      ) {
        hint =
          ' The camera or screen may be in use by another app. Close Zoom, Teams, or other video apps and try again. You can also try unchecking "face camera" to record screen only.';
      }
      setError(`Could not start recording.${hint}`);
      setStatus('idle');
      stopAllStreams();
      return;
    }
  }, [
    cameraEnabled,
    micEnabled,
    screenStream,
    cameraStream,
    micStream,
    selectedCameraId,
    selectedMicId,
    stopAllStreams,
  ]);

  useEffect(() => {
    if (countdown !== 0) return;
    if (countdownFiredRef.current) return;
    countdownFiredRef.current = true;
    setCountdown(null);
    startRecording();
  }, [countdown, startRecording]);

  useEffect(() => {
    if (status === 'idle') countdownFiredRef.current = false;
  }, [status]);

  const pauseRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec?.state === 'recording') {
      try {
        rec.pause();
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
        setStatus('paused');
      } catch (err) {
        console.error('Failed to pause:', err);
        setError('Pause not supported in this browser');
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec?.state === 'paused') {
      try {
        rec.resume();
        setStatus('recording');
        durationIntervalRef.current = setInterval(() => {
          setRecordingDuration((d) => d + 1);
        }, 1000);
      } catch (err) {
        console.error('Failed to resume:', err);
        setError('Resume not supported in this browser');
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === 'inactive') return;
    try {
      rec.requestData();
    } catch {
      /* requestData not supported in all browsers */
    }
    rec.stop();
  }, []);

  useEffect(() => {
    setRecording({
      status,
      duration: recordingDuration,
      blob: recordedBlob,
      pauseRecording,
      resumeRecording,
      stopRecording,
    });
  }, [status, recordingDuration, recordedBlob, pauseRecording, resumeRecording, stopRecording, setRecording]);

  // When user dismisses the complete page, context resets to idle/null; sync local state so we don't push stale blob back.
  useEffect(() => {
    if (contextRecording.status === 'idle' && !contextRecording.blob && (status === 'stopped' || recordedBlob)) {
      setStatus('idle');
      setRecordedBlob(null);
      setRecordingDuration(0);
      setError(null);
    }
  }, [contextRecording.status, contextRecording.blob, status, recordedBlob]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const canRecord = screenStream || (status === 'idle');
  const hasRecordingSupport =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== 'undefined';

  // Canvas is always in DOM for recording; shown in "Live preview" when recording so user sees exactly what is recorded.
  const isActivelyRecording = status === 'recording' || status === 'paused' || status === 'connecting';
  return (
    <div
      className={hidden ? 'sr-only min-h-0 overflow-hidden pointer-events-none' : 'min-h-screen p-6'}
      aria-hidden={hidden}
    >
      {!hidden && (
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-display text-3xl tracking-wider text-white">
            RECORDING MODE
          </h1>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            ← Back to Analyzer
          </button>
        </div>

        <p className="text-slate-400 mb-6">
          Connect your camera, microphone, and screen before recording. You can preview each source
          and choose which devices to use.
        </p>

        {!hasRecordingSupport && (
          <div className="mb-4 p-3 rounded-lg bg-amber-900/30 border border-amber-500/50 text-amber-200">
            Screen recording requires a modern browser with getDisplayMedia and MediaRecorder support
            (Chrome, Edge, Firefox, or Safari 14.1+). Please use a supported browser.
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/50 text-red-300">
            {error}
          </div>
        )}

        {/* Live preview: exactly what is being recorded. Canvas stays in DOM when hidden so ref is valid. */}
        <div className={isActivelyRecording ? 'mb-6' : 'hidden'}>
          <div className="rounded-xl border-2 border-red-500/50 bg-slate-900/80 p-4">
            <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse ring-2 ring-red-400/50" />
              Live preview – You are recording
            </h3>
            <p className="text-slate-400 text-sm mb-3">
              This is exactly what is being saved. Use the floating toolbar to pause or end.
            </p>
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-slate-600">
              <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ objectFit: 'contain' }}
                aria-hidden
              />
              {status === 'connecting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                  <p className="text-slate-300 text-lg">Connecting...</p>
                </div>
              )}
            </div>
            {(status === 'recording' || status === 'paused') && (
              <p className="text-slate-500 text-sm mt-2 font-mono">
                {formatDuration(recordingDuration)}
              </p>
            )}
          </div>
        </div>

        {status === 'idle' && (
          <div className="space-y-6 mb-6">
            {/* Recording preview – what will be recorded */}
            <div className="rounded-xl border-2 border-slate-600 bg-slate-900/80 p-4">
              <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-400/50" />
                Recording preview
              </h3>
              <p className="text-slate-400 text-sm mb-3">
                {screenStream
                  ? 'This is exactly what will be recorded. Use it to position windows and check your setup.'
                  : 'Connect a screen below to see a live preview here.'}
              </p>
              <div className="w-full rounded-lg overflow-hidden border border-slate-600 bg-black min-h-[280px] flex items-center justify-center">
                {screenStream ? (
                  <video
                    ref={screenPreviewRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full max-h-[70vh] object-contain"
                    style={{ aspectRatio: '16/9' }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-slate-500">
                    <svg className="w-14 h-14 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-center max-w-sm">No screen connected. Click “Connect screen” below and choose a window or your entire screen to see the live preview here.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Screen */}
            <div className="rounded-xl border border-slate-600/50 bg-slate-800/30 p-4">
              <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                Screen
              </h3>
              <div className="flex flex-wrap gap-4 items-start">
                <div className="flex-1 min-w-[200px]">
                  {screenStream ? (
                    <div className="space-y-2">
                      <p className="text-slate-400 text-sm">Screen is connected. View the live preview above.</p>
                      <button
                        type="button"
                        onClick={disconnectScreen}
                        className="px-3 py-1.5 rounded-lg bg-slate-600 text-slate-200 hover:bg-slate-500 text-sm"
                      >
                        Disconnect screen
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={connectScreen}
                        className="px-4 py-2 rounded-lg bg-ring text-white font-medium hover:bg-red-600 transition-colors"
                      >
                        Connect screen
                      </button>
                      <span className="text-slate-500 text-sm">Share a window or your entire screen</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Camera */}
            <div className="rounded-xl border border-slate-600/50 bg-slate-800/30 p-4">
              <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                Camera
              </h3>
              <div className="flex flex-wrap gap-4 items-start">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex gap-2 mb-2">
                    <select
                      value={selectedCameraId}
                      onChange={(e) => setSelectedCameraId(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 border border-slate-600 min-w-[180px]"
                    >
                      {cameras.map((c) => (
                        <option key={c.deviceId} value={c.deviceId}>
                          {c.label}
                        </option>
                      ))}
                      {cameras.length === 0 && (
                        <option value="">No cameras found</option>
                      )}
                    </select>
                    {cameraStream ? (
                      <button
                        type="button"
                        onClick={disconnectCamera}
                        className="px-3 py-2 rounded-lg bg-slate-600 text-slate-200 hover:bg-slate-500"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={connectCamera}
                        className="px-4 py-2 rounded-lg bg-ring text-white font-medium hover:bg-red-600 transition-colors"
                      >
                        Connect camera
                      </button>
                    )}
                  </div>
                  {cameraStream && (
                    <video
                      ref={cameraPreviewRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-48 aspect-video rounded-lg bg-black object-cover border border-slate-600"
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cameraEnabled}
                      onChange={(e) => setCameraEnabled(e.target.checked)}
                      className="rounded accent-ring"
                    />
                    <span className="text-slate-300">Include in recording (face bubble)</span>
                  </label>
                  {cameraEnabled && (
                    <label className="flex items-center gap-2 text-slate-400 text-sm">
                      <span>Position:</span>
                      <select
                        value={facePosition}
                        onChange={(e) =>
                          setFacePosition(
                            e.target.value as 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
                          )
                        }
                        className="px-2 py-1 rounded bg-slate-700 text-slate-200 border border-slate-600"
                      >
                        <option value="top-right">Top right</option>
                        <option value="top-left">Top left</option>
                        <option value="bottom-right">Bottom right</option>
                        <option value="bottom-left">Bottom left</option>
                      </select>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Microphone */}
            <div className="rounded-xl border border-slate-600/50 bg-slate-800/30 p-4">
              <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                Microphone
              </h3>
              <div className="flex flex-wrap gap-4 items-center">
                <select
                  value={selectedMicId}
                  onChange={(e) => setSelectedMicId(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 border border-slate-600 min-w-[180px]"
                >
                  {mics.map((m) => (
                    <option key={m.deviceId} value={m.deviceId}>
                      {m.label}
                    </option>
                  ))}
                  {mics.length === 0 && (
                    <option value="">No microphones found</option>
                  )}
                </select>
                {micStream ? (
                  <button
                    type="button"
                    onClick={disconnectMic}
                    className="px-3 py-2 rounded-lg bg-slate-600 text-slate-200 hover:bg-slate-500"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={connectMic}
                    className="px-4 py-2 rounded-lg bg-ring text-white font-medium hover:bg-red-600 transition-colors"
                  >
                    Connect mic
                  </button>
                )}
                {micStream && (
                  <span className="text-green-400 text-sm flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Connected
                  </span>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={micEnabled}
                    onChange={(e) => setMicEnabled(e.target.checked)}
                    className="rounded accent-ring"
                  />
                  <span className="text-slate-300">Include in recording</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-600/50 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={countdownEnabled}
                  onChange={(e) => setCountdownEnabled(e.target.checked)}
                  className="rounded accent-ring"
                />
                <span>3-second countdown before recording</span>
              </label>
              <button
                type="button"
                onClick={() =>
                  countdownEnabled ? setCountdown(3) : startRecording()
                }
                disabled={!canRecord || !hasRecordingSupport || countdown !== null}
                className="px-6 py-3 rounded-lg bg-ring text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Recording
              </button>
              <p className="text-slate-500 text-sm">
                {screenStream
                  ? 'Screen is connected. Click to start recording.'
                  : 'Connect your screen first, or click Start Recording to choose what to share.'}
              </p>
            </div>
          </div>
        )}

        {countdown !== null && countdown > 0 && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-slate-400 text-lg mb-2">Recording in</p>
              <p className="text-6xl font-bold text-white tabular-nums">{countdown}</p>
            </div>
          </div>
        )}

      </div>
      )}
    </div>
  );
}
