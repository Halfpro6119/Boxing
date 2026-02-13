import type { Annotation, Point } from '../types';

/** Normalize a point from canvas pixels to 0-1 range */
export function normalizePoint(p: Point, width: number, height: number): Point {
  if (width <= 0 || height <= 0) return p;
  return { x: p.x / width, y: p.y / height };
}

/** Denormalize a point from 0-1 range to canvas pixels */
export function denormalizePoint(p: Point, width: number, height: number): Point {
  return { x: p.x * width, y: p.y * height };
}

/** Check if annotation points appear to be in pixel space (legacy) */
function isLegacyPixelCoords(a: Annotation): boolean {
  for (const p of a.points) {
    if (p.x > 1 || p.y > 1) return true;
  }
  return false;
}

const LEGACY_CANVAS_WIDTH = 640;
const LEGACY_CANVAS_HEIGHT = 360;

/** Normalize annotation points to 0-1 range. Migrates legacy pixel coords. */
export function normalizeAnnotation(a: Annotation, width?: number, height?: number): Annotation {
  if (a.type === 'clear' || a.points.length === 0) return a;
  const w = width ?? LEGACY_CANVAS_WIDTH;
  const h = height ?? LEGACY_CANVAS_HEIGHT;
  const needsMigration = isLegacyPixelCoords(a);
  return {
    ...a,
    points: a.points.map((p) =>
      needsMigration ? normalizePoint(p, w, h) : p
    ),
  };
}

/** Normalize all annotations for display */
export function normalizeAnnotations(
  annotations: Annotation[],
  width?: number,
  height?: number
): Annotation[] {
  return annotations.map((a) => normalizeAnnotation(a, width, height));
}
