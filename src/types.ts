export type AnnotationType = 'arrow' | 'circle' | 'rectangle' | 'draw' | 'text' | 'eraser' | 'clear';

export interface Point {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  type: AnnotationType;
  points: Point[];
  startTime: number; // seconds
  endTime: number;   // seconds - how long the annotation lasts
  color: string;
  strokeWidth: number;
  text?: string;
}

export type VideoSource = 
  | { type: 'file'; url: string; file?: File | null; youtubeUrl?: string }
  | { type: 'youtube'; videoId: string; url: string };

export interface SavedVideoVersion {
  id: string;
  name: string;
  annotations: Annotation[];
  savedAt: number;
}

export interface SavedVideo {
  id: string;
  youtubeUrl: string;
  versions: SavedVideoVersion[];
}
