import { z } from 'zod';

import { COUNTERS_BATCH_SIZE } from '../community-counters';
import {
  EditionIdSchema,
  QuestionnaireAnswerIdSchema,
  QuestionnaireQuestionSchema,
} from '../edition';
import { EntryIdSchema } from '../entry';
import { hasNoRepeats } from '../shared';
import { procedure } from './procedure';

/** A change of one count: one taken away, none or one added. */
const DeltaSchema = z.literal([-1, 0, 1]);

/**
 * What one Entry's counts change by, as the device counted it (ADR 0060): a
 * mark added or removed, a move Known ↔ Unknown, a Favorite added or
 * removed. An Entry holds at most one mark, so known and unknown never change
 * the same way at once, and an event changes something.
 */
const CounterEventSchema = z
  .strictObject({
    entryId: EntryIdSchema,
    known: DeltaSchema,
    unknown: DeltaSchema,
    saved: DeltaSchema,
  })
  .refine((event) => Math.abs(event.known + event.unknown) <= 1, {
    message: 'An Entry holds at most one mark: known and unknown cannot change the same way',
  })
  .refine((event) => event.known !== 0 || event.unknown !== 0 || event.saved !== 0, {
    message: 'An event changes something',
  });

/** What one Entry's counts change by, as one device counted it. */
export type CounterEvent = z.output<typeof CounterEventSchema>;

/** An Entry's Community Counters, each never below zero. */
const CountersSchema = z.object({
  entryId: EntryIdSchema,
  known: z.int().nonnegative(),
  unknown: z.int().nonnegative(),
  saved: z.int().nonnegative(),
});

/** A procedure of Community Counters, for one Edition. */
const ofCounters = procedure.errors({
  /** An Edition the backend doesn't serve, or one with Community Counters switched off. */
  NOT_FOUND: { message: 'Not found' },
});

/**
 * The Community Counters procedures (ADR 0060). They need no Account, send no
 * Session and carry no device id: no input has a field for either.
 */
export const countersContract = {
  send: ofCounters
    .route({
      method: 'POST',
      path: '/counters/events',
      successStatus: 202,
      summary: 'Count the changes of marks and Favorites a device made',
      description:
        'Each event names an Entry once and changes its known, unknown and saved counts by −1, 0 or +1; a saved +1 also adds to the Entry’s Favorites adds of the current ISO week (UTC). A request names 1 to 100 Entries and is counted whole or not at all. The backend keeps the totals only: no Account, no device id, no IP address (ADR 0060).',
      tags: ['counters'],
    })
    .errors({
      /**
       * Over the limit of 500 events from one IP address in a day, each event
       * of a batch counting; `Retry-After` says, in seconds, when to try again.
       */
      TOO_MANY_REQUESTS: { message: 'Too many requests' },
    })
    .input(
      z.strictObject({
        editionId: EditionIdSchema,
        events: z
          .array(CounterEventSchema)
          .min(1)
          .max(COUNTERS_BATCH_SIZE)
          .refine(
            (events) => hasNoRepeats(events.map((event) => event.entryId)),
            'Expected each Entry at most once',
          ),
      }),
    )
    .output(z.void()),

  read: ofCounters
    .route({
      method: 'GET',
      path: '/counters',
      summary: 'The Community Counters of several Entries',
      description:
        'Known, unknown and saved for each Entry named in `entries`, comma-separated, 1 to 100 of them, each once; an Entry nobody counted answers zeros. The answer names the Entries in the order asked.',
      tags: ['counters'],
    })
    .input(
      z.strictObject({
        edition: EditionIdSchema,
        /** The Entry ids, comma-separated. */
        entries: z
          .string()
          .transform((entries) => entries.split(','))
          .pipe(
            z
              .array(EntryIdSchema)
              .max(COUNTERS_BATCH_SIZE)
              .refine(hasNoRepeats, 'Expected each Entry at most once'),
          ),
      }),
    )
    .output(z.object({ counters: z.array(CountersSchema) })),

  communityWord: ofCounters
    .route({
      method: 'GET',
      path: '/community/week',
      summary: 'The Community Word of the last ISO week',
      description:
        'The Entry most added to Favorites in the last full ISO week (UTC), with its adds, the lower Entry id winning a tie; none when nobody added anything (ADR 0060).',
      tags: ['counters'],
    })
    .input(z.strictObject({ edition: EditionIdSchema }))
    .output(
      z.object({
        communityWord: z.object({ entryId: EntryIdSchema, adds: z.int().positive() }).nullable(),
      }),
    ),

  questionnaire: procedure
    .route({
      method: 'POST',
      path: '/counters/questionnaire',
      successStatus: 202,
      summary: 'Count one answer of the onboarding questionnaire',
      description:
        'Adds one to the count of the answer, an option of «Хто ви» (`who`) or «Навіщо» (`why`) of the Edition. The backend keeps the totals per answer only: no Account, no device id, no IP address (ADR 0068).',
      tags: ['counters'],
    })
    .errors({
      /** An Edition the backend doesn't serve, one with the questionnaire switched off, or an answer that is not an option of the question. */
      NOT_FOUND: { message: 'Not found' },
      /**
       * Over the limit of 100 answers from one IP address in a day;
       * `Retry-After` says, in seconds, when to try again.
       */
      TOO_MANY_REQUESTS: { message: 'Too many requests' },
    })
    .input(
      z.strictObject({
        editionId: EditionIdSchema,
        question: QuestionnaireQuestionSchema,
        answer: QuestionnaireAnswerIdSchema,
      }),
    )
    .output(z.void()),
};
