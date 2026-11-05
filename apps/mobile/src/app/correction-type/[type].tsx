import { CorrectionTypeSchema, type CorrectionType } from '@slovo/contracts';
import type { CorrectionTypeRow as Row } from '@slovo/core';
import { BackLink, CorrectionTypeRow, ScreenTitle, space, useTokens } from '@slovo/ui';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCorrectionTypeScreen } from '@/dashboard/correction-type';
import { editionStrings } from '@/edition/edition';

/** A Correction Type's screen, from its tile on the Dashboard; an unknown type returns home. */
export default function CorrectionTypeRoute() {
  const parsed = CorrectionTypeSchema.safeParse(useLocalSearchParams<{ type: string }>().type);
  return parsed.success ? <CorrectionTypeScreen type={parsed.data} /> : <Redirect href="/" />;
}

/** The type's name over its Corrections, each revealed in place with «Як правильно?» (ADR 0076). */
function CorrectionTypeScreen({ type }: { type: CorrectionType }) {
  const { title, rows, reveal } = useCorrectionTypeScreen(type);
  const { colors } = useTokens();
  const router = useRouter();
  return (
    <SafeAreaView
      testID="correction-type"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
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
          <>
            <View style={styles.bar}>
              <BackLink
                testID="correction-type-back"
                label={editionStrings.tabs.home}
                onPress={() => {
                  router.back();
                }}
              />
            </View>
            <View style={styles.header}>
              <ScreenTitle>{title}</ScreenTitle>
            </View>
          </>
        }
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { paddingLeft: space[3], paddingTop: space[2] },
  header: { paddingHorizontal: space[6], paddingTop: space[2], paddingBottom: space[2] },
  content: { paddingBottom: space[8] },
});
