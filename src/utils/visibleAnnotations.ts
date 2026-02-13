import type { Annotation } from '../types';

/**
 * Returns annotations that are visible at the given time, respecting "clear" actions.
 * A clear action clears the screen of all prior annotations from that moment onward.
 * Only annotations that come after the most recent clear (in array order) and are
 * within their time range are shown.
 */
export function getVisibleAnnotations(annotations: Annotation[], currentTime: number): Annotation[] {
  let lastClearIndex = -1;
  for (let i = 0; i < annotations.length; i++) {
    const a = annotations[i];
    if (a.type === 'clear' && currentTime >= a.startTime) {
      lastClearIndex = i;
    }
  }

  return annotations.filter((a, i) => {
    if (a.type === 'clear') return false;
    if (i <= lastClearIndex) return false;
    return currentTime >= a.startTime && currentTime <= a.endTime;
  });
}
