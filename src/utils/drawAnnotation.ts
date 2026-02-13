import type { Annotation } from '../types';

export function drawAnnotationOnContext(
  ctx: CanvasRenderingContext2D,
  a: Annotation,
  scaleX: number,
  scaleY: number
) {
  if (a.type === 'clear') return;
  const scale = Math.min(scaleX, scaleY) / 400;
  ctx.strokeStyle = a.color;
  ctx.fillStyle = a.color;
  ctx.lineWidth = a.strokeWidth * scale;

  const scalePoint = (p: { x: number; y: number }) => ({
    x: p.x * scaleX,
    y: p.y * scaleY,
  });

  if (a.type === 'arrow' && a.points.length >= 2) {
    const [p1, p2] = a.points.map(scalePoint);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const arrowLen = 15 * scale;
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - arrowLen * Math.cos(angle - 0.4), p2.y - arrowLen * Math.sin(angle - 0.4));
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - arrowLen * Math.cos(angle + 0.4), p2.y - arrowLen * Math.sin(angle + 0.4));
    ctx.stroke();
  } else if (a.type === 'circle' && a.points.length >= 2) {
    const [c, p] = a.points.map(scalePoint);
    const r = Math.hypot(p.x - c.x, p.y - c.y);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (a.type === 'rectangle' && a.points.length >= 2) {
    const [p1, p2] = a.points.map(scalePoint);
    ctx.strokeRect(
      Math.min(p1.x, p2.x),
      Math.min(p1.y, p2.y),
      Math.abs(p2.x - p1.x),
      Math.abs(p2.y - p1.y)
    );
  } else if (a.type === 'draw' && a.points.length >= 2) {
    const pts = a.points.map(scalePoint);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  } else if (a.type === 'text' && a.text) {
    ctx.font = `${a.strokeWidth * 4 * scale}px sans-serif`;
    const p = scalePoint(a.points[0]);
    ctx.fillText(a.text, p.x, p.y);
  }
}
