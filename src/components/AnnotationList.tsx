import type { Annotation } from '../types';

interface AnnotationListProps {
  annotations: Annotation[];
  onUpdate: (id: string, updates: Partial<Annotation>) => void;
  onDelete: (id: string) => void;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AnnotationList({ annotations, onUpdate, onDelete }: AnnotationListProps) {
  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {annotations.length === 0 ? (
        <p className="text-slate-500 text-sm py-4">No annotations yet. Use the tools above to add some.</p>
      ) : (
        annotations.map((a) =>
          a.type === 'clear' ? (
            <div
              key={a.id}
              className="flex items-center gap-2 p-2 rounded bg-slate-800/80 border border-slate-600 border-dashed"
            >
              <div className="w-4 h-4 rounded flex-shrink-0 bg-slate-600 flex items-center justify-center text-slate-400 text-xs">
                ⊘
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-slate-400 text-sm">Clear screen</span>
                <div className="text-slate-500 text-xs mt-1">{formatTime(a.startTime)}</div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(a.id)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                ×
              </button>
            </div>
          ) : (
            <div
              key={a.id}
              className="flex items-center gap-2 p-2 rounded bg-slate-800/80 border border-slate-700"
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: a.color }}
              />
              <div className="flex-1 min-w-0">
                <span className="text-slate-300 text-sm capitalize">{a.type}</span>
                <div className="flex gap-2 items-center mt-1">
                  <span className="text-slate-500 text-xs">
                    {formatTime(a.startTime)} → {formatTime(a.endTime)}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={Math.round(a.endTime - a.startTime)}
                    onChange={(e) => {
                      const dur = Number(e.target.value);
                      if (dur > 0) onUpdate(a.id, { endTime: a.startTime + dur });
                    }}
                    className="w-14 px-1 py-0.5 text-xs bg-slate-700 rounded text-white"
                  />
                  <span className="text-slate-500 text-xs">sec</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(a.id)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                ×
              </button>
            </div>
          )
        )
      )}
    </div>
  );
}
