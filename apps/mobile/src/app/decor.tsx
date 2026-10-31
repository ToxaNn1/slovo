import { buildEntryCard, coreDecor, type EntryFeedCard } from '@slovo/core';
import {
  coreTokens,
  DecorBackground,
  DecorProvider,
  EmptyStateIllustration,
  EntryCard,
  minTouchTarget,
  SegmentedControl,
  space,
  SplashOverlay,
  TokensProvider,
  typeSize,
  useTokens,
  type ColorScheme,
} from '@slovo/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionDecor, editionStrings, editionTokens, splashImageWidth } from '@/edition/edition';
import { useEntries } from '@/content-update/language-pack';

type Look = 'edition' | 'core';

/**
 * A development screen that shows every Decor slot of 0.2 in the Edition's
 * Decor or the Core's, light or dark, whatever the Theme. Open it with
 * `xcrun simctl openurl booted slovo-<edition>://decor`; `?look=core`,
 * `?scheme=dark` and `?splash=1` start it in that state. Labels are for
 * developers only, so they are not Edition strings.
 */
export default function DecorShowcase() {
  const params = useLocalSearchParams<{ look?: string; scheme?: string; splash?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  // A new link starts over in the state it asks for.
  return <ShowcaseLooks key={JSON.stringify(params)} {...params} />;
}

function ShowcaseLooks(params: { look?: string; scheme?: string; splash?: string }) {
  const [look, setLook] = useState<Look>(params.look === 'core' ? 'core' : 'edition');
  const [scheme, setScheme] = useState<ColorScheme>(params.scheme === 'dark' ? 'dark' : 'light');
  return (
    <TokensProvider tokens={look === 'core' ? coreTokens : editionTokens} colorScheme={scheme}>
      <DecorProvider decor={look === 'core' ? coreDecor : editionDecor}>
        <Showcase
          look={look}
          onLook={setLook}
          scheme={scheme}
          onScheme={setScheme}
          splashFirst={params.splash === '1'}
        />
      </DecorProvider>
    </TokensProvider>
  );
}

function Showcase({
  look,
  onLook,
  scheme,
  onScheme,
  splashFirst,
}: {
  look: Look;
  onLook: (look: Look) => void;
  scheme: ColorScheme;
  onScheme: (scheme: ColorScheme) => void;
  splashFirst: boolean;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const cards = useFirstCards();
  const [splash, setSplash] = useState<'hidden' | 'shown' | 'fading'>(
    splashFirst ? 'shown' : 'hidden',
  );

  return (
    <View testID="decor-showcase" style={[styles.screen, { backgroundColor: colors.background }]}>
      <DecorBackground />
      <SafeAreaView edges={['top']} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <SegmentedControl
            accessibilityLabel="Decor"
            segments={[
              { value: 'edition', label: 'Edition', testID: 'decor-look-edition' },
              { value: 'core', label: 'Core', testID: 'decor-look-core' },
            ]}
            selected={look}
            onSelect={onLook}
          />
          <SegmentedControl
            accessibilityLabel="Colour scheme"
            segments={[
              { value: 'light', label: 'Light', testID: 'decor-scheme-light' },
              { value: 'dark', label: 'Dark', testID: 'decor-scheme-dark' },
            ]}
            selected={scheme}
            onSelect={onScheme}
          />

          <Slot label="1 background · 2 divider · 3 corners: a Word card">
            {cards.word === undefined ? null : <EntryCard card={cards.word} />}
          </Slot>

          <Slot label="2 divider with the arrow: a Correction card">
            {cards.correction === undefined ? null : <EntryCard card={cards.correction} />}
          </Slot>

          <Slot label="4 empty state (108 pt) · error (120 pt)">
            <View style={styles.row}>
              <EmptyStateIllustration width={108} />
              <EmptyStateIllustration kind="error" width={120} />
            </View>
          </Slot>

          <Slot label="7 splash">
            <Pressable
              testID="decor-show-splash"
              accessibilityRole="button"
              onPress={() => {
                setSplash('shown');
              }}
              style={[styles.button, { borderColor: colors.line, borderRadius: radii.button }]}
            >
              <Text style={[styles.label, { color: colors.accent, fontFamily: fontFamilies.ui }]}>
                Show the splash (tap it to close)
              </Text>
            </Pressable>
          </Slot>
        </ScrollView>
      </SafeAreaView>
      {splash !== 'hidden' && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            setSplash('fading');
          }}
        >
          <SplashOverlay
            wordmark={editionStrings.splash.wordmark}
            tagline={editionStrings.splash.tagline}
            markWidth={splashImageWidth}
            visible={splash === 'shown'}
            onHidden={() => {
              setSplash('hidden');
            }}
          />
        </Pressable>
      )}
    </View>
  );
}

function Slot({ label, children }: { label: string; children: ReactNode }) {
  const { colors, fontFamilies } = useTokens();
  return (
    <View style={styles.slot}>
      <Text style={[styles.label, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

interface ShowcaseCards {
  readonly word: EntryFeedCard | undefined;
  readonly correction: EntryFeedCard | undefined;
}

/**
 * The Entry cards of the first eligible Word and Correction of the Language
 * Pack, built by the Core as the Feed builds them: real Edition content.
 */
function useFirstCards(): ShowcaseCards {
  const entries = useEntries();
  const [cards, setCards] = useState<ShowcaseCards>({ word: undefined, correction: undefined });
  useEffect(() => {
    let active = true;
    async function firstCard(id: string | undefined) {
      const entry = id === undefined ? undefined : await entries.get(id);
      return entry === undefined ? undefined : buildEntryCard(entries, entry);
    }
    void entries
      .eligible()
      .then(async ({ words: [word], corrections: [correction] }) => ({
        word: await firstCard(word),
        correction: await firstCard(correction),
      }))
      .then((built) => {
        if (active) setCards(built);
      });
    return () => {
      active = false;
    };
  }, [entries]);
  return cards;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space[6], gap: space[3] },
  slot: { gap: space[2], marginTop: space[2] },
  label: { fontSize: typeSize.body, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  button: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
