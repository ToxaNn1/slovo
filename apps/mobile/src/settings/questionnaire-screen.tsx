import type { OptionQuestion } from '@slovo/core';
import { BackLink, OutlineButton, ScreenTitle, SectionLabel, space, useTokens } from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
import { editionStrings } from '../edition/edition';
import { InterestsChoice } from '../feed/later-question-notice';
import { useShown } from '../shown-in-effect';

const { onboarding, feedNotices, settings } = editionStrings;

/**
 * Settings › Пройти опитування ще раз (ADR 0067): «Хто ви» and «Навіщо» while
 * the questionnaire is on, the self-rating while the Rarity Floor is on, and
 * the interests. Each answer
 * applies at once through the Core's questionnaire, as on the onboarding and
 * the Feed Notices; the Rarity Test has its own row.
 */
export function QuestionnaireScreen() {
  const { colors } = useTokens();
  const router = useRouter();
  const { questionnaire } = useComposition();
  const shown = useShown().questionnaire;
  const [answered, setAnswered] = useState<Partial<Record<OptionQuestion, string>>>({});
  if (shown === undefined) return <Redirect href="/settings" />;

  const questions: readonly { question: OptionQuestion; title: string }[] = [
    ...(shown.whoWhy
      ? [
          { question: 'who' as const, title: onboarding.who.title },
          { question: 'why' as const, title: onboarding.why.title },
        ]
      : []),
    ...(shown.selfRating
      ? [{ question: 'selfRating' as const, title: feedNotices.laterQuestions.selfRating.title }]
      : []),
  ];

  return (
    <SafeAreaView
      testID="questionnaire"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <BackLink
          testID="questionnaire-back"
          label={settings.title}
          onPress={() => {
            router.back();
          }}
        />
        <View style={styles.section}>
          <ScreenTitle>{settings.rows.questionnaire}</ScreenTitle>
        </View>
        {questions.map(({ question, title }) => (
          <View key={question} style={styles.section}>
            <SectionLabel>{title}</SectionLabel>
            {questionnaire.options[question].map(({ id, label }) => (
              <OutlineButton
                key={id}
                testID={`questionnaire-${question}-${id}`}
                label={label}
                selected={answered[question] === id}
                onPress={() => {
                  questionnaire.answer(question, id).then(
                    () => {
                      setAnswered((before) => ({ ...before, [question]: id }));
                    },
                    (error: unknown) => {
                      logError('Could not retake a question', error);
                    },
                  );
                }}
              />
            ))}
          </View>
        ))}
        <View style={styles.section}>
          <SectionLabel>{feedNotices.laterQuestions.interests.title}</SectionLabel>
          <InterestsChoice
            testIDPrefix="questionnaire"
            onDone={(categoryIds) => {
              questionnaire.chooseInterests(categoryIds).catch((error: unknown) => {
                logError('Could not retake the interests', error);
              });
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  section: { gap: space[3], paddingTop: space[2], paddingBottom: space[5] },
});
