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
}

export default function RecordingMode({ onBack, hidden = false }: RecordingModeProps) {
  const { setRecording } = useRecording();
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const screenPreviewRef = useRef<HTMLVideoElement>(null);
  const recordingStreamsRef = useRef<MediaStream[]>([]);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const drawFrameRef = useRef<number | null>(null);

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
      stopAllStreams();
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
  }, [stopAllStreams]);

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

  useEffect(() => {
    const video = screenPreviewRef.current;
    if (video && screenStream) {
      video.srcObject = screenStream;
      video.play().catch(() => {});
    } else if (video) {
      video.srcObject = null;
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
      }

      const audioCtx = new AudioContext();
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

      // Draw display stream to canvas and record from canvas - fixes black screen when
      // MediaRecorder gets no frames from getDisplayMedia stream directly
      const drawToCanvas = () => {
        if (screenVideo.readyState >= 2) {
          ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
          if (camStream && faceVideo.readyState >= 2) {
            const faceW = Math.floor(canvas.width * 0.2);
            const faceH = Math.floor(faceW * (faceVideo.videoHeight / faceVideo.videoWidth));
            const x = canvas.width - faceW - 16;
            const y = 16;
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
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
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
        const chunks = chunksRef.current;
        if (chunks.length === 0) {
          setError('Recording produced no data. Try recording for at least a few seconds.');
          setStatus('idle');
          recordingStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
          recordingStreamsRef.current = [];
          return;
        }
        const actualMime = recorder.mimeType.startsWith('video/webm') ? recorder.mimeType : mimeType;
        const blob = new Blob(chunks, { type: actualMime });
        setRecordedBlob(blob);
        setStatus('stopped');
        recordingStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
        recordingStreamsRef.current = [];
        setScreenStream(null);
        setCameraStream(null);
        setMicStream(null);
        if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
        if (screenPreviewRef.current) screenPreviewRef.current.srcObject = null;
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
    mediaRecorderRef.current?.stop();
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

  if (hidden) {
    return (
      <div className="sr-only" aria-hidden>
        <canvas ref={canvasRef} className="hidden" aria-hidden />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <canvas ref={canvasRef} className="hidden" aria-hidden />
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

        {status === 'idle' && (
          <div className="space-y-6 mb-6">
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
                      <video
                        ref={screenPreviewRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full max-w-md aspect-video rounded-lg bg-black object-contain border border-slate-600"
                      />
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cameraEnabled}
                    onChange={(e) => setCameraEnabled(e.target.checked)}
                    className="rounded accent-ring"
                  />
                  <span className="text-slate-300">Include in recording (face bubble)</span>
                </label>
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

            <div className="pt-4 border-t border-slate-600/50">
              <button
                type="button"
                onClick={startRecording}
                disabled={!canRecord || !hasRecordingSupport}
                className="px-6 py-3 rounded-lg bg-ring text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Recording
              </button>
              <p className="mt-2 text-slate-500 text-sm">
                {screenStream
                  ? 'Screen is connected. Click to start recording.'
                  : 'Connect your screen first, or click Start Recording to choose what to share.'}
              </p>
            </div>
          </div>
        )}

        {(status === 'connecting' || status === 'recording' || status === 'paused') && !hidden && (
          <div className="space-y-4 mb-6">
            <div className="rounded-xl border border-slate-600/50 bg-slate-800/30 p-4">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    status === 'paused' ? 'bg-amber-500' : 'bg-red-500 animate-pulse'
                  }`}
                />
                <span className="text-white">
                  {status === 'connecting'
                    ? 'Connecting...'
                    : status === 'paused'
                      ? 'Paused'
                      : 'Recording'}
                </span>
                <span className="text-slate-400 font-mono ml-2">
                  {formatDuration(recordingDuration)}
                </span>
              </div>
              <p className="text-slate-500 text-sm mt-1">
                Use the floating toolbar to pause or end. You can switch tabs while recording.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
