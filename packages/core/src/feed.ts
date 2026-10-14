import type { Entry, Word } from '@slovo/contracts';

import { buildCorrectionCard, type CorrectionCardModel } from './correction-card';
import type { Cycle } from './cycle';
import type { Entries } from './entries';
import type { HistoryRecorder, Seen } from './history';
import { createInTurn, createSubscribers } from './in-turn';
import { dateKeyOf, todayKey, type LocalDate } from './local-date';
import type { Clock, UserStateChanges } from './ports';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';
import { buildWordCard, type WordCardModel } from './word-card';
import type { WordOfTheDay, WordOfTheDayChoice } from './word-of-the-day';

/** How long a card must stay on screen before its Entry counts as Seen. */
export const SEEN_DWELL_MS = 1500;

/** One card in this many is a Correction's, while the Cycle has unseen Corrections. */
export const CORRECTION_EVERY = 5;

/** The card of a Word. */
export interface WordFeedCard {
  readonly kind: 'word';
  /** What the card shows, built by the Core. */
  readonly wordCard: WordCardModel;
  /** On the card of the Word of the Day: the local day it is the Word of. */
  readonly wordOfTheDay?: LocalDate;
}

/** The card of a Correction. */
export interface CorrectionFeedCard {
  readonly kind: 'correction';
  /** What the card shows, built by the Core. */
  readonly correctionCard: CorrectionCardModel;
}

/** The card of an Entry: a Word or a Correction. */
export type EntryFeedCard = WordFeedCard | CorrectionFeedCard;

/**
 * One card of the Feed: an Entry, or the end-of-Cycle card that tells the
 * reader every live Entry is Seen and the next card starts a new Cycle.
 */
export type FeedCard = EntryFeedCard | { readonly kind: 'end-of-cycle' };

/** The id of the Entry a card shows, if it shows one. */
export function entryIdOf(card: EntryFeedCard): string;
export function entryIdOf(card: FeedCard | undefined): string | undefined;
export function entryIdOf(card: FeedCard | undefined): string | undefined {
  if (card?.kind === 'word') return card.wordCard.wordId;
  return card?.kind === 'correction' ? card.correctionCard.correctionId : undefined;
}

/**
 * The Feed of one app session. Its cards are the ones shown so far, oldest
 * first; a card's position is its index there, so going back walks them. A
 * card whose Entry stops being eligible leaves them at once, and goes back to
 * its place when its Entry is eligible again (ADR 0015).
 */
export interface Feed {
  /**
   * The cards shown so far. A change never edits this array: it makes a new
   * one and tells the subscribers.
   */
  readonly cards: readonly FeedCard[];
  /**
   * The position of the card the Feed opens on: the card the reader was on,
   * after today's Word of the Day, when they come back the same local day.
   */
  readonly startPosition: number;
  /**
   * The reader's position, as the Feed keeps it: the card on screen, or,
   * while none is, the card the reader left, and `startPosition` until the
   * first card is on screen. It moves with the cards when a change of
   * eligibility drops or puts back cards, on screen or not: the reader's card
   * keeps its place, the next card takes it when the reader's card is
   * dropped, and a card put back takes it back if it left it and the reader
   * hasn't moved to another card since. A shell turns to it after the cards
   * change. When no card after the dropped one stays, the next card comes in
   * the same change and takes the place; only when the Feed has no next card
   * is it one past the last card.
   */
  readonly position: number;
  /** Calls `listener` after each change of the cards. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
  /**
   * Tells the Feed which card is on screen now, or that none is (the screen
   * is out of focus or the app in the background); the Feed keeps the
   * reader's place on the card that left. The card that leaves the
   * screen makes its Entry Seen if it stayed there for at least
   * `SEEN_DWELL_MS` and belongs to the current Cycle. While a card is on
   * screen, the Feed keeps the card after it ready, so the next swipe never
   * waits; once the composition turns to a new local day, today's Word of the
   * Day takes the place of a card got ready the day before. Reporting the
   * card already on screen again keeps its dwell time and only gets the next
   * card ready if that failed before. Resolves once
   * the report is kept and the next card is ready.
   */
  show(position: number | undefined): Promise<void>;
  /**
   * Adds the next card to the session and returns it, or nothing when the
   * Language Pack has no live Entry. After the last unseen Entry of the Cycle
   * comes the end-of-Cycle card.
   */
  next(): Promise<FeedCard | undefined>;
  /**
   * Opens a Correction the Word card at `position` links («often said»): its
   * card goes right after the Word's, and the Feed goes on after it. Returns
   * the position of the Correction's card, or nothing when the Word card
   * doesn't link that Correction.
   */
  openLinkedCorrection(position: number, correctionId: string): Promise<number | undefined>;
}

