import { useState, useRef, useEffect } from 'react';
import { extractYouTubeVideoId } from '../utils/youtube';
import { getRecentUrls, addRecentUrl } from '../utils/recentUrls';
import { getSavedVideos, deleteSavedVideo, deleteSavedVideoVersion, getLatestVersion } from '../utils/savedVideos';
import type { VideoSource, Annotation, SavedVideo, SavedVideoVersion } from '../types';

export interface VideoLoadOptions {
  annotations?: Annotation[];
  autoPlay?: boolean;
  savedVideoId?: string;
}

interface VideoUploaderProps {
  onVideoLoaded: (source: VideoSource, options?: VideoLoadOptions) => void;
}

export default function VideoUploader({ onVideoLoaded }: VideoUploaderProps) {
  const [inputMode, setInputMode] = useState<'file' | 'url'>('file');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [error, setError] = useState('');
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const [savedVideos, setSavedVideos] = useState(getSavedVideos());
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecentUrls(getRecentUrls());
  }, []);

  const refreshSavedVideos = () => setSavedVideos(getSavedVideos());

  const handleLoadSaved = (video: SavedVideo, version: SavedVideoVersion) => {
    const videoId = extractYouTubeVideoId(video.youtubeUrl);
    if (!videoId) return;
    onVideoLoaded(
      { type: 'youtube', videoId, url: video.youtubeUrl },
      { annotations: version.annotations, autoPlay: true, savedVideoId: video.id }
    );
  };

  const handleDeleteSaved = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSavedVideo(id);
    refreshSavedVideos();
  };

  const handleDeleteVersion = (e: React.MouseEvent, videoId: string, versionId: string) => {
    e.stopPropagation();
    deleteSavedVideoVersion(videoId, versionId);
    refreshSavedVideos();
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file (mp4, webm, etc.)');
      return;
    }
    setError('');
    const url = URL.createObjectURL(file);
    onVideoLoaded({ type: 'file', url, file });
  };

  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = youtubeUrl.trim();
    const videoId = extractYouTubeVideoId(trimmed);
    if (!videoId) {
      setError('Invalid YouTube URL. Use formats like: youtube.com/watch?v=... or youtu.be/...');
      return;
    }
    setError('');
    addRecentUrl(trimmed);
    setRecentUrls(getRecentUrls());
    onVideoLoaded({ type: 'youtube', videoId, url: trimmed }, { autoPlay: true });
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h2 className="font-display text-4xl text-center mb-2 tracking-wider text-white">
        LOAD VIDEO
      </h2>
      <p className="text-slate-400 text-center mb-8">
        Import a video file or paste a YouTube link to get started
      </p>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => { setInputMode('file'); setError(''); }}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
            inputMode === 'file'
              ? 'bg-ring text-white'
              : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Upload File
        </button>
        <button
          type="button"
          onClick={() => { setInputMode('url'); setError(''); }}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
            inputMode === 'url'
              ? 'bg-ring text-white'
              : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
          }`}
        >
          YouTube URL
        </button>
      </div>

      {inputMode === 'file' ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-500 rounded-xl p-12 text-center cursor-pointer hover:border-accent hover:bg-slate-800/30 transition-all"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="text-5xl mb-4">📹</div>
          <p className="text-slate-300 mb-1">Click to select a video file</p>
          <p className="text-slate-500 text-sm">MP4, WebM, MOV supported</p>
        </div>
      ) : (
        <form onSubmit={handleYoutubeSubmit} className="space-y-4">
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-ring text-white font-medium hover:bg-red-600 transition-colors"
          >
            Load Video
          </button>
        </form>
      )}

      {inputMode === 'url' && recentUrls.length > 0 && (
        <div className="mt-4">
          <p className="text-slate-500 text-sm mb-2">Recent videos</p>
          <div className="flex flex-wrap gap-2">
            {recentUrls.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => {
                  setYoutubeUrl(url);
                  setError('');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-700/80 text-slate-300 hover:bg-slate-600 hover:text-white text-sm truncate max-w-[320px]"
                title={url}
              >
                {url.length > 50 ? `${url.slice(0, 47)}...` : url}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 text-red-400 text-sm text-center">{error}</p>
      )}

      {savedVideos.length > 0 && (
        <div className="mt-10 pt-8 border-t border-slate-700">
          <h3 className="font-display text-xl text-slate-300 mb-3 tracking-wider">SAVED VIDEOS</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {savedVideos.map((video) => {
              const latest = getLatestVersion(video);
              const isExpanded = expandedVideoId === video.id;
              const hasMultipleVersions = video.versions.length > 1;
              return (
                <div
                  key={video.id}
                  className="rounded-lg bg-slate-800/80 border border-slate-600 overflow-hidden"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleLoadSaved(video, latest)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLoadSaved(video, latest)}
                    className="flex items-center justify-between gap-3 p-3 hover:bg-slate-700/80 cursor-pointer transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 font-medium truncate">{latest.name}</p>
                      <p className="text-slate-500 text-xs truncate mt-0.5">{video.youtubeUrl}</p>
                      <p className="text-slate-500 text-xs mt-1">
                        {latest.annotations.length} annotation{latest.annotations.length !== 1 ? 's' : ''}
                        {hasMultipleVersions && (
                          <span className="ml-2">· {video.versions.length} version{video.versions.length !== 1 ? 's' : ''}</span>
                        )}
                      </p>
                    </div>
                    {video.versions.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedVideoId(isExpanded ? null : video.id);
                        }}
                        className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-600"
                        title={isExpanded ? 'Collapse versions' : 'Show versions'}
                      >
                        <svg
                          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSaved(e, video.id)}
                      className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete saved video"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-slate-600 bg-slate-900/50">
                      {video.versions.map((version) => (
                        <div
                          key={version.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleLoadSaved(video, version)}
                          onKeyDown={(e) => e.key === 'Enter' && handleLoadSaved(video, version)}
                          className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-700/50 cursor-pointer border-b border-slate-700/50 last:border-b-0 group/version"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-300 text-sm truncate">{version.name}</p>
                            <p className="text-slate-500 text-xs mt-0.5">
                              {version.annotations.length} annotations · {formatDate(version.savedAt)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteVersion(e, video.id, version.id)}
                            className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-600 opacity-0 group-hover/version:opacity-100 transition-opacity flex-shrink-0"
                            title="Delete this version"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
