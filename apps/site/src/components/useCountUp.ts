import { useEffect, useState } from 'react';

import { countAt } from '../goal';

const DURATION = 1800;

/**
 * The count shown while it counts up to `confirmed` once after load; under
 * reduced motion, and before the island hydrates, the final count at once.
 */
export function useCountUp(confirmed: number): number {
  const [shown, setShown] = useState(confirmed);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = (now - start) / DURATION;
      setShown(countAt(confirmed, progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [confirmed]);
  return shown;
}
