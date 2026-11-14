import { CorrectionTypeSchema, fill, type CorrectionType } from '@slovo/contracts';
import type { CorrectionTypeRow as CorrectionTypeRowEntry } from '@slovo/core';
import {
  correctionTile,
  CorrectionTypeRow,
  RailList,
  railScreen,
  RailScreenHero,
  useEdition,
  useListScroll,
} from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import type { FlatList } from 'react-native';

import { useCorrectionTypeScreen } from '@/dashboard/correction-type';
import { editionStrings } from '@/edition/edition';
import { useSegmentParam } from '@/route-params';
import { ListTopButton } from '@/shell/list-top';

const words = editionStrings.dashboard.correctionTypes;

/** A Correction Type's screen, from its tile on the Dashboard; an unknown type returns home. */
export default function CorrectionTypeRoute() {
  const parsed = CorrectionTypeSchema.safeParse(useSegmentParam('type'));
  return parsed.success ? <CorrectionTypeScreen type={parsed.data} /> : <Redirect href="/" />;
}

/**
 * The type's red hero over its Corrections, each revealed in place with
 * «Відповідь» (ADR 0076), as the board's «fix» screen draws it.
 */
function CorrectionTypeScreen({ type }: { type: CorrectionType }) {
  const { title, description, place, rows, reveal } = useCorrectionTypeScreen(type);
  const { count } = useEdition();
  const router = useRouter();
  const scroll = useListScroll<FlatList<CorrectionTypeRowEntry>>();
  const total = rows?.length ?? 0;
  const done = rows?.filter(({ workedThrough }) => workedThrough).length ?? 0;
  const glyph =
    correctionTile.glyphs[place % correctionTile.glyphs.length] ?? correctionTile.glyphs[0];
  return (
    <RailList
      testID="correction-type"
      items={rows ?? []}
      keyOf={({ correction }) => correction.id}
      renderItem={({ item, index }) => (
        <CorrectionTypeRow
          correction={item.correction}
          workedThrough={item.workedThrough}
          index={index}
          onReveal={() => {
            reveal(item.correction.id);
          }}
        />
      )}
      gap={railScreen.list.gap}
      scroll={scroll}
      corner={<ListTopButton scroll={scroll} />}
      hero={
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
    />
  );
}
