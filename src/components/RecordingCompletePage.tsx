import { useRef, useEffect, useState } from 'react';
import { useRecording, formatDuration } from '../context/RecordingContext';
import { convertWebmToMp4 } from '../utils/convertToMp4';

interface RecordingCompletePageProps {
  onClose: () => void;
}

function canPlayWebM(): boolean {
  const v = document.createElement('video');
  return v.canPlayType('video/webm; codecs="vp8,vp9"') !== '';
}

export default function RecordingCompletePage({ onClose }: RecordingCompletePageProps) {
  const { recording, dismissRecording } = useRecording();
  const { blob, duration } = recording;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  const handleClose = () => {
    dismissRecording();
    onClose();
  };

  const handleDownload = async () => {
    if (!blob) return;
    setConvertError(null);
    try {
      let downloadBlob = blob;
      let ext = 'webm';
      if (blob.type.includes('webm')) {
        setConverting(true);
        try {
          downloadBlob = await convertWebmToMp4(blob);
          ext = 'mp4';
        } catch (err) {
          setConvertError(err instanceof Error ? err.message : 'Conversion failed');
          return;
        } finally {
          setConverting(false);
        }
      } else if (blob.type.includes('mp4')) {
        ext = 'mp4';
      }
      const url = URL.createObjectURL(downloadBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boxing-recording-${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  useEffect(() => {
    if (!blob) return;
    let cancelled = false;
    if (blob.type.includes('webm') && !canPlayWebM()) {
      setPreviewLoading(true);
      convertWebmToMp4(blob)
        .then((mp4Blob) => {
          if (cancelled) return;
          const url = URL.createObjectURL(mp4Blob);
          setPreviewUrl(url);
          setPreviewLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setPreviewUrl(URL.createObjectURL(blob));
          setPreviewLoading(false);
        });
    } else {
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewLoading(false);
    }
    return () => {
      cancelled = true;
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [blob]);

  if (!blob) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/98 flex flex-col overflow-auto">
      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-0">
        <h2 className="text-2xl font-display tracking-wider text-white mb-2">
          Recording Complete
        </h2>
        <p className="text-slate-400 mb-6">Duration: {formatDuration(duration)}</p>

        <div className="w-full max-w-4xl min-h-[300px] aspect-video bg-black rounded-xl overflow-hidden border border-slate-600 mb-6 flex-shrink-0">
          {previewLoading ? (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              Preparing preview...
            </div>
          ) : previewUrl ? (
            <video
              ref={videoRef}
              src={previewUrl}
              controls
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              No preview available
            </div>
          )}
        </div>

        {convertError && (
          <p className="text-red-400 text-sm mb-2">{convertError}</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={converting}
            className="px-6 py-3 rounded-lg bg-accent text-slate-900 font-medium hover:bg-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {converting ? 'Converting to MP4...' : 'Download as MP4'}
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
