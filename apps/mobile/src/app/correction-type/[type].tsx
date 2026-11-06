import { CorrectionTypeSchema, fill, type CorrectionType } from '@slovo/contracts';
import type { CorrectionTypeRow as Row } from '@slovo/core';
import {
  correctionTile,
  CorrectionTypeRow,
  railScreen,
  RailScreenHero,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { useCorrectionTypeScreen } from '@/dashboard/correction-type';
import { editionStrings } from '@/edition/edition';

const words = editionStrings.dashboard.correctionTypes;

/** A Correction Type's screen, from its tile on the Dashboard; an unknown type returns home. */
export default function CorrectionTypeRoute() {
  const parsed = CorrectionTypeSchema.safeParse(useLocalSearchParams<{ type: string }>().type);
  return parsed.success ? <CorrectionTypeScreen type={parsed.data} /> : <Redirect href="/" />;
}

/**
 * The type's red hero over its Corrections, each revealed in place with
 * «Як правильно?» (ADR 0076), as the board's «fix» screen draws it.
 */
function CorrectionTypeScreen({ type }: { type: CorrectionType }) {
  const { title, description, place, rows, reveal } = useCorrectionTypeScreen(type);
  const { colors } = useTokens();
  const { count } = useEdition();
  const router = useRouter();
  const total = rows?.length ?? 0;
  const done = rows?.filter(({ workedThrough }) => workedThrough).length ?? 0;
  const glyph =
    correctionTile.glyphs[place % correctionTile.glyphs.length] ?? correctionTile.glyphs[0];
  return (
    <View testID="correction-type" style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList<Row>
        data={rows}
        keyExtractor={({ correction }) => correction.id}
        renderItem={({ item }) => (
          <CorrectionTypeRow
            correction={item.correction}
            workedThrough={item.workedThrough}
            onReveal={() => {
              reveal(item.correction.id);
            }}
          />
        )}
        ListHeaderComponent={
          <RailScreenHero
            id="correction-type-hero"
            glyph={glyph}
            kicker={fill(words.kicker, { count: count(words.examples, total) })}
            title={title}
            description={description}
            progress={fill(words.workedThrough, { x: String(done), n: String(total) })}
            done={total === 0 ? 0 : done / total}
            mascot="shouts"
            back={{
              testID: 'correction-type-back',
              label: editionStrings.tabs.home,
              onPress: () => {
                router.back();
              },
            }}
          />
        }
        ListHeaderComponentStyle={styles.hero}
        ItemSeparatorComponent={Gap}
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { marginHorizontal: -railScreen.list.side, marginBottom: railScreen.list.top },
  content: { paddingHorizontal: railScreen.list.side, paddingBottom: railScreen.list.bottom },
  gap: { height: railScreen.list.gap },
});
