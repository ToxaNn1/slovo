import type { Composition, OptionQuestion } from '@slovo/core';
import { BackHeader, Button, Chip, SectionLabel, space, useTokens } from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../composition';
import { keep } from '../keep';
import { editionStrings } from '../edition/edition';
import { InterestChips } from '../feed/later-question-notice';
import { useMixState } from '../mix/mix';
import { useShown } from '../shown-in-effect';

const { onboarding, feedNotices, settings } = editionStrings;

/** The answers the retake holds until «ГОТОВО». */
type Answers = Partial<Record<OptionQuestion, string>>;

/**
 * Settings › Пройти опитування ще раз (ADR 0067), one screen: «Рівень» and
 * «Навіщо» while the questionnaire is on, the self-rating while the Rarity
 * Test is on, and the interests while «Що тобі цікаво?» is on. The screen holds the answers and «ГОТОВО»
 * applies them through the Core's questionnaire, as the onboarding and the
 * Feed Notices do; leaving without it drops them. The Rarity Test has its own
 * row.
 */
export function QuestionnaireScreen() {
  const { colors } = useTokens();
  const router = useRouter();
  const { questionnaire } = useComposition();
  const shown = useShown().questionnaire;
  const { categoryIds } = useMixState();
  const [answers, setAnswers] = useState<Answers>({});
  const [interests, setInterests] = useState<readonly string[]>(categoryIds);
  // «ГОТОВО» works once: a second tap would write the answers again and go back twice.
  const applying = useRef(false);
  const [busy, setBusy] = useState(false);
  if (shown === undefined) return <Redirect href="/settings" />;

  const questions: readonly { question: OptionQuestion; title: string }[] = [
    ...(shown.levelWhy
      ? [
          { question: 'level' as const, title: onboarding.level.title },
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
      edges={['top', 'bottom']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <BackHeader
          titleRole="settingsSubTitle"
          title={settings.questionnaireRetake.title}
          back={{
            label: settings.title,
            testID: 'questionnaire-back',
            onPress: () => {
              router.back();
            },
          }}
        />
        {questions.map(({ question, title }) => (
          <View key={question} style={styles.section}>
            <SectionLabel>{title}</SectionLabel>
            <View style={styles.chips}>
              {questionnaire.options[question].map(({ id, label }) => (
                <Chip
                  key={id}
                  testID={`questionnaire-${question}-${id}`}
                  label={label}
                  on={answers[question] === id}
                  onPress={() => {
                    setAnswers((before) => ({ ...before, [question]: id }));
                  }}
                />
              ))}
            </View>
          </View>
        ))}
        {shown.interests && (
          <View style={styles.section}>
            <SectionLabel>{feedNotices.laterQuestions.interests.title}</SectionLabel>
            <InterestChips
              testIDPrefix="questionnaire"
              picked={interests}
              onChange={setInterests}
            />
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          testID="questionnaire-done"
          label={settings.questionnaireRetake.done}
          busy={busy}
          onPress={() => {
            if (applying.current) return;
            applying.current = true;
            setBusy(true);
            const answered = questions.flatMap(({ question }) => {
              const answerId = answers[question];
              return answerId === undefined ? [] : [{ question, answerId }];
            });
            const changed =
              !shown.interests || sameIds(interests, categoryIds) ? undefined : interests;
            // `apply` keeps going past a failed write, so the screen always closes after it.
            void apply(questionnaire, answered, changed).then(() => {
              router.back();
            });
          }}
        />
      </View>
    </SafeAreaView>
  );
}

/** Writes each answer held, then the interests when they changed. */
async function apply(
  questionnaire: Composition['questionnaire'],
  answered: readonly { question: OptionQuestion; answerId: string }[],
  interests: readonly string[] | undefined,
) {
  for (const { question, answerId } of answered) {
    await keep('the answer to a question', questionnaire.answer(question, answerId));
  }
  if (interests !== undefined)
    await keep('the interests', questionnaire.chooseInterests(interests));
}

function sameIds(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[5] },
  section: { gap: space[3], paddingTop: space[2], paddingBottom: space[5] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  footer: { paddingHorizontal: space[5], paddingVertical: space[4] },
});
