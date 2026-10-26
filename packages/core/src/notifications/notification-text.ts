import { fill, type EditionStrings, type SynonymRow, type Tip } from '@slovo/contracts';

import { renderStress } from '../entries/stress';

/** The most characters a notification body holds, its ellipsis included. */
export const NOTIFICATION_BODY_LENGTH = 80;

/** How many members of a Synonym Row its notification names. */
const NOTIFIED_MEMBERS = 3;

/**
 * The spaces, dashes and punctuation at the end of a text that only end a
 * clause, by Unicode class so they count in every script: a comma, a full
 * stop, a colon, an Arabic comma, a danda. Marks that say something stay:
 * question and exclamation marks, quotation marks, brackets, apostrophes and
 * signs such as `%`.
 */
const CLAUSE_END = /(?:\s|\p{Pd}|(?![!?¡¿؟‽%'"*/\\&#@])\p{Po})+$/u;

/**
 * The body of a notification: the text, or when it is longer than
 * `NOTIFICATION_BODY_LENGTH`, its start cut at a word boundary, without the
 * punctuation that ends a clause before the cut, and the ellipsis.
 */
export function notificationBody(text: string, ellipsis: string): string {
  const characters = Array.from(text);
  if (characters.length <= NOTIFICATION_BODY_LENGTH) return text;
  const room = NOTIFICATION_BODY_LENGTH - Array.from(ellipsis).length;
  // One character more than fits, so a space right after the cut counts as a boundary.
  const head = characters.slice(0, room + 1).join('');
  const boundary = head.search(/\s\S*$/u);
  const cut = boundary > 0 ? head.slice(0, boundary) : characters.slice(0, room).join('');
  return `${cut.replace(CLAUSE_END, '')}${ellipsis}`;
}

/**
 * What a notification of a Synonym Row or a Tip would read, decided by the
 * Core. The widget shows it; the notification plan carries Words only (ADR 0051).
 */
export interface NotificationText {
  /** The Entry a tap on the notification opens. */
  readonly entryId: string;
  readonly title: string;
  readonly body: string;
}

/**
 * The text of a notification of a Synonym Row or a Tip, in the Edition's
 * words. A row's title is its dominant, with its Stress, and its body its first
 * 3 members, with theirs, and the ellipsis («іти́ → простува́ти, чимчи́кувати,
 * шкандиба́ти…»): a row always has more. A Tip's title is its title, and its
 * body its standard form in the Edition's words («Так: …»), cut as any body.
 */
export function notificationText(
  entry: SynonymRow | Tip,
  strings: EditionStrings['notificationBody'],
): NotificationText {
  if (entry.kind === 'tip') {
    return {
      entryId: entry.id,
      title: entry.title,
      body: notificationBody(
        fill(strings.tipStandardForm, { form: entry.standardForm }),
        strings.ellipsis,
      ),
    };
  }
  const members = entry.members
    .slice(0, NOTIFIED_MEMBERS)
    .map(({ text, stress }) => renderStress({ lemma: text, stress }));
  return {
    entryId: entry.id,
    title: renderStress({ lemma: entry.dominant.text, stress: entry.dominant.stress }),
    body: `${members.join(', ')}${strings.ellipsis}`,
  };
}
