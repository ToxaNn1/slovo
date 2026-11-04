import { stressLabel, type WordOfTheDayHero } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { AccentGround } from '../entries/AccentGround';
import { firstLetter } from '../entries/WordHero';
import { WordOfTheDayBadge } from '../entries/WordOfTheDayBadge';
import { Button } from '../primitives/Button';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { typeStyle, wordHero } from '../tokens';

/**
 * The Word of the Day hero of the Dashboard (ADR 0074). Unrevealed, it shouts
 * «Лови слово!» under a «?» with «Розкрити»; revealed, it shows the Lemma with
 * its Stress and the short Definition in place. «До картки →» opens the Feed
 * on the Word of the Day card in both states.
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
  const tokens = useTokens();
  const key = useSchemeColors('light');
  const { strings, voice } = useEdition();
  const ink = { color: key.ink };
  return (
    <AccentGround
      id="dashboard-hero"
      testID="dashboard-hero"
      letter={hero.state === 'revealed' ? firstLetter(hero.lemmaWithStress) : '?'}
      letterRole="giantLetter"
      letterAt={hero.state === 'revealed' ? wordHero.letter.open : wordHero.letter.closed}
      style={styles.hero}
    >
      <WordOfTheDayBadge day={hero.date} />
      {hero.state === 'revealed' ? (
        <>
          <Text
            testID="dashboard-hero-lemma"
            {...voice}
            accessibilityLabel={stressLabel(
              strings.wordCard,
              hero.lemmaWithStress,
              hero.stressedVowels,
            )}
            style={[typeStyle('heroWord', tokens), ink]}
          >
            {hero.lemmaWithStress}
          </Text>
          <Text {...voice} style={[typeStyle('definition', tokens), ink]}>
            {hero.definition}
          </Text>
        </>
      ) : (
        <Text {...voice} style={[typeStyle('heroShout', tokens), styles.shout, ink]}>
          {strings.wordOfTheDay.shout}
        </Text>
      )}
      <View style={styles.foot}>
        {hero.state === 'unrevealed' && (
          <Button
            variant="onAccent"
            testID="dashboard-reveal"
            label={strings.wordOfTheDay.reveal}
            onPress={onReveal}
          />
        )}
        <Button
          variant="ghost"
          testID="dashboard-to-card"
          label={strings.dashboard.toCard}
          onPress={onToCard}
        />
      </View>
    </AccentGround>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: wordHero.radius, padding: wordHero.padding, gap: wordHero.gap },
  shout: { maxWidth: wordHero.shoutWidth },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
