import { Composition } from 'remotion';

import { episodes, SayNicer, sayNicerLength } from './SayNicer';

/** «Скажи гарніше»: one 9:16 Composition per episode, `SayNicer`, `SayNicer2`, … */
export function SayNicerCompositions() {
  return (
    <>
      {episodes.map((_, episode) => (
        <Composition
          key={episode}
          id={episode === 0 ? 'SayNicer' : `SayNicer${episode + 1}`}
          component={SayNicer}
          defaultProps={{ episode }}
          durationInFrames={sayNicerLength}
          fps={30}
          width={1080}
          height={1920}
        />
      ))}
    </>
  );
}
