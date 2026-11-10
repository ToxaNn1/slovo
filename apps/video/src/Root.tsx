import { Composition } from 'remotion';

import { Board, boardLength } from './board/Board';
import { FindMistake, findMistakeLength } from './fix/FindMistake';
import './look';
import { Promo, promoLength } from './promo/Promo';
import { PromoSocial, promoSocialLength } from './promo/PromoSocial';
import { Bundiuchnyi } from './series/Bundiuchnyi';
import { beats } from './series/Missing';
import { Stress, stressLength } from './stress/Stress';

export function Root() {
  return (
    <>
      <Composition id="Promo" component={Promo} durationInFrames={promoLength} fps={30} width={1920} height={1080} />
      {/* The same promo for Reels and TikTok: every scene lays itself out for 9:16. */}
      <Composition
        id="PromoVertical"
        component={Promo}
        durationInFrames={promoLength}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* The 15 s cut for Reels and TikTok: it starts with Рупор's shout. */}
      <Composition
        id="PromoSocial"
        component={PromoSocial}
        durationInFrames={promoSocialLength}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* «Тобі бракувало слова», one Composition per episode. */}
      <Composition
        id="MissingBundiuchnyi"
        component={Bundiuchnyi}
        durationInFrames={beats.length}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* «Де наголос?»: the Stress mark finds its vowel. */}
      <Composition id="Stress" component={Stress} durationInFrames={stressLength} fps={30} width={1080} height={1920} />
      {/* «Слово дня»: the split-flap board, for 16:9 and 9:16. */}
      <Composition id="Board" component={Board} durationInFrames={boardLength} fps={30} width={1920} height={1080} />
      <Composition
        id="BoardVertical"
        component={Board}
        durationInFrames={boardLength}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* «Знайди помилку»: a common calque, Рупор knocks it out. One Composition per episode. */}
      <Composition id="FindMistake" component={FindMistake} defaultProps={{ episode: 0 }} durationInFrames={findMistakeLength} fps={30} width={1080} height={1920} />
      <Composition id="FindMistake2" component={FindMistake} defaultProps={{ episode: 1 }} durationInFrames={findMistakeLength} fps={30} width={1080} height={1920} />
      <Composition id="FindMistake3" component={FindMistake} defaultProps={{ episode: 2 }} durationInFrames={findMistakeLength} fps={30} width={1080} height={1920} />
    </>
  );
}
