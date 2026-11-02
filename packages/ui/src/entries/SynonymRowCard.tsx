import {
  selfCheckSynonymRowCard,
  stressLabel,
  withoutStress,
  type SynonymRowCardModel,
  type SynonymRowMemberModel,
} from '@slovo/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OrnamentDivider } from '../decor/DecorSlots';
import { fill, useEdition } from '../providers/EditionProvider';
import { useWordTextSizes, type TextSize } from '../providers/FontSizeProvider';
import { LabelChip } from '../primitives/LabelChip';
import { space, typeRoles, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { useFlyingLetters } from './reveal';
import { ExampleText } from './WordCard';

/**
 * The Synonym Row card's blocks inside the Entry card's frame: the dominant
 * at the Lemma's size with the chip «синоніми», the meaning, the members in
 * the row's order with their Stress and shade notes, wrapping onto as many
 * lines as they need, the Example and, when the row has sources, a line
 * naming them. A member the Core links to a Word is a button that opens it;
 * any other member is plain text. VoiceOver reads the dominant with the
 * whole row, then each member. Under Self-check it keeps the dominant and
 * its chip (ADR 0051); the Entry card draws the button that reveals the rest
 * under them.
 */
export function SynonymRowCardBody({
  card,
  lemmaSize,
  concealed,
  onOpenWord,
}: {
  card: SynonymRowCardModel;
  /** The Lemma's size at the user's font size, which the dominant takes. */
  lemmaSize: TextSize;
  /** Self-check: only the dominant and its chip. */
  concealed: boolean;
  /** Opens the Word a linked member names, Hidden or out of the Mix alike. */
  onOpenWord: ((wordId: string) => void) | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const sizes = useWordTextSizes();
  const edition = useEdition();
  const { voice } = edition;
  const strings = edition.strings.synonymRowCard;
  // In the Feed, VoiceOver turns to the next or previous card from the dominant and the meaning.
  const turnActions = usePageTurnActions();
  // The headline's letters fly in as the card reveals.
  const flying = useFlyingLetters();
  const shown = selfCheckSynonymRowCard({ card, concealed });
  const dominant = withoutStress(card.dominant.text);

  return (
    <>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={
          shown.concealed
            ? fill(strings.concealedHeading, { dominant })
            : fill(strings.heading, {
                dominant,
                members: card.members.map(({ text }) => withoutStress(text)).join(', '),
              })
        }
        {...voice}
        {...turnActions}
        style={styles.header}
      >
        <WholeWordsText
          flying={flying}
          text={shown.card.dominant.text}
          size={lemmaSize}
          tracking={typeRoles.heroWord.letterSpacing / typeRoles.heroWord.size}
          testID="synonym-row-dominant"
          style={[typeStyle('heroWord', tokens), { color: colors.ink }]}
        />
        <View style={styles.chip}>
          <LabelChip
            testID="synonym-row-chip"
            text={strings.chip}
            accessibilityLabel={strings.chip}
            size="tight"
          />
        </View>
      </View>
      <View>
        {/* Decor slot 2, between the header and the meaning. */}
        <OrnamentDivider />
      </View>
      {shown.concealed ? null : (
        <>
          <Text
            testID="synonym-row-meaning"
            // The voices break a word at its Stress mark, so VoiceOver reads the text without it.
            accessibilityLabel={withoutStress(shown.card.meaning)}
            {...voice}
            {...turnActions}
            style={[typeStyle('definition', tokens), sizes.definition, { color: colors.ink }]}
          >
            {shown.card.meaning}
          </Text>
          <View testID="synonym-row-members" style={styles.members}>
            {shown.card.members.map((member, index) => (
              <Member
                key={index}
                testID={`synonym-row-member-${String(index)}`}
                member={member}
                size={sizes.definition}
                onOpenWord={onOpenWord}
              />
            ))}
          </View>
          {shown.card.example === undefined ? null : (
            <ExampleText
              testID="synonym-row-example"
              example={shown.card.example}
              size={sizes.example}
            />
          )}
          {shown.card.sourceNames.length === 0 ? null : (
            <Text
              testID="synonym-row-source"
              {...voice}
              style={[typeStyle('meta', tokens), { color: colors.muted }]}
            >
              {fill(strings.source, { source: shown.card.sourceNames.join(SOURCE_SEPARATOR) })}
            </Text>
          )}
        </>
      )}
    </>
  );
}

/**
 * One member: its text with Stress and, after it, its shade note. A member
 * linked to a Word is a button in the accent colour; any other is plain text.
 */
function Member({
  member,
  size,
  testID,
  onOpenWord,
}: {
  member: SynonymRowMemberModel;
  size: TextSize;
  testID: string;
  onOpenWord: ((wordId: string) => void) | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const { wordId, shadeNote } = member;
  const spoken = stressLabel(strings.wordCard, member.text, member.stressedVowels);
  const label = shadeNote === undefined ? spoken : `${spoken}, ${shadeNote}`;
  const text = (
    <Text
      style={[
        typeStyle('listWord', tokens),
        size,
        { color: wordId === undefined ? colors.ink : colors.accent },
      ]}
    >
      {member.text}
      {shadeNote === undefined ? null : (
        <Text style={[typeStyle('shadeNote', tokens), styles.italic, { color: colors.muted }]}>
          {` ${shadeNote}`}
        </Text>
      )}
    </Text>
  );
  return wordId === undefined ? (
    <View testID={testID} accessible accessibilityLabel={label} {...voice}>
      {text}
    </View>
  ) : (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...voice}
      disabled={onOpenWord === undefined}
      // A short member grows to a full touch target.
      hitSlop={{ top: space[2], bottom: space[2], left: space[1], right: space[1] }}
      onPress={() => onOpenWord?.(wordId)}
    >
      {text}
    </Pressable>
  );
}

/** What sits between the titles of a row's sources on the source line. */
const SOURCE_SEPARATOR = '; ';

const styles = StyleSheet.create({
  header: { gap: space[2] },
  chip: { flexDirection: 'row' },
  // Members flow along the line and wrap onto the next one, however many and however large.
  members: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[4], rowGap: space[2] },
  italic: { fontStyle: 'italic' },
});
