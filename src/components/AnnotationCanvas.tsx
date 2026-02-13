import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { Annotation, Point, AnnotationType } from '../types';
import { findAnnotationAtPoint } from '../utils/hitTest';
import { getVisibleAnnotations } from '../utils/visibleAnnotations';
import { normalizePoint, denormalizePoint } from '../utils/annotationCoords';

interface AnnotationCanvasProps {
  width: number;
  height: number;
  annotations: Annotation[];
  currentTime: number;
  activeTool: AnnotationType;
  color: string;
  strokeWidth: number;
  onAnnotationAdd: (annotation: Annotation) => void;
  onAnnotationDelete: (id: string) => void;
  isDrawing: boolean;
  onDrawingChange: (drawing: boolean) => void;
  className?: string;
}

export default function AnnotationCanvas({
  width,
  height,
  annotations,
  currentTime,
  activeTool,
  color,
  strokeWidth,
  onAnnotationAdd,
  onAnnotationDelete,
  isDrawing,
  onDrawingChange,
  className = '',
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [textInput, setTextInput] = useState<{ point: Point; visible: boolean } | null>(null);

  const getCanvasPoint = useCallback((e: React.MouseEvent | React.PointerEvent | MouseEvent | PointerEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const visibleAnnotations = useMemo(
    () => getVisibleAnnotations(annotations, currentTime),
    [annotations, currentTime]
  );

  const drawAnnotation = useCallback(
    (ctx: CanvasRenderingContext2D, a: Annotation, alpha = 1) => {
      if (a.type === 'clear') return;
      if (currentTime < a.startTime || currentTime > a.endTime) return;
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = a.strokeWidth;
      ctx.globalAlpha = alpha;

      const toPx = (p: Point) => denormalizePoint(p, width, height);

      if (a.type === 'arrow') {
        if (a.points.length >= 2) {
          const [p1, p2] = a.points.map(toPx);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const arrowLen = 15;
          ctx.moveTo(p2.x, p2.y);
          ctx.lineTo(p2.x - arrowLen * Math.cos(angle - 0.4), p2.y - arrowLen * Math.sin(angle - 0.4));
          ctx.moveTo(p2.x, p2.y);
          ctx.lineTo(p2.x - arrowLen * Math.cos(angle + 0.4), p2.y - arrowLen * Math.sin(angle + 0.4));
          ctx.stroke();
        }
      } else if (a.type === 'circle') {
        if (a.points.length >= 2) {
          const [c, p] = a.points.map(toPx);
          const r = Math.hypot(p.x - c.x, p.y - c.y);
          ctx.beginPath();
          ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (a.type === 'rectangle') {
        if (a.points.length >= 2) {
          const [p1, p2] = a.points.map(toPx);
          ctx.strokeRect(
            Math.min(p1.x, p2.x),
            Math.min(p1.y, p2.y),
            Math.abs(p2.x - p1.x),
            Math.abs(p2.y - p1.y)
          );
        }
      } else if (a.type === 'draw' && a.points.length >= 2) {
        const pts = a.points.map(toPx);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      } else if (a.type === 'text' && a.text) {
        ctx.font = `${a.strokeWidth * 4}px sans-serif`;
        const p = toPx(a.points[0]);
        ctx.fillText(a.text, p.x, p.y);
      }
      ctx.globalAlpha = 1;
    },
    [currentTime, width, height]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    visibleAnnotations.forEach((a) => drawAnnotation(ctx, a));

    if (isDrawing && currentPoints.length > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      if (activeTool === 'arrow' && currentPoints.length >= 2) {
        const [p1, p2] = currentPoints;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const arrowLen = 15;
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p2.x - arrowLen * Math.cos(angle - 0.4), p2.y - arrowLen * Math.sin(angle - 0.4));
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p2.x - arrowLen * Math.cos(angle + 0.4), p2.y - arrowLen * Math.sin(angle + 0.4));
        ctx.stroke();
      } else if (activeTool === 'circle' && currentPoints.length >= 2) {
        const [c, p] = currentPoints;
        const r = Math.hypot(p.x - c.x, p.y - c.y);
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (activeTool === 'rectangle' && currentPoints.length >= 2) {
        const [p1, p2] = currentPoints;
        ctx.strokeRect(
          Math.min(p1.x, p2.x),
          Math.min(p1.y, p2.y),
          Math.abs(p2.x - p1.x),
          Math.abs(p2.y - p1.y)
        );
      } else if (activeTool === 'draw' && currentPoints.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
        for (let i = 1; i < currentPoints.length; i++) {
          ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
        }
        ctx.stroke();
      }
    }
  }, [visibleAnnotations, currentTime, isDrawing, currentPoints, activeTool, color, strokeWidth, width, height, drawAnnotation]);

  const finishAnnotation = useCallback((points: Point[], text?: string) => {
    if (points.length === 0) return;
    const duration = 60;
    const normalizedPoints = points.map((p) => normalizePoint(p, width, height));
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      type: activeTool,
      points: normalizedPoints,
      startTime: currentTime,
      endTime: currentTime + duration,
      color,
      strokeWidth,
      text,
    };
    onAnnotationAdd(annotation);
    setStartPoint(null);
    setCurrentPoints([]);
    setTextInput(null);
    onDrawingChange(false);
  }, [activeTool, color, strokeWidth, currentTime, onAnnotationAdd, onDrawingChange, width, height]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const p = getCanvasPoint(e);
    if (activeTool === 'eraser') {
      const hit = findAnnotationAtPoint(p, visibleAnnotations, currentTime, width, height);
      if (hit) onAnnotationDelete(hit.id);
      return;
    }
    if (activeTool === 'text') {
      setTextInput({ point: p, visible: true });
      return;
    }
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    setStartPoint(p);
    setCurrentPoints([p]);
    onDrawingChange(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !startPoint) return;
    const p = getCanvasPoint(e);
    if (activeTool === 'draw') {
      setCurrentPoints((prev) => [...prev, p]);
    } else {
      setCurrentPoints([startPoint, p]);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore if we didn't have capture */
    }
    if (activeTool === 'text') return;
    if (startPoint && currentPoints.length > 0) {
      finishAnnotation(currentPoints);
    }
  };

  const handleTextSubmit = (text: string) => {
    if (textInput && text.trim()) {
      finishAnnotation([textInput.point], text.trim());
    }
    setTextInput(null);
  };

  return (
    <>
      <div
        className={`absolute inset-0 z-[100] ${className}`}
        style={{ pointerEvents: 'auto', touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`absolute inset-0 w-full h-full block ${activeTool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'}`}
          style={{ pointerEvents: 'auto', touchAction: 'none' }}
        />
      </div>
      {textInput?.visible && (
        <div
          className="absolute z-[110] bg-slate-800 border border-slate-600 rounded p-2 shadow-xl"
          style={{ left: textInput.point.x + 10, top: textInput.point.y }}
        >
          <input
            type="text"
            autoFocus
            placeholder="Enter text..."
            className="bg-transparent text-white outline-none w-48"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTextSubmit((e.target as HTMLInputElement).value);
              if (e.key === 'Escape') setTextInput(null);
            }}
            onBlur={(e) => {
              const v = (e.target as HTMLInputElement).value;
              if (v) handleTextSubmit(v);
              else setTextInput(null);
            }}
          />
        </div>
      )}
    </>
  );
}
