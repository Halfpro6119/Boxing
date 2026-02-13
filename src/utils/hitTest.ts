import type { Annotation } from '../types';

const ERASER_HIT_MARGIN_PX = 15;

function pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function pointToPathDistance(px: number, py: number, points: { x: number; y: number }[]): number {
  let minDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = pointToLineDistance(px, py, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    minDist = Math.min(minDist, d);
  }
  return minDist;
}

export function hitTestAnnotation(
  pointNorm: { x: number; y: number },
  annotation: Annotation,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number
): boolean {
  if (annotation.type === 'clear') return false;
  if (currentTime < annotation.startTime || currentTime > annotation.endTime) return false;

  const { x, y } = pointNorm;
  const minDim = Math.min(canvasWidth, canvasHeight) || 1;
  const margin = (ERASER_HIT_MARGIN_PX + annotation.strokeWidth) / minDim;

  if (annotation.type === 'arrow' && annotation.points.length >= 2) {
    const [p1, p2] = annotation.points;
    const d = pointToLineDistance(x, y, p1.x, p1.y, p2.x, p2.y);
    return d <= margin;
  }

  if (annotation.type === 'circle' && annotation.points.length >= 2) {
    const [c, p] = annotation.points;
    const r = Math.hypot(p.x - c.x, p.y - c.y);
    const dist = Math.hypot(x - c.x, y - c.y);
    return Math.abs(dist - r) <= margin || dist <= r + margin;
  }

  if (annotation.type === 'rectangle' && annotation.points.length >= 2) {
    const [p1, p2] = annotation.points;
    const minX = Math.min(p1.x, p2.x) - margin;
    const maxX = Math.max(p1.x, p2.x) + margin;
    const minY = Math.min(p1.y, p2.y) - margin;
    const maxY = Math.max(p1.y, p2.y) + margin;
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  }

  if (annotation.type === 'draw' && annotation.points.length >= 2) {
    const d = pointToPathDistance(x, y, annotation.points);
    return d <= margin;
  }

  if (annotation.type === 'text' && annotation.points.length >= 1) {
    const p = annotation.points[0];
    const approxWidthNorm = ((annotation.text?.length ?? 0) * (annotation.strokeWidth * 3)) / canvasWidth;
    const approxHeightNorm = (annotation.strokeWidth * 5) / canvasHeight;
    return (
      x >= p.x - margin &&
      x <= p.x + approxWidthNorm + margin &&
      y >= p.y - approxHeightNorm &&
      y <= p.y + margin
    );
  }

  return false;
}

export function findAnnotationAtPoint(
  point: { x: number; y: number },
  annotations: Annotation[],
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number
): Annotation | null {
  const pointNorm = {
    x: point.x / (canvasWidth || 1),
    y: point.y / (canvasHeight || 1),
  };
  for (let i = annotations.length - 1; i >= 0; i--) {
    if (hitTestAnnotation(pointNorm, annotations[i], currentTime, canvasWidth, canvasHeight)) {
      return annotations[i];
    }
  }
  return null;
}
