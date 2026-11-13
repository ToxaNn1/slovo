import {
  partOfSpeechText,
  stressLabel,
  withoutStress,
  type InterfaceSound,
  type LocalDate,
  type WordOfTheDayHero,
} from '@slovo/core';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { AccentGround } from '../entries/AccentGround';
import { Mascot } from '../primitives/Mascot';
import { PressedTile } from '../primitives/PressedTile';
import { Wedge } from '../primitives/Wedge';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { fill, useEdition } from '../providers/EditionProvider';
import { useInterfaceSounds } from '../providers/InterfaceSoundsProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import {
  capitalMarkRoom,
  dashboard,
  roleSize,
  space,
  typeStyle,
  wedges,
  withAlpha,
  type TypeRole,
} from '../tokens';
import { FlyingLemma, RisesIn } from './HeroReveal';
import { HeroSparks } from './HeroSparks';
import { useFitToRoom } from './useFitToRoom';

const { hero: place } = dashboard;
const { card } = place;
const RARITY_BARS = [1, 2, 3, 4, 5] as const;

/**
 * The Word of the Day hero of the Dashboard (ADR 0076), on the red ground
 * whose bottom falls to the left. Unrevealed, it shouts «Лови слово!» under a
 * giant «?» with «Розкрий слово» and the waiting Mascot; revealed, it shows
 * the Lemma in capitals over a cream card of its Stress and part of speech,
 * rarity bars, short Definition and rarity, with «Ще про слово →», which opens
 * the Feed on the Word of the Day card, and the happy Mascot. Revealed while
 * on screen, it opens as the board does (ADR 0105): the reveal shouts, the
 * Mascot shouts a moment, the Lemma flies in letter by letter and the card,
 * then the button, rise in. Opened already revealed, it stands still.
 * With `sparks`, the Mascot throws the board's sparks from its megaphone,
 * closed and open (ADR 0109).
 */
export function DashboardHero({
  hero,
  sparks,
  onReveal,
  onToCard,
}: {
  hero: WordOfTheDayHero;
  /** The Edition's `heroSparks` is on in effect. */
  sparks: boolean;
  onReveal: () => void;
  onToCard: () => void;
}) {
  const { strings } = useEdition();
  const revealed = hero.state === 'revealed';
  const [openedClosed] = useState(!revealed);
  const plays = revealed && openedClosed;
  const [shouted, setShouted] = useState(false);
  useEffect(() => {
    if (!plays) return undefined;
    const timer = setTimeout(() => {
      setShouted(true);
    }, place.reveal.shouts);
    return () => {
      clearTimeout(timer);
    };
  }, [plays]);
  const mascot = !revealed ? 'waits' : plays && !shouted ? 'shouts' : 'happy';
  const toCard = (
    <HeroButton
      testID="dashboard-to-card"
      role="dashboardToCardButton"
      paddingHorizontal={place.button.toCardPaddingHorizontal}
      label={strings.dashboard.toCard}
      sound="tap"
      onPress={onToCard}
    />
  );
  return (
    <AccentGround
      id="dashboard-hero"
      testID="dashboard-hero"
      letter={revealed ? '' : '?'}
      letterRole="dashboardQuestion"
      letterAt={place.question}
      letterOpacity={place.questionOpacity}
      points={wedges.dashboardHero}
      letterStopsAt={place.cutAt}
      style={styles.hero}
    >
      <Kicker hero={hero} />
      {revealed ? (
        <RevealedWord hero={hero} plays={plays} />
      ) : (
        <>
          <HeroText role="dashboardShout" style={styles.shout}>
            {strings.wordOfTheDay.shout}
          </HeroText>
          <HeroText role="dashboardSubtitle" style={styles.subtitle}>
            {strings.dashboard.subtitle}
          </HeroText>
        </>
      )}
      {sparks && <HeroSparks />}
      <View style={styles.mascot}>
        <Mascot state={mascot} onRed width={place.mascot.width} />
      </View>
      {revealed ? (
        plays ? (
          <RisesIn at="button" style={[styles.button, { bottom: place.button.bottom }]}>
            {toCard}
          </RisesIn>
        ) : (
          <View style={[styles.button, { bottom: place.button.bottom }]}>{toCard}</View>
        )
      ) : (
        <View style={[styles.button, { bottom: place.button.revealBottom }]}>
          <HeroButton
            testID="dashboard-reveal"
            role="dashboardButton"
            paddingHorizontal={place.button.paddingHorizontal}
            label={strings.dashboard.reveal}
            sound="shout"
            onPress={onReveal}
          />
        </View>
      )}
    </AccentGround>
  );
}