/**
 * The card of an Entry, built from the Language Pack's Entries. The card of a
 * Word on the day it is the Word of the Day carries that day.
 */
export async function buildEntryCard(
  entries: Entries,
  entry: Word,
  wordOfTheDay?: LocalDate,
): Promise<WordFeedCard>;
export async function buildEntryCard(entries: Entries, entry: Entry): Promise<EntryFeedCard>;
export async function buildEntryCard(
  entries: Entries,
  entry: Entry,
  wordOfTheDay?: LocalDate,
): Promise<EntryFeedCard> {
  if (entry.kind === 'correction') {
    return { kind: 'correction', correctionCard: buildCorrectionCard(entry) };
  }
  const wordCard = await buildWordCard({ word: entry, entries });
  return wordOfTheDay === undefined
    ? { kind: 'word', wordCard }
    : { kind: 'word', wordCard, wordOfTheDay };
}

const { feedPosition } = userStateRecords;

/**
 * Opens the Feed for a new app session, over the Entries, the Cycle and the
 * Word of the Day the Core composition opened and shares with every other
 * feature. It opens on the card the reader was on when they come back the
 * same local day, and otherwise on the Word of the Day.
 *
 * The composition calls `openDay` with the local day it is whenever it turns
 * to a new one. A day the Feed hasn't opened with its Word of the Day yet
 * opens with it: the Word of the Day comes next, in place of a card got
 * ready the day before, also in a Feed left open over midnight.
 *
 * After the Cycle's last unseen Entry comes the end-of-Cycle card, and the
 * card after that starts a new Cycle: nothing Seen, a new shuffle from a new
 * seed. When the reader swipes past that Entry before it is Seen, its card
 * comes again in place of the end-of-Cycle card. A new local day that finds every Word Seen starts the new Cycle
 * itself, with its Word of the Day and no end-of-Cycle card, because the
 * Word of the Day always opens the day.
 *
 * The Cycle covers the eligible Entries. When they hold Corrections, every
 * `CORRECTION_EVERY`th card is a Correction's while the Cycle has unseen
 * Corrections. Corrections are shuffled and Seen like Words, and the Cycle
 * ends only once every eligible Word and Correction is Seen. The Word of the
 * Day is always a Word.
 *
 * The composition calls `followEligibility` once the Cycle has read the
 * eligible Entries again: the Feed drops every card whose Entry the Cycle no
 * longer covers and puts back the dropped ones it covers again, see
 * `Feed.position` for the reader's place. A card that leaves the screen this
 * way is Seen by the dwell rule, like any card that leaves it.
 *
 * The composition calls `markOpenedSeen` for an Entry opened outside the
 * Feed, from a notification: it becomes Seen with its History entry and the
 * caller's `changes` in one write, in turn with the cards, so a new Cycle
 * never starts in between. It joins History as the Word of the Day's card
 * only if it is today's Word of the Day. An Entry the Cycle doesn't cover
 * (Hidden, Retired, out of the Mix) or one Seen already gets only `changes`
 * written, so a Hidden Entry never re-enters History.
 *
 * Once an Entry becomes Seen, by either way, the Feed calls `entrySeen`, for
 * the composition to follow it.
 */
