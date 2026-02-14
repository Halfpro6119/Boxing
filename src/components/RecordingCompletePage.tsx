import { useEffect, useRef, useState } from 'react';
import { useRecording, formatDuration } from '../context/RecordingContext';
import { convertWebmToMp4 } from '../utils/convertToMp4';

interface RecordingCompletePageProps {
  onClose: () => void;
}

export default function RecordingCompletePage({ onClose }: RecordingCompletePageProps) {
  const { recording, dismissRecording } = useRecording();
  const { blob, duration } = recording;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<'mp4' | 'webm' | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const webmUrlRef = useRef<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const handleClose = () => {
    dismissRecording();
    onClose();
  };

  const handleDownload = async (asWebM = false) => {
    if (!blob) return;
    setConvertError(null);
    try {
      let downloadBlob = blob;
      let ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      if (blob.type.includes('webm') && !asWebM) {
        setConverting(true);
        try {
          downloadBlob = await convertWebmToMp4(blob);
          ext = 'mp4';
        } catch (err) {
          setConvertError(err instanceof Error ? err.message : 'Conversion failed. Try "Download as WebM".');
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
    if (!blob || blob.size < 256) {
      setPreviewLoading(false);
      setPreviewUrl(null);
      setVideoError(
        !blob || blob.size === 0
          ? 'Recording produced no data.'
          : 'Recording is too short to preview.'
      );
      return;
    }
    blobRef.current = blob;
    setVideoError(null);
    setPreviewSource(null);
    if (webmUrlRef.current) {
      URL.revokeObjectURL(webmUrlRef.current);
      webmUrlRef.current = null;
    }
    let cancelled = false;
    const blobForThisRun = blob;
    const applyPreview = (url: string, source: 'mp4' | 'webm') => {
      if (cancelled) return;
      if (blobRef.current !== blobForThisRun) return;
      setPreviewUrl(url);
      setPreviewSource(source);
      setPreviewLoading(false);
    };
    const isWebM = !blob.type || blob.type.includes('webm') || blob.type.includes('matroska');
    if (isWebM) {
      setPreviewLoading(true);
      setPreviewUrl(null);
      const fallbackUrl = URL.createObjectURL(blob);
      webmUrlRef.current = fallbackUrl;
      convertWebmToMp4(blob)
        .then((mp4Blob) => {
          if (cancelled) return;
          if (blobRef.current !== blobForThisRun) return;
          if (webmUrlRef.current) {
            URL.revokeObjectURL(webmUrlRef.current);
            webmUrlRef.current = null;
          }
          applyPreview(URL.createObjectURL(mp4Blob), 'mp4');
        })
        .catch(() => {
          if (cancelled) return;
          if (blobRef.current !== blobForThisRun) return;
          applyPreview(fallbackUrl, 'webm');
        });
    } else {
      applyPreview(URL.createObjectURL(blob), 'mp4');
    }
    return () => {
      cancelled = true;
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (webmUrlRef.current) {
        URL.revokeObjectURL(webmUrlRef.current);
        webmUrlRef.current = null;
      }
    };
  }, [blob, retryKey]);

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
              preload="auto"
              onError={(e) => {
                if (previewSource === 'webm') {
                  setPreviewUrl(null);
                  setPreviewSource(null);
                  setVideoError('Preview not available for this recording. You can still download it below.');
                } else {
                  setVideoError(e.currentTarget.error?.message || 'Video failed to load');
                }
              }}
              onLoadedData={(e) => {
                e.currentTarget.play().catch(() => {});
              }}
              className="w-full h-full object-contain"
              style={{ minWidth: 320, minHeight: 180 }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-slate-400 p-4 text-center">
              <span>No preview available</span>
              <span className="text-sm text-slate-500">You can still download the recording below.</span>
              <button
                type="button"
                onClick={() => setRetryKey((k) => k + 1)}
                className="px-4 py-2 rounded-lg bg-slate-600 text-slate-200 hover:bg-slate-500 text-sm"
              >
                Retry preview
              </button>
            </div>
          )}
        </div>

        {(convertError || videoError) && (
          <p className="text-red-400 text-sm mb-2">{convertError || videoError}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleDownload(false)}
            disabled={converting}
            className="px-6 py-3 rounded-lg bg-accent text-slate-900 font-medium hover:bg-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {converting ? 'Converting to MP4...' : 'Download as MP4'}
          </button>
          {(!blob?.type || blob?.type.includes('webm') || blob?.type.includes('matroska')) && (
            <button
              type="button"
              onClick={() => handleDownload(true)}
              disabled={converting}
              className="px-6 py-3 rounded-lg bg-slate-600 text-slate-200 hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Download as WebM
            </button>
          )}
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
