import { Composition } from 'remotion';

import '../look';
import { Week, weekLength } from './Week';

/** «7 днів — 7 слів»: the whole week, and the weekdays' cut with more time for every word. */
export function WeekCompositions() {
  return (
    <>
      <Composition
        id="Week"
        component={Week}
        defaultProps={{ episode: 0, count: 7 as const }}
        durationInFrames={weekLength}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="WeekAlt"
        component={Week}
        defaultProps={{ episode: 0, count: 5 as const }}
        durationInFrames={weekLength}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
}
