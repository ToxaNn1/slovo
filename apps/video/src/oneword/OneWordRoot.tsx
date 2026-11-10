import { Composition } from 'remotion';

import { episodes, OneWord, oneWordLength } from './OneWord';

/** «Одним словом»: a description shouted into one word. One Composition per episode: OneWord, OneWord2, … */
export function OneWordCompositions() {
  return (
    <>
      {episodes.map((_, episode) => (
        <Composition
          key={episode}
          id={episode === 0 ? 'OneWord' : `OneWord${episode + 1}`}
          component={OneWord}
          defaultProps={{ episode }}
          durationInFrames={oneWordLength}
          fps={30}
          width={1080}
          height={1920}
        />
      ))}
    </>
  );
}
