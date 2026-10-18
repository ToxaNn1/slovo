import { z } from 'zod';

import { TextSchema } from '../shared';
import { PluralSchema, templateOf } from './shared';

/**
 * What the Account is called on every screen of every Edition. The name is the
 * same in each Edition, so the strings never hold it: a text that names the
 * Account takes it as `{name}`.
 */
export const ACCOUNT_NAME = 'SLOVO ID';

/**
 * The line under the field for each problem the Account can meet. The keys are
 * the problems the Core gives, so a problem without a line, or a line for a
 * problem the Core never gives, is refused.
 */
const AccountProblemsSchema = z.strictObject({
  /** The request found no network. */
  offline: TextSchema,
  /** The email is not an email; nothing was sent. */
  'invalid-email': TextSchema,
  /** The code is wrong. Takes `{count}`, the tries left, which picks the form. */
  'wrong-code': PluralSchema,
  /** The code ran out of time or was replaced by a newer one. */
  'code-expired': TextSchema,
  /** Too many requests, for this email or from this network. */
  'too-many-requests': TextSchema,
  /** The backend answered what the request never expects, such as an Edition it doesn't serve. */
  unexpected: TextSchema,
});

/**
 * The status line under the email of the SLOVO ID screen: when the words were
 * last synced, that a sync is running, or that it waits for the network.
 */
const SyncStatusStringsSchema = z.strictObject({
  /** While a sync runs. */
  syncing: TextSchema,
  /** When the last attempt found no network. */
  waitingForNetwork: TextSchema,
  /** The last sync was today. Takes `{time}`, e.g. «14:05». */
  syncedToday: templateOf('time'),
  /** The last sync was another day of this year. Takes `{day}` and `{month}`. */
  syncedOn: templateOf('day', 'month'),
  /** The last sync was in another year. Takes `{day}`, `{month}` and `{year}`. */
  syncedOnInYear: templateOf('day', 'month', 'year'),
  /** The short month names, January first. */
  months: z.array(TextSchema).length(12),
});

/**
 * The texts of the SLOVO ID screen, reached from a row in Settings. The row
 * and the screen carry the Account's name, `ACCOUNT_NAME`, so the strings hold
 * only the words around it.
 */
export const AccountStringsSchema = z.strictObject({
  /** The Settings row's value while the reader is signed out. */
  signedOut: TextSchema,
  /** The label of the email field. */
  emailLabel: TextSchema,
  /** The button that sends the Sign-in code. */
  sendCode: TextSchema,
  /** The label of the code field. */
  codeLabel: TextSchema,
  /** The button that sends a new code, once it may. */
  resend: TextSchema,
  /** The same button while the countdown runs. Takes `{count}`, the seconds left, which picks the form. */
  resendIn: PluralSchema,
  /** The button that goes back to the email field. */
  changeEmail: TextSchema,
  /** The label over the email once the reader is signed in. */
  signedInAs: TextSchema,
  signOut: TextSchema,
  signOutEverywhere: TextSchema,
  /** The status line of Sync, shown while signed in. */
  sync: SyncStatusStringsSchema,
  /** Deleting the Account: its button and the system alert behind it. */
  delete: z.strictObject({
    /** The destructive button. Takes `{name}`. */
    button: templateOf('name'),
    /** The alert's title. Takes `{name}`. */
    title: templateOf('name'),
    message: TextSchema,
    /** The alert's destructive button. */
    confirm: TextSchema,
    /** The alert's button that keeps the Account. */
    cancel: TextSchema,
  }),
  problems: AccountProblemsSchema,
});

/**
 * The sign-in email, which the backend sends in the language of the Edition
 * that asked for the code. Both texts take `{code}`, the six digits, and may
 * take `{name}`.
 */
export const EmailStringsSchema = z.strictObject({
  /** One line: the backend puts it in the mail's Subject header. */
  subject: templateOf('code').refine((text) => !/[\r\n]/.test(text), 'Expected one line'),
  /** The plain-text body. */
  body: templateOf('code'),
});
