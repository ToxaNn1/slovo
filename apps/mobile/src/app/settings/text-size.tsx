import { TextSizeSchema } from '@slovo/contracts';
import { FontSizeProvider, OptionSampleWord, OptionScreen, useTokens } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useSettings } from '@/settings/settings';

const strings = editionStrings.settings.textSize;

/**
 * Settings › «Шрифт і розмір» on board 11: the sample «Заграва» drawn at the
 * chosen step of the three-step text size, the line that explains it, then
 * «Як у системі», «Більший» and «Найбільший». A tap keeps the size in the
 * settings at once (ADR 0134).
 */
export default function TextSizeScreen() {
  const { colors } = useTokens();
  const router = useRouter();
  const { current, update } = useSettings();
  const selected = current.textSize;
  return (
    <SafeAreaView
      testID="text-size-screen"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <OptionScreen
        testID="text-size"
        title={strings.title}
        subtitle={strings.subtitle}
        back={{
          label: editionStrings.settings.title,
          testID: 'text-size-back',
          onPress: () => {
            router.back();
          },
        }}
        sample={
          <FontSizeProvider size={selected}>
            <OptionSampleWord
              lemma={strings.preview.lemma}
              definition={strings.preview.definition}
            />
          </FontSizeProvider>
        }
        explanation={strings.explanations[selected]}
        options={TextSizeSchema.options.map((size) => ({
          value: size,
          label: strings.sizes[size],
          testID: `text-size-${size}`,
        }))}
        selected={selected}
        onSelect={(textSize) => {
          update({ textSize });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
