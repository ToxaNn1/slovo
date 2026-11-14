import { MascotAs } from '@/mascot/mascot';
import type { DueQuestion } from '@slovo/core';
import {
  DueQuizCard,
  DueQuizSheet,
  EmptyState,
  LearningRow,
  space,
  useListScroll,
  UndoToastProvider,
  useUndoToast,
} from '@slovo/ui';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';
import type { ListHeader } from '@/saved/list-header';
import { useDueQuiz } from '@/saved/due-quiz';
import { useLearningList } from '@/saved/learning';
import { ListTopButton } from '@/shell/list-top';

const { learning: strings } = editionStrings;

/**
 * The «Вчу» list: every Entry the reader is learning, the next Review first,
 * each row with its meaning and its Review day on a chip (board 09). A tap opens the Entry screen. The list is the
 * Core's own: it has no rename, delete or swipe action, and an Entry leaves it
 * once it is Learned or its mark is removed. Over the rows, while Words are
 * due today, the Due Quiz card «Перевір себе» opens its sheet, which asks the
 * questions as they were when it opened and ends with a toast (ADR 0131).
 */
export function LearningList({ header }: { header: ListHeader }) {
  return (
    <UndoToastProvider>
      <Learning header={header} />
    </UndoToastProvider>
  );
}

function Learning({ header }: { header: ListHeader }) {
  const list = useLearningList();
  const openScreen = useOpenScreen();
  const scroll = useListScroll<FlatList<(typeof list)[number]>>();
  const { list: listRef, onScroll: onListScroll } = scroll;
  const dueQuiz = useDueQuiz();
  const showToast = useUndoToast();
  const [asking, setAsking] = useState<{
    readonly questions: readonly DueQuestion[];
    readonly opening: number;
  }>();
  const [visible, setVisible] = useState(false);
  const top = header(null);

  return (
    <>
      <FlatList
        ref={listRef}
        onScroll={onListScroll}
        testID="learning"
        data={list}
        keyExtractor={(entry) => entry.entryId}
        renderItem={({ item: entry }) => (
          <LearningRow
            entry={entry}
            onPress={() => {
              openScreen(`/saved/learning/${entry.entryId}`);
            }}
          />
        )}
        ListHeaderComponent={
          dueQuiz.questions.length === 0 ? (
            top
          ) : (
            <>
              {top}
              <View style={styles.dueQuiz}>
                <DueQuizCard
                  count={dueQuiz.questions.length}
                  onStart={() => {
                    setAsking({
                      questions: dueQuiz.questions,
                      opening: (asking?.opening ?? 0) + 1,
                    });
                    setVisible(true);
                  }}
                />
              </View>
            </>
          )
        }
        ListEmptyComponent={
          <EmptyState
            mascot={(width) => <MascotAs state="sleeps" width={width} />}
            testID="learning-empty"
            title={strings.empty.title}
            message={strings.empty.message}
          />
        }
        contentContainerStyle={styles.content}
      />
      <ListTopButton scroll={scroll} overTabBar />
      {asking !== undefined && (
        <DueQuizSheet
          key={asking.opening}
          visible={visible}
          questions={asking.questions}
          onAnswer={dueQuiz.answer}
          onDone={(message) => {
            setVisible(false);
            showToast({ look: 'plate', message });
          }}
          onClose={() => {
            setVisible(false);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // The list grows to the screen, so an empty state sits in the middle of it.
  content: { flexGrow: 1, paddingBottom: space[8] },
  dueQuiz: { paddingHorizontal: space[4], paddingBottom: space[3] },
});
