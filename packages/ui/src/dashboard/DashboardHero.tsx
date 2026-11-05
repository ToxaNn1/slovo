import {
  partOfSpeechText,
  stressLabel,
  withoutStress,
  type LocalDate,
  type WordOfTheDayHero,
} from '@slovo/core';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { AccentGround } from '../entries/AccentGround';
import { firstLetter } from '../entries/WordHero';
import { Mascot } from '../primitives/Mascot';
import { PressedTile } from '../primitives/PressedTile';
import { fill, useEdition } from '../providers/EditionProvider';
import { useInterfaceSounds } from '../providers/InterfaceSoundsProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { dashboard, space, typeStyle, wedges, withAlpha, type TypeRole } from '../tokens';

const { hero: place } = dashboard;
const RARITY_BARS = [1, 2, 3, 4, 5] as const;

/**
 * The Word of the Day hero of the Dashboard (ADR 0076), on the red ground
 * whose bottom falls to the left. Unrevealed, it shouts «Лови слово!» under a
 * giant «?» with «Розкрити» and the waiting Mascot; revealed, it shows the
 * Lemma in capitals, its Stress and part of speech, its rarity and the short
 * Definition, with «До картки →», which opens the Feed on the Word of the Day
 * card, and the happy Mascot.
 */
export function DashboardHero({
  hero,
  onReveal,
  onToCard,
}: {
  hero: WordOfTheDayHero;
  onReveal: () => void;
  onToCard: () => void;
}) {
  const { strings } = useEdition();
  const revealed = hero.state === 'revealed';
  return (
    <AccentGround
      id="dashboard-hero"
      testID="dashboard-hero"
      letter={revealed ? firstLetter(hero.lemmaWithStress) : '?'}
      letterRole={revealed ? 'dashboardLetter' : 'dashboardQuestion'}
      letterAt={revealed ? place.letter : place.question}
      letterOpacity={revealed ? 1 : place.questionOpacity}
      points={wedges.dashboardHero}
      letterStopsAt={place.cutAt}
      style={styles.hero}
    >
      <Kicker day={hero.date} />
      {revealed ? (
        <RevealedWord hero={hero} />
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
      <View style={styles.mascot}>
        <Mascot state={revealed ? 'happy' : 'waits'} onRed width={place.mascot.width} />
      </View>
      {revealed ? (
        <HeroButton
          testID="dashboard-to-card"
          role="dashboardToCardButton"
          paddingHorizontal={place.button.toCardPaddingHorizontal}
          label={strings.dashboard.toCard}
          onPress={onToCard}
        />
      ) : (
        <HeroButton
          testID="dashboard-reveal"
          role="dashboardButton"
          paddingHorizontal={place.button.paddingHorizontal}
          label={strings.wordOfTheDay.reveal}
          onPress={onReveal}
        />
      )}
    </AccentGround>
  );
}

/** The open hero's Lemma, its Stress and part of speech, its rarity bars and the short Definition. */
function RevealedWord({ hero }: { hero: Extract<WordOfTheDayHero, { state: 'revealed' }> }) {
  const tokens = useTokens();
  const keyInk = useSchemeColors('light').ink;
  const { strings, voice } = useEdition();
  const rarity = fill(strings.dashboard.rarity, { rarity: String(hero.rarity) });
  return (
    <>
      <Text
        testID="dashboard-hero-lemma"
        {...voice}
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityLabel={stressLabel(
          strings.wordCard,
          hero.lemmaWithStress,
          hero.stressedVowels,
        )}
        style={[typeStyle('dashboardLemma', tokens), styles.lemma, { color: keyInk }]}
      >
        {withoutStress(hero.lemmaWithStress)}
      </Text>
      <HeroText role="dashboardWordLine" style={styles.line}>
        {fill(strings.dashboard.wordLine, {
          stress: hero.lemmaWithStress,
          partOfSpeech: partOfSpeechText(strings.wordCard, hero, 'short'),
        })}
      </HeroText>
      <View
        testID="dashboard-hero-rarity"
        accessible
        accessibilityLabel={rarity}
        style={styles.rarity}
      >
        {RARITY_BARS.map((bar) => (
          <View
            key={bar}
            testID={
              bar <= hero.rarity ? 'dashboard-hero-rarity-full' : 'dashboard-hero-rarity-empty'
            }
            style={[
              styles.bar,
              { backgroundColor: bar <= hero.rarity ? keyInk : withAlpha(keyInk, place.emptyBar) },
            ]}
          />
        ))}
        <Text
          {...voice}
          style={[typeStyle('dashboardRarity', tokens), styles.rarityLabel, { color: keyInk }]}
        >
          {rarity}
        </Text>
      </View>
      <HeroText role="dashboardDefinition" style={styles.definition}>
        {hero.definition}
      </HeroText>
    </>
  );
}

/** «СЛОВО ДНЯ · 2.11» at the hero's top left. */
function Kicker({ day: { day, month } }: { day: LocalDate }) {
  const { strings } = useEdition();
  return (
    <HeroText role="dashboardKicker" style={styles.kicker}>
      {fill(strings.dashboard.kicker, { day: String(day), month: String(month) })}
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
  style: StyleProp<TextStyle>;
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

/** The hero's ink button at the bottom right, above the cut: «Розкрити» or «До картки →». */
function HeroButton({
  testID,
  role,
  paddingHorizontal,
  label,
  onPress,
}: {
  testID: string;
  role: Extract<TypeRole, 'dashboardButton' | 'dashboardToCardButton'>;
  paddingHorizontal: number;
  label: string;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const cream = useSchemeColors('light').background;
  const sounds = useInterfaceSounds();
  const { voice } = useEdition();
  return (
    <View style={styles.button}>
      <PressedTile
        tone="ink"
        radius={place.button.radius}
        accessibilityLabel={label}
        onPress={() => {
          sounds.play('tap');
          onPress();
        }}
        faceStyle={[styles.buttonFace, { paddingHorizontal }]}
        testID={testID}
      >
        <Text {...voice} style={[typeStyle(role, tokens), { color: cream }]}>
          {label}
        </Text>
      </PressedTile>
    </View>
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
  line: { position: 'absolute', ...place.line },
  rarity: {
    position: 'absolute',
    left: place.rarity.left,
    top: place.rarity.top,
    flexDirection: 'row',
    alignItems: 'center',
    gap: place.rarity.gap,
  },
  bar: {
    width: place.rarity.bar.width,
    height: place.rarity.bar.height,
    transform: [{ skewX: place.rarity.bar.skew }],
  },
  rarityLabel: { marginLeft: place.rarity.labelGap },
  definition: { position: 'absolute', ...place.definition },
  // The Mascot pads its figure by `space[4]`; the board places the figure itself.
  mascot: {
    position: 'absolute',
    left: place.mascot.left - space[4],
    top: place.mascot.top - space[4],
  },
  button: { position: 'absolute', right: place.button.right, bottom: place.button.bottom },
  buttonFace: { height: place.button.height, justifyContent: 'center' },
});
