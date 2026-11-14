import { TextSizeSchema } from '@slovo/contracts';
import { FontSizeProvider, OptionSampleWord, OptionScreen, useTokens } from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useSettings } from '@/settings/settings';
import { useShown } from '@/shown-in-effect';

const strings = editionStrings.settings.textSize;

/**
 * Settings › «Шрифт і розмір» on board 11: the sample «Заграва» drawn at the
 * chosen step of the three-step text size, the line that explains it, then
 * «Як у системі», «Більший» and «Найбільший». A tap keeps the size in the
 * settings at once. With the `textSizeSteps` Feature Switch off in effect it
 * leads back to Settings, whose S…XL row stays (ADR 0134).
 */
export default function TextSizeScreen() {
  const { colors } = useTokens();
  const router = useRouter();
  const { textSizeSteps } = useShown();
  const { current, update } = useSettings();
  if (!textSizeSteps) return <Redirect href="/settings" />;
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
          <FontSizeProvider size={{ scale: 'ladder', step: selected }}>
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
