const STORAGE_KEY = 'boxing-recent-video-urls';
const MAX_RECENT = 5;

export function getRecentUrls(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function addRecentUrl(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) return;

  const urls = getRecentUrls();
  const filtered = urls.filter((u) => u !== trimmed);
  const updated = [trimmed, ...filtered].slice(0, MAX_RECENT);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}