/**
 * The open hero's Lemma, and under it the cream card: its Stress and part of
 * speech beside the rarity bars, the short Definition and «Рідкість N з 5».
 * While `plays`, the Lemma flies in over itself and the card rises in.
 */
function RevealedWord({
  hero,
  plays,
}: {
  hero: Extract<WordOfTheDayHero, { state: 'revealed' }>;
  plays: boolean;
}) {
  const tokens = useTokens();
  const { ink: keyInk, background: cream, accentText } = useSchemeColors('light');
  const { strings, voice } = useEdition();
  // Measured, not '100%': Yoga sizes an absolute child's percent width by the
  // card's content box, so the cream ended `paddingHorizontal` short on the right.
  const [cardSize, setCardSize] = useState<{ width: number; height: number }>();
  const rarity = fill(strings.dashboard.rarity, { rarity: String(hero.rarity) });
  const lemma = withoutStress(hero.lemmaWithStress);
  const lemmaStyle = [typeStyle('dashboardLemma', tokens), { color: keyInk }];
  const room = capitalMarkRoom('dashboardLemma');
  const content = (
    <View
      testID="dashboard-hero-card"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setCardSize({ width, height });
      }}
      style={styles.card}
    >
      {cardSize === undefined ? null : (
        <Wedge
          testID="dashboard-hero-card-cream"
          points={[
            [0, card.cut / cardSize.height],
            [1, 0],
            [1, 1],
            [0, 1],
          ]}
          color={cream}
          width={cardSize.width}
          height={cardSize.height}
          style={styles.cream}
        />
      )}
      <View style={styles.cardRow}>
        <WordLine
          text={fill(strings.dashboard.wordLine, {
            stress: hero.lemmaWithStress,
            partOfSpeech: partOfSpeechText(strings.wordCard, hero, 'short'),
          })}
        />
        <View
          testID="dashboard-hero-rarity"
          accessible
          accessibilityLabel={rarity}
          style={styles.bars}
        >
          {RARITY_BARS.map((bar) => (
            <View
              key={bar}
              testID={
                bar <= hero.rarity ? 'dashboard-hero-rarity-full' : 'dashboard-hero-rarity-empty'
              }
              style={[
                styles.bar,
                {
                  backgroundColor: bar <= hero.rarity ? keyInk : withAlpha(keyInk, place.emptyBar),
                },
              ]}
            />
          ))}
        </View>
      </View>
      <HeroText role="dashboardDefinition">{hero.definition}</HeroText>
      <Text
        {...voice}
        importantForAccessibility="no"
        accessibilityElementsHidden
        style={[typeStyle('dashboardRarity', tokens), { color: accentText }]}
      >
        {rarity}
      </Text>
    </View>
  );
  return (
    <>
      {/* Measured to fit the line: `adjustsFontSizeToFit` alone let a long Lemma such as «ВЕРБОЛІЗ» run past the edge on iOS. */}
      <View style={styles.lemma}>
        <View style={plays && styles.clear}>
          <WholeWordsText
            testID="dashboard-hero-lemma"
            {...voice}
            text={lemma}
            typeRole="dashboardLemma"
            numberOfLines={1}
            accessibilityLabel={stressLabel(
              strings.wordCard,
              hero.lemmaWithStress,
              hero.stressedVowels,
            )}
            style={lemmaStyle}
          />
        </View>
        {plays && (
          <FlyingLemma
            text={lemma.toLocaleUpperCase(voice.accessibilityLanguage)}
            style={[...lemmaStyle, { paddingTop: room, marginTop: -room }]}
          />
        )}
      </View>
      {plays ? <RisesIn at="card">{content}</RisesIn> : content}
    </>
  );
}

/**
 * The card's Stress and part of speech on one line beside the rarity bars,
 * drawn smaller when it is wider than its room, so a long Lemma such as
 * «високопревосходи́тельство» neither wraps under the bars nor pushes the card
 * onto «Ще про слово →». Measured, as the Lemma is: the line is measured at
 * full size and hidden until it is.
 */