export async function openFeed({
  entries,
  userState,
  clock,
  cycle,
  wordOfTheDay,
  history,
  entrySeen,
}: {
  entries: Entries;
  userState: UserState;
  clock: Clock;
  cycle: Cycle;
  wordOfTheDay: WordOfTheDay;
  history: HistoryRecorder;
  entrySeen: (entryId: string) => Promise<void>;
}): Promise<{
  feed: Feed;
  followEligibility: () => Promise<void>;
  markOpenedSeen: (entryId: string, changes: UserStateChanges) => Promise<void>;
  openDay: (day: string) => Promise<void>;
}> {
  /**
   * Every card of the session, oldest first, also the ones dropped because
   * their Entry stopped being eligible: a dropped card keeps its place here
   * and goes back to it when its Entry is eligible again. Places count in
   * here; positions count in `cards`.
   */
  let session: readonly FeedCard[] = [];
  /** The cards of the session dropped because their Entry is not eligible now. */
  let dropped: ReadonlySet<FeedCard> = new Set();
  /** The cards shown: the session's cards not dropped. */
  let cards: readonly FeedCard[] = [];
  const subscribers = createSubscribers();
  /** The place of the current Cycle's first card: the cards before it belong to an earlier Cycle. */
  let cycleStart = 0;
  /** The place of the reader's card: the one on screen, or the one the reader left while none is. */
  let place = 0;
  /** Since when the reader's card is on screen, or nothing while no card is. */
  let onScreenSince: number | undefined;
  /**
   * The card dropped from the reader's place while the reader hasn't moved to
   * another card since: it takes the place back when its Entry is eligible
   * again, as on an undo.
   */
  let droppedFromPlace: FeedCard | undefined;
  /**
   * The local day `YYYY-MM-DD` the Feed last opened with its Word of the Day.
   * Another feature may choose a new day's Word of the Day first, such as a
   * notification that opens its morning Word, so a chosen Word of the Day
   * alone doesn't open the day.
   */
  let openedDay: string | undefined;
  /** Whether the composition turned to a local day the Feed hasn't opened yet. */
  let dayToOpen = false;

  /** Changes the session's cards without telling the subscribers yet. */
  function setSession(changed: readonly FeedCard[], changedDropped = dropped): void {
    session = changed;
    dropped = changedDropped;
    cards = session.filter((card) => !dropped.has(card));
  }

  function changeSession(changed: readonly FeedCard[], changedDropped = dropped): void {
    setSession(changed, changedDropped);
    subscribers.tell();
  }

  /** The position of the card at `place`, or of the card that will come there. */
  const positionOf = (place: number) =>
    session.slice(0, place).filter((card) => !dropped.has(card)).length;

  /** The place of the card at `position`, or of the card that will come there. */
  function placeOf(position: number): number {
    const card = cards[position];
    return card === undefined ? session.length + position - cards.length : session.indexOf(card);
  }

  /** The cards shown in the current Cycle. */
  const cycleCards = () => session.slice(cycleStart).filter((card) => !dropped.has(card));

  /**
   * The session without the card, if given, for the change about to be made:
   * the places after it move one back, the reader's too.
   */
  function without(card: FeedCard | undefined): readonly FeedCard[] {
    const removed = card === undefined ? -1 : session.indexOf(card);
    if (removed === -1) return session;
    if (cycleStart > removed) cycleStart -= 1;
    if (place > removed) place -= 1;
    return session.filter((kept) => kept !== card);
  }

  /**
   * Opens on the card the reader was on, if it was today and the Cycle still
   * covers its Entry, after today's Word of the Day, so the reader can go back to it.
   */
  async function restore(): Promise<boolean> {
    const position = await userState.read(feedPosition);
    if (position?.date !== todayKey(clock)) return false;
    if (!cycle.covers(position.entryId)) return false;
    const entry = await entries.get(position.entryId);
    if (entry === undefined) return false;
    const today = wordOfTheDay.chosen();
    if (today !== undefined) openedDay = position.date;
    const opening =
      today !== undefined && cycle.covers(today.wordId) ? await wordOfTheDayCard(today) : undefined;
    if (opening?.wordCard.wordId === entry.id) changeSession([opening]);
    else
      changeSession([
        ...(opening === undefined ? [] : [opening]),
        await buildEntryCard(entries, entry),
      ]);
    return true;
  }

  /**
   * The ids of the Entries shown in this session in the current Cycle, also
   * the dropped ones, which are shown again when their Entry is eligible again.
   */
  function shownIds(shown = session): Set<string> {
    return new Set(shown.slice(cycleStart).flatMap((card) => entryIdOf(card) ?? []));
  }

  /**
   * The next Entry in the Cycle order: one not shown in this session yet, else
   * one the reader swiped past too quickly to be Seen. Never the Entry of the
   * last card, which the reader is on while the app gets the next card ready:
   * when it is the only unseen Entry left, the Cycle ends after it. A
   * Correction takes its turn every `CORRECTION_EVERY`th card of the Cycle,
   * and either kind of Entry fills in for the other when it has none left.
   */
  function nextEntryId(): string | undefined {
    const { words: unseenWords, corrections: unseenCorrections } = cycle.unseen();
    const shown = shownIds();
    const last = entryIdOf(cards.at(-1));
    const inCycle = cycleCards();
    const sinceCorrection = [...inCycle].reverse().findIndex((card) => card.kind === 'correction');
    const cardsSinceCorrection = sinceCorrection === -1 ? inCycle.length : sinceCorrection;
    const correctionTurn = cardsSinceCorrection >= CORRECTION_EVERY - 1;
    function pick(fits: (id: string) => boolean): string | undefined {
      const word = unseenWords.find(fits);
      const correction = unseenCorrections.find(fits);
      return correctionTurn ? (correction ?? word) : (word ?? correction);
    }
    return pick((id) => !shown.has(id)) ?? pick((id) => id !== last);
  }

  // One request at a time, so two requests never pick the same Entry.
  const inTurn = createInTurn();

  async function addNextCard(): Promise<FeedCard | undefined> {
    const last = cards.at(-1);
    // The last card shown is the current Cycle's end-of-Cycle card, not one of
    // an earlier Cycle whose next cards were all dropped.
    const atEnd = last?.kind === 'end-of-cycle' && session.indexOf(last) >= cycleStart;
    const { words: unseenWords, corrections: unseenCorrections } = cycle.unseen();
    // The end-of-Cycle card came too early when the reader left the last unseen
    // Entry before it was Seen: the next card takes its place.
    const tooEarly = atEnd && unseenWords.length + unseenCorrections.length > 0 ? last : undefined;
    // A new local day starts with its Word of the Day, also in a Feed left open over midnight.
    if (dayToOpen) {
      const card = await addWordOfTheDay(tooEarly);
      if (card !== undefined) return card;
    }
    if (cycle.isEmpty()) return undefined;
    // The card after the end-of-Cycle card starts a new Cycle.
    if (atEnd && tooEarly === undefined) {
      const started = await cycle.start();
      await userState.write(started.changes);
      started.commit();
      cycleStart = session.length;
    }
    const id = nextEntryId();
    if (id === undefined) {
      const card: FeedCard = { kind: 'end-of-cycle' };
      changeSession([...without(tooEarly), card]);
      return card;
    }
    const entry = await entries.get(id);
    if (entry === undefined) return undefined;
    const card = await buildEntryCard(entries, entry);
    changeSession([...without(tooEarly), card]);
    return card;
  }

  async function insertLinkedCorrection(
    position: number,
    correctionId: string,
  ): Promise<number | undefined> {
    const card = cards[position];
    const linked = card?.kind === 'word' ? card.wordCard.linkedCorrections : [];
    if (card === undefined || !linked.some((link) => link.correctionId === correctionId))
      return undefined;
    // Tapped again: the Correction's card is already there.
    if (entryIdOf(cards[position + 1]) === correctionId) return position + 1;
    const correction = await entries.get(correctionId);
    if (correction?.kind !== 'correction') return undefined;
    const opened = await buildEntryCard(entries, correction);
    const at = session.indexOf(card);
    // The cards after it move one place on, the reader's too.
    if (cycleStart > at) cycleStart += 1;
    if (place > at) place += 1;
    changeSession([...session.slice(0, at + 1), opened, ...session.slice(at + 1)]);
    return position + 1;
  }

  /** The card of a day's Word of the Day. */
  async function wordOfTheDayCard(choice: WordOfTheDayChoice): Promise<WordFeedCard | undefined> {
    const entry = await entries.get(choice.wordId);
    return entry?.kind === 'word' ? buildEntryCard(entries, entry, choice.date) : undefined;
  }

  /**
   * Adds the card of today's Word of the Day at the end, in place of the
   * `replaced` card if given, choosing it first if today has none yet.
   */
  async function addWordOfTheDay(replaced?: FeedCard): Promise<FeedCard | undefined> {
    const today = await wordOfTheDay.today({
      avoid: shownIds(session.filter((card) => card !== replaced)),
    });
    if (today === undefined) return undefined;
    const card = await wordOfTheDayCard(today);
    if (card === undefined) return undefined;
    openedDay = dateKeyOf(today.date);
    dayToOpen = false;
    const kept = without(replaced);
    if (today.startedCycle) cycleStart = kept.length;
    changeSession([...kept, card]);
    return card;
  }

  const next = () => inTurn(addNextCard);

  /** Whether the card on screen is the last one, so the card after it is not ready yet. */
  const nextCardMissing = () =>
    onScreenSince !== undefined && positionOf(place) >= cards.length - 1;

  /**
   * Whether the ready card, the last one, which the reader hasn't reached, was
   * got ready on an earlier local day: the Feed hasn't opened today yet.
   */
  const readyCardStale = () =>
    onScreenSince !== undefined && positionOf(place) < cards.length - 1 && dayToOpen;

  /** Puts today's Word of the Day in place of a ready card got ready on an earlier local day. */
  async function replaceStaleReadyCard(): Promise<void> {
    if (readyCardStale()) await addWordOfTheDay(cards.at(-1));
  }

  // One card is got ready at a time; it goes on while the card on screen is the last.
  let gettingReady: Promise<void> | undefined;
  function keepNextCardReady(): Promise<void> {
    if (gettingReady === undefined && (nextCardMissing() || readyCardStale())) {
      gettingReady = (async () => {
        try {
          await inTurn(replaceStaleReadyCard);
          while (nextCardMissing()) {
            if ((await next()) === undefined) return;
          }
        } finally {
          gettingReady = undefined;
        }
      })();
    }
    return gettingReady ?? Promise.resolve();
  }

  /** The Entry of a card that left the screen, if it stayed there long enough to be Seen. */
  function seenOnLeaving(left: FeedCard | undefined, stayed: number): string | undefined {
    const entryId = entryIdOf(left);
    // A card of an earlier Cycle counts for that Cycle only.
    if (left === undefined || entryId === undefined || session.indexOf(left) < cycleStart)
      return undefined;
    return stayed < SEEN_DWELL_MS ? undefined : entryId;
  }

  /**
   * Keeps a change of the card on screen in one write: the Entry of the card
   * that `left` Seen if it stayed long enough, with its History entry, and
   * the reader's place on the Entry now on screen, if any. Returns the Entry
   * that became Seen, if one did.
   */
  async function keepScreenChange({
    left,
    stayed,
    entryId,
    now,
    date,
  }: {
    left: FeedCard | undefined;
    stayed: number;
    entryId: string | undefined;
    now: number;
    /** Today's key, as the reader's place keeps it. */
    date: string;
  }): Promise<string | undefined> {
    const seenId = seenOnLeaving(left, stayed);
    const wordOfTheDay = left?.kind === 'word' && left.wordOfTheDay !== undefined;
    return keepSeen(
      seenId === undefined ? undefined : { entryId: seenId, seenAt: new Date(now), wordOfTheDay },
      entryId === undefined ? new Map() : feedPosition.change({ entryId, date }),
    );
  }

  /**
   * Writes `changes` in one write with the Entry's Seen mark and History
   * entry, if given and it isn't Seen yet (ADR 0018), and then makes the Seen
   * mark in memory. Returns the Entry that became Seen, if one did.
   */
  async function keepSeen(
    seen: Seen | undefined,
    changes: UserStateChanges,
  ): Promise<string | undefined> {
    const mark = seen === undefined ? undefined : cycle.markSeen(seen.entryId);
    const all = new Map([...(mark?.changes ?? []), ...changes]);
    // An Entry that becomes Seen joins History in the same write.
    const becomesSeen = seen !== undefined && (mark?.changes.size ?? 0) > 0;
    if (becomesSeen) await history.record(seen, all);
    else if (all.size > 0) await userState.write(all);
    mark?.commit();
    return becomesSeen ? seen.entryId : undefined;
  }

  /**
   * Makes a change in turn with the others, then tells `entrySeen` of the
   * Entry it made Seen, if any, out of turn, so following it never holds back
   * the cards.
   */
  async function inTurnTellingSeen(change: () => Promise<string | undefined>): Promise<void> {
    const seenId = await inTurn(change);
    if (seenId !== undefined) await entrySeen(seenId);
  }

  async function show(position: number | undefined): Promise<void> {
    const shown = position === undefined ? undefined : placeOf(position);
    const onScreen = onScreenSince !== undefined;
    if (shown === undefined ? !onScreen : onScreen && shown === place) return keepNextCardReady();
    const now = clock.now().getTime();
    const left = onScreenSince === undefined ? undefined : session[place];
    const stayed = onScreenSince === undefined ? 0 : now - onScreenSince;
    // Leaving the screen, or coming back to the card left, keeps the reader where they were.
    if (shown !== undefined && shown !== place) {
      place = shown;
      droppedFromPlace = undefined;
    }
    onScreenSince = shown === undefined ? undefined : now;
    const entryId = shown === undefined ? undefined : entryIdOf(session[shown]);
    const date = todayKey(clock);
    // In turn with the requests that change the cards, so a new Cycle never
    // starts between the card leaving the screen and its Entry becoming Seen.
    const kept = inTurnTellingSeen(() => keepScreenChange({ left, stayed, entryId, now, date }));
    await Promise.all([kept, keepNextCardReady()]);
  }

  /**
   * The reader's place once the `out` cards are dropped: the card dropped
   * from it when it is back, else the reader's card, else the next card that
   * stays.
   */
  function readerPlace(out: ReadonlySet<FeedCard>): number {
    if (droppedFromPlace !== undefined && !out.has(droppedFromPlace)) {
      const back = session.indexOf(droppedFromPlace);
      if (back !== -1) return back;
    }
    const card = session[place];
    if (card === undefined || !out.has(card)) return place;
    const next = session.findIndex((later, index) => index > place && !out.has(later));
    return next === -1 ? session.length : next;
  }

  /** Whether the Word cards of the session link their Corrections, as of the last pass. */
  let linksShown = await entries.linksCorrections();

  /**
   * Builds the Word cards of the session again once Corrections went out of
   * the Mix or came back: a Word card links no Correction while they are out.
   * Each card keeps its place, and so does the reader.
   */
  async function refreshLinkedCorrections(): Promise<void> {
    const links = await entries.linksCorrections();
    if (links === linksShown) return;
    const rebuilt = new Map<FeedCard, FeedCard>();
    for (const card of session) {
      if (card.kind !== 'word') continue;
      const entry = await entries.get(card.wordCard.wordId);
      if (entry?.kind === 'word')
        rebuilt.set(card, await buildEntryCard(entries, entry, card.wordOfTheDay));
    }
    linksShown = links;
    if (rebuilt.size === 0) return;
    const renewed = (card: FeedCard) => rebuilt.get(card) ?? card;
    if (droppedFromPlace !== undefined) droppedFromPlace = renewed(droppedFromPlace);
    changeSession(session.map(renewed), new Set([...dropped].map(renewed)));
  }

  /**
   * Drops every card whose Entry the Cycle no longer covers and puts back the
   * dropped ones it covers again, then keeps the next card ready. The Word
   * cards follow the Mix too, once the drop is done.
   */
  async function followEligibility(): Promise<void> {
    await inTurnTellingSeen(async () => {
      const seenId = await followCovered();
      await refreshLinkedCorrections();
      return seenId;
    });
    await keepNextCardReady();
  }

  /**
   * Drops and puts back the cards by what the Cycle covers. Returns the Entry
   * of the card that left the screen this way, if it became Seen.
   */
  async function followCovered(): Promise<string | undefined> {
    const out = new Set(
      session.filter((card) => {
        const entryId = entryIdOf(card);
        return entryId !== undefined && !cycle.covers(entryId);
      }),
    );
    const was = place;
    const to = readerPlace(out);
    const left = session[was];
    if (left !== undefined && out.has(left)) droppedFromPlace = left;
    else if (session[to] === droppedFromPlace) droppedFromPlace = undefined;
    const moved = to !== was;
    const sameDropped = out.size === dropped.size && [...out].every((card) => dropped.has(card));
    if (!moved && sameDropped) return undefined;
    const now = clock.now().getTime();
    const since = onScreenSince;
    place = to;
    if (moved && since !== undefined) onScreenSince = now;
    if (moved && to === session.length) {
      // No card after the one dropped from the reader's place stays: the
      // next card takes the place in the same change, so the reader's place
      // is kept on it below and the subscribers never find it past the cards.
      setSession(session, out);
      let added: FeedCard | undefined;
      try {
        added = await addNextCard();
      } finally {
        // A card added has told the subscribers already, with the drop.
        if (added === undefined) subscribers.tell();
      }
    } else changeSession(session, out);
    // With no card on screen, none left it and the card that takes the place
    // isn't on it yet: the reader's coming back writes the place.
    if (!moved || since === undefined) return undefined;
    return keepScreenChange({
      left,
      stayed: now - since,
      // Adding the next card may move the reader's place.
      entryId: entryIdOf(session[place]),
      now,
      date: todayKey(clock),
    });
  }

  async function markOpenedSeen(
    entryId: string,
    changes: UserStateChanges,
  ): Promise<string | undefined> {
    const seen = {
      entryId,
      seenAt: clock.now(),
      wordOfTheDay: wordOfTheDay.chosen()?.wordId === entryId,
    };
    return keepSeen(cycle.covers(entryId) ? seen : undefined, changes);
  }

  if (!(await restore())) await addWordOfTheDay();
  const startPosition = Math.max(cards.length - 1, 0);
  place = placeOf(startPosition);
  const feed: Feed = {
    get cards() {
      return cards;
    },
    startPosition,
    get position() {
      return positionOf(place);
    },
    subscribe: subscribers.subscribe,
    show,
    next,
    openLinkedCorrection: (position, correctionId) =>
      inTurn(() => insertLinkedCorrection(position, correctionId)),
  };
  return {
    feed,
    followEligibility,
    markOpenedSeen: (entryId, changes) => inTurnTellingSeen(() => markOpenedSeen(entryId, changes)),
    async openDay(day) {
      // In turn with the cards, so a card added after it opens the day.
      await inTurn(() => {
        dayToOpen = day !== openedDay;
        return Promise.resolve();
      });
      await keepNextCardReady();
      // A card got ready meanwhile may have checked for a stale ready card before the day turned.
      if (readyCardStale()) await keepNextCardReady();
    },
  };
}
