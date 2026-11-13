import type { ReactNode } from 'react';
import {
  STRESS_MARK,
  selfCheckSynonymRowCard,
  stressLabel,
  withoutStress,
  type SynonymRowCardModel,
  type SynonymRowMemberModel,
} from '@slovo/core';
import { Pressable, StyleSheet, View } from 'react-native';

import { WholeLinesText } from '../primitives/WholeLines';
import { EntryKicker } from './EntryKicker';
import { KickerRow } from './KickerRow';
import { fill, useEdition } from '../providers/EditionProvider';
import { useWordTextSizes, type TextSize } from '../providers/FontSizeProvider';
import { Wedge } from '../primitives/Wedge';
import {
  entryCardFrame,
  roleAt,
  space,
  synonymRowList,
  typeRoles,
  typeStyle,
  wedges,
} from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { useFlyingText } from './reveal';
import { ExampleText } from './WordCard';
import { capitalised } from './capitalised';
import { CardTabs } from './CardTabs';
import { synonymRowPagesOf, type SynonymRowPage } from './word-tabs';

/**
 * The Synonym Row card's blocks inside the Entry card's frame (board XEntry2
 * e8): the red kicker «СИНОНІМИ», the dominant on one line with its stressed
 * vowel in red over the red bar, the meaning, the members in the row's order
 * one per row with their Stress and, at the row's right end, their shade
 * notes, the Example and, when the row has sources, a line
 * naming them. A member the Core links to a Word is a button that opens it;
 * any other member is plain text. VoiceOver reads the dominant with the
 * whole row, then each member. Under Self-check it keeps the kicker and the
 * dominant (ADR 0051); the Entry card draws the button that reveals the rest
 * under them. With `tabs` the members sit four to a page, a tab each
 * («Ряд · 1/2»), the meaning on the first page and the Example and the
 * sources on the last (ADR 0114). With `sourceTab` the sources leave the
 * last page for their own last tab «Джерело» (ADR 0116).
 */
