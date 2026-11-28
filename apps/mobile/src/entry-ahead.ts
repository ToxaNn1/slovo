import type { AnyEntryCard, Composition } from '@slovo/core';
import { usePathname } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { useComposition } from './composition';
import { useOpenScreen } from './use-open-screen';

/** An Entry card read before its screen opened: `null` for an id the Language Pack doesn't have. */
interface EntryAhead {
  readonly in: Composition;
  readonly entryId: string;
  readonly card: AnyEntryCard | null;
}

/** The last card read ahead, until the screen it was read for has opened. */
let ahead: EntryAhead | undefined;

/**
 * Opens an Entry screen from a tap once its card is read, so the screen draws
 * the card in its first render and the card mounts before the push slides
 * rather than in the middle of it (27.11 pass: the Entry popped in mid-slide
 * and the slide stalled). Only for a way in that makes nothing Seen by its
 * opening (a list, a link inside the app, Search), whose read is the plain
 * `entryCard`. A read that fails opens the screen all the same, which reads
 * again and shows the failure. A read that ends once another tap came after
 * it, or once the screen tapped on is no longer before the reader, opens
 * nothing.
 */
export function useOpenEntry(): (entryId: string, href: string) => void {
  const composition = useComposition();
  const openScreen = useOpenScreen();
  /** The path before the reader, which a tab switch or a back changes. */
  const pathname = usePathname();
  const here = useRef<string | undefined>(pathname);
  useEffect(() => {
    here.current = pathname;
    return () => {
      here.current = undefined;
    };
  }, [pathname]);
  /** Counts the taps, so only the latest one opens its screen. */
  const taps = useRef(0);
  return useCallback(
    (entryId: string, href: string) => {
      taps.current += 1;
      const tap = taps.current;
      const tappedOn = here.current;
      const holds = () => tap === taps.current && here.current === tappedOn;
      composition.entryCard(entryId).then(
        (card) => {
          if (!holds()) return;
          ahead = { in: composition, entryId, card: card ?? null };
          // A screen still opening kept this one shut: no card waits for it.
          if (!openScreen(href)) ahead = undefined;
        },
        () => {
          if (holds()) openScreen(href);
        },
      );
    },
    [composition, openScreen],
  );
}

/** The card read ahead for this Entry in this composition, if there is one. */
export function entryReadAhead(
  composition: Composition,
  entryId: string,
): { readonly value: AnyEntryCard | null } | undefined {
  return ahead?.in === composition && ahead.entryId === entryId ? { value: ahead.card } : undefined;
}

/** Drops the card read ahead once its screen has drawn it, so a later opening reads afresh. */
export function forgetEntryAhead(entryId: string): void {
  if (ahead?.entryId === entryId) ahead = undefined;
}