function WordLine({ text }: { text: string }) {
  const tokens = useTokens();
  const keyInk = useSchemeColors('light').ink;
  const { voice } = useEdition();
  const { scale, onRoomLayout, measured } = useFitToRoom();
  const full = roleSize('dashboardWordLine');
  const lineStyle = [typeStyle('dashboardWordLine', tokens), { color: keyInk }];
  return (
    <View
      style={styles.wordLine}
      onLayout={onRoomLayout}
    >
      <Text
        {...voice}
        numberOfLines={1}
        style={[
          lineStyle,
          { fontSize: full.fontSize * (scale ?? 1), lineHeight: full.lineHeight * (scale ?? 1) },
          scale === undefined && styles.clear,
        ]}
      >
        {text}
      </Text>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.measure}
      >
        <Text
          {...voice}
          onTextLayout={(event) => {
            measured(Math.max(...event.nativeEvent.lines.map((line) => line.width)));
          }}
          style={lineStyle}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

/** At the hero's top left: «СЛОВО ДНЯ · №312» closed, «СЛОВО ДНЯ · 2.11» open (ADR 0105). */
function Kicker({ hero }: { hero: WordOfTheDayHero }) {
  const { strings } = useEdition();
  const { day, month }: LocalDate = hero.date;
  return (
    <HeroText role="dashboardKicker" style={styles.kicker}>
      {hero.state === 'revealed'
        ? fill(strings.dashboard.kicker, { day: String(day), month: String(month) })
        : fill(strings.dashboard.kickerNumber, { number: String(hero.number) })}
    </HeroText>
  );
}

/** A text of the hero in the key ink, at its place on the red ground. */
function HeroText({
  role,
  style,
  children,
}: {
  role: TypeRole;
  style?: StyleProp<TextStyle>;
  children: string;
}) {
  const tokens = useTokens();
  const keyInk = useSchemeColors('light').ink;
  const { voice } = useEdition();
  return (
    <Text {...voice} style={[typeStyle(role, tokens), style, { color: keyInk }]}>
      {children}
    </Text>
  );
}

/** The hero's ink button: «Розкрий слово», which shouts, or «Ще про слово →». */
function HeroButton({
  testID,
  role,
  paddingHorizontal,
  label,
  sound,
  onPress,
}: {
  testID: string;
  role: Extract<TypeRole, 'dashboardButton' | 'dashboardToCardButton'>;
  paddingHorizontal: number;
  label: string;
  sound: InterfaceSound;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const cream = useSchemeColors('light').background;
  const sounds = useInterfaceSounds();
  const { voice } = useEdition();
  return (
    <PressedTile
      tone="ink"
      radius={place.button.radius}
      accessibilityLabel={label}
      onPress={() => {
        sounds.play(sound);
        onPress();
      }}
      faceStyle={[styles.buttonFace, { paddingHorizontal }]}
      testID={testID}
    >
      <Text {...voice} style={[typeStyle(role, tokens), { color: cream }]}>
        {label}
      </Text>
    </PressedTile>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: place.height,
    borderTopLeftRadius: place.radius,
    borderTopRightRadius: place.radius,
  },
  kicker: { position: 'absolute', ...place.kicker },
  shout: { position: 'absolute', ...place.shout },
  subtitle: { position: 'absolute', ...place.subtitle },
  lemma: { position: 'absolute', ...place.lemma },
  clear: { opacity: 0 },
  card: {
    position: 'absolute',
    left: card.left,
    right: card.right,
    top: card.top,
    paddingTop: card.paddingTop,
    paddingHorizontal: card.paddingHorizontal,
    paddingBottom: card.paddingBottom,
    gap: card.gap,
  },
  cream: { position: 'absolute', left: 0, top: 0 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: card.rowGap,
  },
  wordLine: { flex: 1 },
  // Wide enough that the measured line never wraps.
  measure: { position: 'absolute', top: 0, left: 0, width: 10000, opacity: 0 },
  bars: { flexDirection: 'row', alignItems: 'center', gap: card.bars.gap },
  bar: {
    width: card.bars.width,
    height: card.bars.height,
    transform: [{ skewX: card.bars.skew }],
  },
  // The Mascot pads its figure by `space[4]`; the board places the figure itself.
  mascot: {
    position: 'absolute',
    left: place.mascot.left - space[4],
    top: place.mascot.top - space[4],
  },
  button: { position: 'absolute', right: place.button.right },
  buttonFace: { height: place.button.height, justifyContent: 'center' },
});
