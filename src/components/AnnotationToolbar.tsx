import type { AnnotationType } from '../types';

interface AnnotationToolbarProps {
  activeTool: AnnotationType;
  onToolChange: (tool: AnnotationType) => void;
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (w: number) => void;
  onClearAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const TOOLS: { type: AnnotationType; label: string; icon: string }[] = [
  { type: 'arrow', label: 'Arrow', icon: '→' },
  { type: 'circle', label: 'Circle', icon: '○' },
  { type: 'rectangle', label: 'Rectangle', icon: '▭' },
  { type: 'draw', label: 'Draw', icon: '✎' },
  { type: 'text', label: 'Text', icon: 'T' },
  { type: 'eraser', label: 'Eraser', icon: '⌫' },
];

const COLORS = ['#e63946', '#f4a261', '#2a9d8f', '#264653', '#e9c46a', '#ffffff'];

export default function AnnotationToolbar({
  activeTool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  onClearAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: AnnotationToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-3 bg-slate-900/90 rounded-lg border border-slate-700">
      <div className="flex gap-1 items-center">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="w-10 h-10 rounded flex items-center justify-center text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="w-10 h-10 rounded flex items-center justify-center text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white"
        >
          ↷
        </button>
        <span className="w-px h-6 bg-slate-600 mx-1" />
        {TOOLS.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => onToolChange(t.type)}
            title={t.label}
            className={`w-10 h-10 rounded flex items-center justify-center text-lg transition-all ${
              activeTool === t.type
                ? 'bg-ring text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>
      {activeTool !== 'eraser' && (
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">Color:</span>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onColorChange(c)}
            className={`w-6 h-6 rounded-full border-2 transition-transform ${
              color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      )}
      {activeTool !== 'eraser' && (
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">Size:</span>
        <input
          type="range"
          min={1}
          max={8}
          value={strokeWidth}
          onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
          className="w-24 accent-ring"
        />
        <span className="text-slate-400 text-xs">{strokeWidth}px</span>
      </div>
      )}
      <button
        type="button"
        onClick={onClearAll}
        className="px-3 py-1.5 rounded bg-slate-700 text-slate-400 hover:bg-red-900/50 hover:text-red-400 text-sm"
      >
        Clear All
      </button>
    </div>
  );
}
