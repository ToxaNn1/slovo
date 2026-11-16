import { withoutStress, type AnyEntryCard } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useTitleFactor } from '../providers/FontSizeProvider';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { fontScaleCap, panelHeadline, space, typeStyle, wordLineHeight } from '../tokens';
import { capitalised } from './capitalised';
import { CorrectionStruckForm } from './CorrectionCard';

/** An Entry of a kind other than a Word, which Entry details heads in its red panel. */
export type OtherKindCard = Exclude<AnyEntryCard, { kind: 'word' }>;

/** The text an Entry of another kind is headed by: the giant letter in the panel is its first. */
export function headlineOf(card: OtherKindCard): string {
  switch (card.kind) {
    case 'correction':
      return card.model.nonStandardForm;
    case 'idiom':
      return card.model.expression;
    case 'synonymRow':
      return card.model.dominant.text;
    case 'tip':
      return card.model.title;
  }
}

/**
 * The headline of an Entry of another kind in Entry details' red panel, as a
 * Word's Lemma and part of speech stand there (owner 15.11): its expression,
 * dominant or title in the key ink at `panelHeadline`'s size, on at most two
 * lines (ADR 0157), or a Correction's struck form; under it, the name of its
 * kind where a Word names its part of speech.
 */
export function EntryPanelHeadline({ card }: { card: OtherKindCard }) {
  const tokens = useTokens();
  const keyInk = useSchemeColors('light').ink;
  const fontSize = panelHeadline.size * useTitleFactor();
  const { strings, voice } = useEdition();
  const kind = kindName(card, strings);
  const text = headlineOf(card);
  const spoken = withoutStress(text);
  const heading =
    card.kind === 'idiom'
      ? fill(strings.idiomCard.heading, { expression: spoken, type: kind })
      : card.kind === 'synonymRow'
        ? fill(strings.synonymRowCard.heading, {
            dominant: spoken,
            members: card.model.members.map((member) => withoutStress(member.text)).join(', '),
          })
        : card.kind === 'tip'
          ? fill(strings.tipCard.heading, { title: spoken })
          : undefined;
  return (
    <View style={styles.headline} testID="entry-panel-headline">
      {card.kind === 'correction' ? (
        <CorrectionStruckForm card={card.model} concealed={false} />
      ) : (
        <WholeWordsText
          text={capitalised(text, voice.accessibilityLanguage)}
          size={{ fontSize, lineHeight: fontSize * wordLineHeight.lemma }}
          typeRole="heroWord"
          testID="entry-panel-title"
          maxFontSizeMultiplier={fontScaleCap.text}
          lines={panelHeadline.lines}
          stepped
          ellipsis
          accessibilityRole="header"
          accessibilityLabel={heading}
          {...voice}
          style={[typeStyle('heroWord', tokens), { color: keyInk }]}
        />
      )}
      <Text
        testID="entry-panel-kind"
        // The headline names the kind to VoiceOver already.
        accessibilityElementsHidden={card.kind !== 'correction'}
        importantForAccessibility={card.kind === 'correction' ? 'auto' : 'no-hide-descendants'}
        {...voice}
        style={[typeStyle('partOfSpeech', tokens), { color: keyInk }]}
      >
        {capitalised(kind, voice.accessibilityLanguage)}
      </Text>
    </View>
  );
}

/** The Edition's name of the card's kind, as its card's kicker names it. */
function kindName(card: OtherKindCard, strings: ReturnType<typeof useEdition>['strings']): string {
  switch (card.kind) {
    case 'correction':
      return strings.correctionCard.title;
    case 'idiom':
      return strings.idiomCard.idiomTypes[card.model.idiomType];
    case 'synonymRow':
      return strings.synonymRowCard.chip;
    case 'tip':
      return strings.tipCard.chip;
  }
}

const styles = StyleSheet.create({
  headline: { gap: space[2] },
});
