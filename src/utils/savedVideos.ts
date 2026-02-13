import type { SavedVideo, SavedVideoVersion, Annotation } from '../types';
import { extractYouTubeVideoId } from './youtube';

const STORAGE_KEY = 'boxing-saved-videos';

function normalizeUrlForMatch(url: string): string {
  const id = extractYouTubeVideoId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : url;
}

function migrateFromLegacy(parsed: unknown): SavedVideo[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item: unknown) => {
    const legacy = item as { id?: string; name?: string; youtubeUrl?: string; annotations?: Annotation[]; versions?: unknown[] };
    if (legacy.versions && Array.isArray(legacy.versions)) {
      return item as SavedVideo;
    }
    return {
      id: legacy.id ?? crypto.randomUUID(),
      youtubeUrl: legacy.youtubeUrl ?? '',
      versions: [
        {
          id: crypto.randomUUID(),
          name: legacy.name ?? 'Untitled',
          annotations: legacy.annotations ?? [],
          savedAt: Date.now(),
        },
      ],
    } as SavedVideo;
  });
}

export function getSavedVideos(): SavedVideo[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    const raw = Array.isArray(parsed) ? parsed : [];
    return migrateFromLegacy(raw);
  } catch {
    return [];
  }
}

export function getLatestVersion(video: SavedVideo): SavedVideoVersion {
  const sorted = [...video.versions].sort((a, b) => b.savedAt - a.savedAt);
  return sorted[0];
}

export function getBaseNameAndNextVersion(video: SavedVideo): { baseName: string; nextName: string } {
  const latest = getLatestVersion(video);
  const baseName = latest.name.replace(/\.\d+$/, '').trim() || latest.name;
  const versions = video.versions;
  let maxN = 0;
  for (const v of versions) {
    const m = v.name.match(/\.(\d+)$/);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  const nextN = maxN + 1;
  return { baseName, nextName: `${baseName}.${nextN}` };
}

export function saveVideo(video: {
  name: string;
  youtubeUrl: string;
  annotations: Annotation[];
}): SavedVideo {
  const normalized = normalizeUrlForMatch(video.youtubeUrl);
  const list = getSavedVideos();
  const existing = list.find((v) => normalizeUrlForMatch(v.youtubeUrl) === normalized);

  const newVersion: SavedVideoVersion = {
    id: crypto.randomUUID(),
    name: video.name,
    annotations: video.annotations,
    savedAt: Date.now(),
  };

  if (existing) {
    existing.versions.unshift(newVersion);
    existing.youtubeUrl = video.youtubeUrl;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      throw new Error('Failed to save video');
    }
    return existing;
  }

  const saved: SavedVideo = {
    id: crypto.randomUUID(),
    youtubeUrl: video.youtubeUrl,
    versions: [newVersion],
  };
  list.unshift(saved);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    throw new Error('Failed to save video');
  }
  return saved;
}

export function deleteSavedVideo(id: string): void {
  const list = getSavedVideos().filter((v) => v.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export function deleteSavedVideoVersion(videoId: string, versionId: string): void {
  const list = getSavedVideos();
  const video = list.find((v) => v.id === videoId);
  if (!video) return;
  video.versions = video.versions.filter((v) => v.id !== versionId);
  if (video.versions.length === 0) {
    deleteSavedVideo(videoId);
  } else {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Ignore
    }
  }
}
