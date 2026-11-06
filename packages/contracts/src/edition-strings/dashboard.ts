import { z } from 'zod';

import { CorrectionTypeSchema } from '../correction';
import { TextSchema } from '../shared';
import { PluralSchema, templateOf } from './shared';

/** The Dashboard, the home behind «Стрічка» (ADR 0076). The hero's «Розкрити» is `wordOfTheDay.reveal`. */
export const DashboardStringsSchema = z.strictObject({
  /** The hero's button that opens the Feed on the Word of the Day card, «До картки →». */
  toCard: TextSchema,
  /** What VoiceOver reads for the Feed header's wordmark, which opens the Dashboard (ADR 0079), «SLOVO, на головну». */
  open: TextSchema,
  /** The hero's kicker, «Слово дня · {day}.{month}». Takes `{day}` and `{month}`, both numbers. */
  kicker: templateOf('day', 'month'),
  /** The line under the closed hero's shout, «Рідкісне. Свіже. Твоє на 24 години.». */
  subtitle: TextSchema,
  /** The line under the open hero's Lemma, «{stress} · {partOfSpeech}». Takes the Lemma with its Stress and the short part of speech. */
  wordLine: templateOf('stress', 'partOfSpeech'),
  /** The label beside the open hero's rarity bars, «Рідкість {rarity}/5». */
  rarity: templateOf('rarity'),
  /** The Mood check-in block under the hero. */
  mood: z.strictObject({
    /** The block's title over the Mood tiles, «Як настрій?». */
    question: TextSchema,
    /** The note at the end of the title, «Mood дня». */
    note: TextSchema,
  }),
  /** The block «Попередні слова» under the Mood check-in: the Word of the Day archive's newest days before today. */
  previousWords: z.strictObject({
    /** The block's title, «Попередні слова». */
    title: TextSchema,
    /** Each month as a row's date column says it under the day, from January, «жов». */
    months: z.array(TextSchema).length(12),
  }),
  /** The Correction Types rail and each type's screen. */
  correctionTypes: z.strictObject({
    /** The rail's title, «Виправлення». */
    title: TextSchema,
    /** A tile's count, «Розібрано {x} з {n}». Takes `{x}`, the Corrections «розібрано», and `{n}`, all of the type. */
    workedThrough: templateOf('x', 'n'),
    /** The button that reveals a Correction's standard form and explanation in place, «Як правильно?». */
    reveal: TextSchema,
    /** Each Correction Type's tile name and screen title, in the plural, «Суржик». */
    tiles: z.record(CorrectionTypeSchema, TextSchema),
    /** The kicker of a type's screen, «ВИПРАВЛЕННЯ · {count}». Takes `{count}`, the `examples` phrase. */
    kicker: templateOf('count'),
    /** How many Corrections a type's screen holds, «{count} приклади». */
    examples: PluralSchema,
    /** Each Correction Type's line under its title on its screen, «Слова, що прослизають у мову непомітно.». */
    descriptions: z.record(CorrectionTypeSchema, TextSchema),
  }),
  /** The title over the Curated Collections rail, «Добірки» (ADR 0081). */
  curatedCollectionsTitle: TextSchema,
  /** A Curated Collection's count of Entries on its tile, «{count} слів». */
  curatedCollectionCount: PluralSchema,
  /** The badge on a Curated Collection card not yet opened, «Нова». */
  curatedCollectionNew: TextSchema,
  /** A Curated Collection's screen and its copy into the reader's Collections. */
  curatedCollection: z.strictObject({
    /** The screen's count, «Знаю {x} з {n}». Takes `{x}`, the Entries marked Known, and `{n}`, those neither Retired nor Hidden. */
    known: templateOf('x', 'n'),
    /** The button that copies it into the reader's Collections, «+ Додати». */
    add: TextSchema,
    /** What the rail and the screen show once a copy is kept, «Додано ✓». */
    added: TextSchema,
    /** The kicker of a collection's screen, «ДОБІРКА · {count}». Takes `{count}`, the `curatedCollectionCount` phrase. */
    kicker: templateOf('count'),
    /** The screen's button beside its plus icon, «ДОДАТИ». */
    addButton: TextSchema,
    /** The screen's button beside its tick once a copy is kept, «ДОДАНО». */
    addedButton: TextSchema,
  }),
  /** The Categories of Words: the Dashboard rail, the grid and the kicker of a Category screen (ADR 0081). */
  categories: z.strictObject({
    /** The rail's and the grid's title, «Категорії»; the count beside it is the bare number. */
    title: TextSchema,
    /** The kicker of a Category screen, «КАТЕГОРІЯ · {count}». Takes `{count}`, the `count` phrase. */
    kicker: templateOf('count'),
    /** How many live Words a Category holds, «{count} слів». */
    count: PluralSchema,
  }),
  /** The Categories of Corrections: the grid and the kicker of a Category screen (ADR 0081). */
  correctionCategories: z.strictObject({
    /** The grid's title, «Виправлення»; the count beside it is the bare number. */
    title: TextSchema,
    /** The kicker of a Category screen, «КАТЕГОРІЯ · {count}». Takes `{count}`, the `count` phrase. */
    kicker: templateOf('count'),
    /** How many live Corrections a Category holds, «{count} виправлень». */
    count: PluralSchema,
  }),
  /** A Category screen of either list (ADR 0081, 0082). */
  category: z.strictObject({
    /** The line over a quiet Category's name, «Категорія». */
    quiet: TextSchema,
    /** The right button while the Category is out of the Mix, «ДОДАТИ». */
    add: TextSchema,
    /** The right button while the Category is in the Mix, «У МІКСІ». */
    inMix: TextSchema,
    /** The hero's progress, «ЗНАЮ {x} З {n}». Takes `{x}`, the Entries marked Known, and `{n}`, the live ones. */
    known: templateOf('x', 'n'),
    /** The stamp on a card marked Known, «ЗНАЮ». */
    knownStamp: TextSchema,
    /** The toasts of the right button. Each takes `{name}`, the Category's display name. */
    toasts: z.strictObject({
      /** «„{name}“ тепер у твоєму Міксі.» */
      added: templateOf('name'),
      /** «„{name}“ прибрано з Міксу.» */
      removed: templateOf('name'),
    }),
  }),
});
