import { useState, useRef, useCallback, useEffect } from 'react';

interface RecordingModeProps {
  onBack: () => void;
}

export default function RecordingMode({ onBack }: RecordingModeProps) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'stopped'>('idle');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopAllStreams = useCallback(() => {
    screenStream?.getTracks().forEach((t) => t.stop());
    cameraStream?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
    setCameraStream(null);
  }, [screenStream, cameraStream]);

  useEffect(() => {
    return () => stopAllStreams();
  }, [stopAllStreams]);

  const startRecording = useCallback(async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: true,
      });

      let micStream: MediaStream | null = null;
      if (micEnabled) {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      let camStream: MediaStream | null = null;
      if (cameraEnabled) {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
        });
      }

      setScreenStream(displayStream);
      setCameraStream(camStream);

      const screenVideo = document.createElement('video');
      screenVideo.srcObject = displayStream;
      screenVideo.muted = true;
      await screenVideo.play();

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const screenTrack = displayStream.getVideoTracks()[0];
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
      if (micStream) {
        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(dest);
      }

      const canvasStream = canvas.captureStream(30);
      const audioTracks = dest.stream.getAudioTracks();
      audioTracks.forEach((t) => canvasStream.addTrack(t));

      const recorder = new MediaRecorder(canvasStream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000,
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setStatus('recording');

      const bubbleSize = 160;
      const bubbleX = canvas.width - bubbleSize - 24;
      const bubbleY = 24;
      let keepDrawing = true;

      const draw = () => {
        if (!keepDrawing) return;
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

        if (camStream && faceVideo.readyState >= 2) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(
            bubbleX + bubbleSize / 2,
            bubbleY + bubbleSize / 2,
            bubbleSize / 2 + 4,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = '#1d3557';
          ctx.fill();
          ctx.strokeStyle = '#e63946';
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.clip();
          ctx.drawImage(
            faceVideo,
            bubbleX,
            bubbleY,
            bubbleSize,
            bubbleSize
          );
          ctx.restore();
        }

        if (keepDrawing) requestAnimationFrame(draw);
      };
      draw();

      recorder.onstop = () => {
        keepDrawing = false;
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        setStatus('stopped');
        stopAllStreams();
      };
    } catch (err) {
      console.error('Failed to start recording:', err);
      setStatus('idle');
      stopAllStreams();
    }
  }, [cameraEnabled, micEnabled, status, stopAllStreams]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const downloadRecording = useCallback(() => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boxing-recording-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }, [recordedBlob]);

  const startOver = useCallback(() => {
    setRecordedBlob(null);
    setStatus('idle');
  }, []);

  return (
    <div className="min-h-screen p-6">
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
          Record your screen with optional face camera (Loom-style) and microphone. Share your screen
          with the Boxing Video Analyzer to record annotations too.
        </p>

        {status === 'idle' && (
          <div className="space-y-4 mb-6">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cameraEnabled}
                  onChange={(e) => setCameraEnabled(e.target.checked)}
                  className="rounded accent-ring"
                />
                <span className="text-slate-300">Show face camera bubble</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={micEnabled}
                  onChange={(e) => setMicEnabled(e.target.checked)}
                  className="rounded accent-ring"
                />
                <span className="text-slate-300">Record microphone</span>
              </label>
            </div>
            <button
              type="button"
              onClick={startRecording}
              className="px-6 py-3 rounded-lg bg-ring text-white font-medium hover:bg-red-600 transition-colors"
            >
              Start Recording
            </button>
          </div>
        )}

        {status === 'recording' && (
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-2 text-red-400">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              Recording in progress...
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <button
              type="button"
              onClick={stopRecording}
              className="px-6 py-3 rounded-lg bg-slate-700 text-white hover:bg-slate-600"
            >
              Stop Recording
            </button>
          </div>
        )}

        {status === 'stopped' && recordedBlob && (
          <div className="space-y-4">
            <p className="text-green-400">Recording complete!</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={downloadRecording}
                className="px-6 py-3 rounded-lg bg-accent text-slate-900 font-medium hover:bg-orange-400"
              >
                Download Recording
              </button>
              <button
                type="button"
                onClick={startOver}
                className="px-6 py-3 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
              >
                Record Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