export function SynonymRowCardBody({
  card,
  lemmaSize,
  concealed,
  onOpenWord,
  corner,
  tabs,
  sourceTab,
}: {
  card: SynonymRowCardModel;
  /** The Lemma's size at the user's font size, which the dominant takes. */
  lemmaSize: TextSize;
  /** Self-check: only the kicker and the dominant. */
  concealed: boolean;
  /** Opens the Word a linked member names, Hidden or out of the Mix alike. */
  onOpenWord: ((wordId: string) => void) | undefined;
  /** The corner actions, set in one row beside the card's kicker (`KickerRow`). */
  corner: ReactNode | undefined;
  /** The members in pages of four under tabs, while `wordTabs` is on (ADR 0114). */
  tabs: boolean;
  /** The last tab «Джерело» with the sources, which leave the last page, while `sourceTab` is on (ADR 0116). */
  sourceTab: boolean;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const edition = useEdition();
  const { voice } = edition;
  const strings = edition.strings.synonymRowCard;
  // In the Feed, VoiceOver turns to the next or previous card from the dominant and the meaning.
  const turnActions = usePageTurnActions();
  // The headline's letters fly in as the card reveals.
  const flying = useFlyingText();
  const shown = selfCheckSynonymRowCard({ card, concealed });
  const dominant = withoutStress(card.dominant.text);
  const dominantSize = roleAt(
    'synonymDominant',
    (lemmaSize.fontSize * typeRoles.synonymDominant.size) / typeRoles.heroWord.size,
  );

  return (
    <>
      <KickerRow testID="synonymRow-kicker-row" corner={corner}>
        <EntryKicker testID="synonym-row-kicker" label={strings.chip} />
      </KickerRow>
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
          text={capitalised(shown.card.dominant.text, voice.accessibilityLanguage)}
          size={{ fontSize: dominantSize.fontSize, lineHeight: dominantSize.lineHeight }}
          typeRole="synonymDominant"
          testID="synonym-row-dominant"
          // The dominant stays on one line and shrinks rather than wrap (board e8).
          lines={1}
          falling={undefined}
          stressed={{ mark: STRESS_MARK, style: { color: colors.accent } }}
          style={[typeStyle('synonymDominant', tokens), { color: colors.ink }]}
        />
        <Wedge
          testID="synonym-row-rule"
          points={wedges.slant}
          color={colors.accent}
          width={entryCardFrame.rule.width}
          height={entryCardFrame.rule.height}
        />
      </View>
      {shown.concealed ? null : tabs ? (
        <CardTabs
          testID="synonymRow"
          tabs={synonymRowPagesOf(shown.card)}
          sources={sourceTab ? card.sourceNames : undefined}
          nameOf={(page) =>
            fill(strings.page, { page: String(page.number), pages: String(page.pages) })
          }
        >
          {(page) => (
            <SynonymRowContent
              card={shown.card}
              page={page}
              sourceLine={!sourceTab}
              onOpenWord={onOpenWord}
            />
          )}
        </CardTabs>
      ) : (
        <SynonymRowContent card={shown.card} page={undefined} sourceLine onOpenWord={onOpenWord} />
      )}
    </>
  );
}

/**
 * The revealed row at the font size of the frame it sits in: the meaning,
 * the members, the Example and the source line, or with a `page` only its
 * part: the meaning on the first page, the Example and the sources on the
 * last. Without `sourceLine` the sources sit in the «Джерело» tab instead.
 */
function SynonymRowContent({
  card,
  page,
  sourceLine,
  onOpenWord,
}: {
  card: SynonymRowCardModel;
  page: SynonymRowPage | undefined;
  sourceLine: boolean;
  onOpenWord: ((wordId: string) => void) | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const sizes = useWordTextSizes();
  const edition = useEdition();
  const { voice } = edition;
  const strings = edition.strings.synonymRowCard;
  const turnActions = usePageTurnActions();
  const first = page === undefined || page.number === 1;
  const last = page === undefined || page.number === page.pages;
  const firstIndex = page?.firstIndex ?? 0;
  const members = page?.members ?? card.members;
  const memberSize = roleAt(
    'synonymMember',
    (sizes.definition.fontSize * typeRoles.synonymMember.size) / typeRoles.definition.size,
  );
  return (
    <>
      {first && (
        <WholeLinesText
          testID="synonym-row-meaning"
          // The voices break a word at its Stress mark, so VoiceOver reads the text without it.
          accessibilityLabel={withoutStress(card.meaning)}
          {...voice}
          {...turnActions}
          style={[typeStyle('definition', tokens), sizes.definition, { color: colors.ink }]}
        >
          {capitalised(card.meaning, voice.accessibilityLanguage)}
        </WholeLinesText>
      )}
      <View testID="synonym-row-members">
        {members.map((member, index) => (
          <Member
            key={firstIndex + index}
            testID={`synonym-row-member-${String(firstIndex + index)}`}
            member={member}
            size={{ fontSize: memberSize.fontSize, lineHeight: memberSize.lineHeight }}
            topLine={index > 0}
            onOpenWord={onOpenWord}
          />
        ))}
      </View>
      {!last || card.example === undefined ? null : (
        <ExampleText testID="synonym-row-example" example={card.example} size={sizes.example} />
      )}
      {!last || !sourceLine || card.sourceNames.length === 0 ? null : (
        <WholeLinesText
          testID="synonym-row-source"
          {...voice}
          style={[typeStyle('meta', tokens), { color: colors.muted }]}
        >
          {fill(strings.source, { source: card.sourceNames.join(SOURCE_SEPARATOR) })}
        </WholeLinesText>
      )}
    </>
  );
}

/**
 * One member's row: its text with Stress and, at the row's right end, its
 * shade note, under a hairline unless it is the first. A member linked to a
 * Word is a button in the accent colour; any other is plain text.
 */
function Member({
  member,
  size,
  topLine,
  testID,
  onOpenWord,
}: {
  member: SynonymRowMemberModel;
  size: TextSize;
  /** The hairline over the row, between it and the one above. */
  topLine: boolean;
  testID: string;
  onOpenWord: ((wordId: string) => void) | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const { wordId, shadeNote } = member;
  const spoken = stressLabel(strings.wordCard, member.text, member.stressedVowels);
  const label = shadeNote === undefined ? spoken : `${spoken}, ${shadeNote}`;
  const rowStyle = [
    styles.member,
    { borderTopWidth: topLine ? synonymRowList.line : 0, borderTopColor: colors.line },
  ];
  const text = (
    <>
      <WholeLinesText
        style={[
          typeStyle('synonymMember', tokens),
          size,
          styles.memberText,
          { color: wordId === undefined ? colors.ink : colors.accentText },
        ]}
      >
        {capitalised(member.text, voice.accessibilityLanguage)}
      </WholeLinesText>
      {shadeNote === undefined ? null : (
        <WholeLinesText
          testID={`${testID}-shade`}
          style={[typeStyle('shadeNote', tokens), styles.shade, { color: colors.muted }]}
        >
          {capitalised(shadeNote, voice.accessibilityLanguage)}
        </WholeLinesText>
      )}
    </>
  );
  return wordId === undefined ? (
    <View testID={testID} accessible accessibilityLabel={label} {...voice} style={rowStyle}>
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
      style={rowStyle}
    >
      {text}
    </Pressable>
  );
}

/** What sits between the titles of a row's sources on the source line. */
const SOURCE_SEPARATOR = '; ';

const styles = StyleSheet.create({
  header: { gap: space[2] },
  // A member at the left, its shade note at the right, on one baseline (board e8).
  member: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: synonymRowList.shadeGap,
    paddingVertical: synonymRowList.rowPadding,
  },
  // A long member or a long note at a large font size wraps in its own column, never cut.
  memberText: { flexShrink: 1 },
  shade: { flexShrink: 1, textAlign: 'right', fontStyle: 'normal' },
});
