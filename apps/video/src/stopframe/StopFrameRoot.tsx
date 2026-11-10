import { Composition } from 'remotion';

import '../look';
import { StopFrame, stopFrameLength } from './StopFrame';

/** «Стоп-кадр»: pause the flicking card and get a word. One Composition per episode, 9:16. */
export function StopFrameCompositions() {
  return (
    <>
      <Composition id="StopFrame" component={StopFrame} defaultProps={{ episode: 0 }} durationInFrames={stopFrameLength} fps={30} width={1080} height={1920} />
      <Composition id="StopFrame2" component={StopFrame} defaultProps={{ episode: 1 }} durationInFrames={stopFrameLength} fps={30} width={1080} height={1920} />
    </>
  );
}
