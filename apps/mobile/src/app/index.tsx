import { renderStress, type Word } from '@slovo/core';
import { colors, Placeholder, WordCard } from '@slovo/ui';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition';
import { useContent } from '../language-pack';

type HomeWord = { status: 'loading' } | { status: 'ready'; word: Word | undefined };

/** Home shows one Word from the bundled Language Pack until the Feed arrives in 0.2. */
export default function HomeScreen() {
  const content = useContent();
  const [state, setState] = useState<HomeWord>({ status: 'loading' });
  const palette = colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  useEffect(() => {
    let active = true;
    void content.firstWord().then((word) => {
      if (active) setState({ status: 'ready', word });
    });
    return () => {
      active = false;
    };
  }, [content]);

  if (state.status === 'loading') return null;
  const { word } = state;
  if (word === undefined) return <Placeholder message={editionStrings.noWords} />;

  return (
    <SafeAreaView testID="home" style={[styles.screen, { backgroundColor: palette.background }]}>
      <WordCard
        lemma={edition.languageTraits.marksStress ? renderStress(word) : word.lemma}
        partOfSpeech={editionStrings.partsOfSpeech[word.partOfSpeech]}
        primaryDefinition={word.primaryDefinition}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center' },
});
