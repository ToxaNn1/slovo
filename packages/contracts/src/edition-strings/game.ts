import { z } from 'zod';

import { TextSchema } from '../shared';
import { PluralLabelSchema, PluralSchema, pluralOf, templateOf } from './shared';

/**
 * The texts of one Game Mode, alike for every mode: its row on the mode
 * screen, the label of its Rounds and what its card says for each reason it
 * can't start.
 */
const GameModeStringsSchema = z.strictObject({
  /** The few characters on the mode's tile on the mode screen, e.g. «АЯ». */
  glyph: TextSchema,
  title: TextSchema,
  description: TextSchema,
  /** The mode's one line under its name in a Games hub row, with no full stop, e.g. «Обери слово за визначенням» (spec #1674). */
  oneLiner: TextSchema,
  /** The label over a Round's prompt, e.g. «ВИЗНАЧЕННЯ». */
  roundLabel: TextSchema,
  /** What the card says for each reason the Core gives that the mode can't start. */
  refusals: z.strictObject({
    /** Too few eligible Entries of the mode's kind to play it; any mode may meet it. */
    'too-few-entries': TextSchema,
    /** Corrections out of the reader's Mix; only a mode that asks about Corrections meets it. */
    'corrections-out-of-mix': TextSchema.optional(),
    /** Idioms out of the reader's Mix; only a mode that asks about Idioms meets it (0.8.8). */
    'idioms-out-of-mix': TextSchema.optional(),
    /** Synonym Rows out of the reader's Mix; only a mode that asks about Synonym Rows alone meets it. */
    'synonymRows-out-of-mix': TextSchema.optional(),
    /** Tips out of the reader's Mix; only a mode that asks about Tips alone meets it. */
    'tips-out-of-mix': TextSchema.optional(),
  }),
});

/** The texts of the Game: the mode screen, a Round, its answer sheet and the result screen. */
export const GameStringsSchema = z.strictObject({
  /** The mode screen's title. */
  title: TextSchema,
  /** The XP earned in all, beside the mode screen's title, e.g. «45 XP». Takes `{count}`. */
  xp: templateOf('count'),
  /** The titles of the mode screen's groups of mode cards, e.g. «Слова». */
  groups: z.strictObject({
    /** The modes that ask about Words, e.g. «Слова». */
    words: TextSchema,
    /** The modes that ask about Corrections, e.g. «Виправлення». */
    corrections: TextSchema,
    /** The modes that ask about Idioms, e.g. «Вислови». */
    idioms: TextSchema,
    /** The modes with their own Lives, Round limit or time limit, e.g. «Виклик». */
    challenge: TextSchema,
  }),
  /** The Best result of a Game Mode on its card. */
  modeBest: z.strictObject({
    /** In a mode with a Round limit, e.g. «Найкраще: 12 з 15». Takes `{n}`, the Best result, and `{total}`, the Rounds of a Game. */
    outOf: templateOf('n', 'total'),
    /** In a mode without a Round limit, e.g. «Найкраще: 23». Takes `{n}`, the Best result. */
    count: templateOf('n'),
  }),
  /** A Games hub row's Best result (spec #1674). */
  hubRow: z.strictObject({
    /** The Best result, e.g. «★ 12». Takes `{n}`. */
    best: templateOf('n'),
    /** A mode not played yet, e.g. «—». */
    none: TextSchema,
  }),
  /** The button that opens one letter of the answer, in a mode that has it and in the Daily Crossword. */
  openLetter: TextSchema,
  /** What VoiceOver reads for a letter in its place in a Word: a vowel button, a blank, a crossword cell. */
  letters: z.strictObject({
    /** A letter, e.g. «а, третя літера». Takes `{letter}` and `{place}`, one of the `ordinals`. */
    label: templateOf('letter', 'place'),
    /** A place with no letter yet, e.g. «третя літера, порожня». Takes `{place}`, one of the `ordinals`. */
    empty: templateOf('place'),
    /** Each place in a Word from the first, as the labels read it, e.g. «перша», «друга». */
    ordinals: z.array(TextSchema).min(1),
  }),
  /** The Daily Crossword's card on the mode screen and its screen; it is not a Game. */
  dailyCrossword: z.strictObject({
    /** Its name, e.g. «Кросворд дня». */
    title: TextSchema,
    /** The day under its name on the card, e.g. «26 жовтня». Takes `{day}`, the day of the month, and `{month}`, one of `dates.months`. */
    dated: templateOf('day', 'month'),
    /** The card's button before any letter is in, e.g. «Почати». */
    start: TextSchema,
    /** The card's button once some letters are in, e.g. «Продовжити». */
    resume: TextSchema,
    /** The card's mark once today's is solved, e.g. «✓ Розв’язано». */
    solvedMark: TextSchema,
    /** The screen's line once it is solved, e.g. «Розв’язано!». */
    solved: TextSchema,
    /** What VoiceOver reads for the delete key of its keyboard, e.g. «Стерти». */
    eraseKey: TextSchema,
    /**
     * What VoiceOver reads for a cell of its grid, e.g. «к, перша літера. Звір. Рядок 1, стовпець 1».
     * Takes `{cell}`, the letter in its place as `letters` reads it, `{clue}`, the clue of the word
     * that place is in, and `{row}` and `{column}`, counted from 1 at the top left corner.
     */
    cellLabel: templateOf('cell', 'clue', 'row', 'column'),
    /** The traced Daily Crossword's line over its grid, which says how to play, e.g. «Веди пальцем по сусідніх літерах…». */
    traceHint: TextSchema,
    /** The traced Daily Crossword's button that checks the cells tapped with VoiceOver on, e.g. «Перевірити». */
    check: TextSchema,
    /**
     * What VoiceOver reads for a cell of the traced Daily Crossword, e.g. «к. Рядок 1, стовпець 1».
     * Takes `{letter}`, with its Stress mark, and `{row}` and `{column}`, counted from 1 at the top left corner.
     */
    tracedCellLabel: templateOf('letter', 'row', 'column'),
    /** What VoiceOver reads for a clue of the traced Daily Crossword before its Word is found. Takes `{clue}`. */
    clueHidden: templateOf('clue'),
    /** What VoiceOver reads for a clue of the traced Daily Crossword once its Word is found. Takes `{clue}` and `{word}`. */
    clueFound: templateOf('clue', 'word'),
    /** The crossing Daily Crossword's grid size on its card, e.g. «5×5». Takes `{size}` (ADR 0087). */
    size: templateOf('size'),
    /** The count of its Words on its card, e.g. «6 слів» (ADR 0087). */
    words: PluralSchema,
    /** The Solve time on the solved card, e.g. «за 3:42». Takes `{time}` (ADR 0087). */
    solvedIn: templateOf('time'),
    /** The mark of a day solved without the Crossword Hint, on the card and the share line, e.g. «без підказок». */
    noHints: TextSchema,
    /** The Crossword Hint's button, e.g. «Підказка». */
    hint: TextSchema,
    /** What VoiceOver reads for the button that moves to the next open Word, e.g. «Наступне слово». */
    nextWord: TextSchema,
    /** The line over the Letter Wheel before the first Word is entered, e.g. «Веди пальцем по літерах, щоб скласти слово». */
    wheelHint: TextSchema,
    /** The same line once a Word is entered, e.g. «Веди пальцем по літерах». */
    wheelHintShort: TextSchema,
    /** The line once every cell is filled and some letter is wrong, e.g. «Десь закралася помилка. Шукай уважніше!». */
    miss: TextSchema,
    /** The solved screen (ADR 0087). */
    solvedScreen: z.strictObject({
      title: TextSchema,
      /** The button that shares the grid with no letters, e.g. «Поділитися без спойлера». */
      shareNoSpoiler: TextSchema,
      share: TextSchema,
      /** The button that goes to the Games hub, e.g. «До ігор». */
      toGames: TextSchema,
    }),
    /** The share line of a solved day (ADR 0087). */
    share: z.strictObject({
      /** Its head, e.g. «SLOVO · Кросворд №12». Takes `{n}`, the day's number. */
      title: templateOf('n'),
      /** The toast once it is copied, e.g. «Скопійовано. Жодної літери — тільки клини.». */
      copied: TextSchema,
    }),
  }),
  /**
   * The texts of each Game Mode on offer, by its id: the Core's own and any
   * an Edition registers (ADR 0024).
   */
  modes: z.record(z.string(), GameModeStringsSchema),
  /** A Round. */
  round: z.strictObject({
    /** The Round header of every mode, e.g. «ВГАДАЙ СЛОВО · 3/15»; the Lives follow as `lives`. Takes `{mode}`, `{n}` and `{total}` (spec #1674). */
    header: templateOf('mode', 'n', 'total'),
    /** The inline answer card (spec #1674). */
    answerCard: z.strictObject({
      /** Over a right answer, e.g. «Влучно!». */
      right: TextSchema,
      /** Over a wrong answer, e.g. «Майже. Наступне вийде.». */
      wrong: TextSchema,
      /** Its button to the next Round, e.g. «Далі →». */
      next: TextSchema,
    }),
    /** The streak counter of «Виживання», e.g. «4 поспіль · рекорд 9». Takes `{n}` and `{best}` (spec #1674). */
    survivalStreak: templateOf('n', 'best'),
    /** The prompts of the restyled Rounds (spec #1674). */
    prompts: z.strictObject({
      /** E.g. ««вереск» — це…». Takes `{word}`. */
      meaning: templateOf('word'),
      /** Under a Correction's right form, e.g. «замість «їхати»». Takes `{wrong}`. */
      instead: templateOf('wrong'),
      /** An Anglicism Round. Takes `{word}` and `{sentence}`. */
      replace: templateOf('word', 'sentence'),
    }),
    /** The line of a «Наголос» Round, e.g. «Торкнись голосної, на яку падає наголос». */
    stressHint: TextSchema,
    /** The line of a «Пари» Round, e.g. «З’єднай слово і значення». */
    pairsHint: TextSchema,
    /** The key that takes back the last letter tile, e.g. «← Стерти літеру». */
    eraseLetter: TextSchema,
    /** The Rounds passed over the bar, e.g. «7 / 15». Takes `{passed}` and `{total}`. */
    progress: templateOf('passed', 'total'),
    /** What VoiceOver reads for it, e.g. «Пройдено раундів: 7 з 15». Takes `{passed}` and `{total}`. */
    progressLabel: templateOf('passed', 'total'),
    /** The Rounds passed in a mode with no Round limit, e.g. «Пройдено: 23». Takes `{passed}`. */
    passed: templateOf('passed'),
    /** What VoiceOver reads for it, e.g. «Пройдено раундів: 23». Takes `{passed}`. */
    passedLabel: templateOf('passed'),
    /** What VoiceOver reads for the Lives, e.g. «Життів: 4 з 5». Takes `{count}` and `{total}`. */
    lives: templateOf('count', 'total'),
    /**
     * What VoiceOver reads after the prompt for the part of it that is marked,
     * such as a non-standard form, e.g. «Виділено: на протязі». Takes `{text}`.
     */
    highlight: templateOf('text'),
    /** The tag of the right option once the Round is answered. */
    correct: TextSchema,
    /** The tag of the reader's wrong choice. */
    chosen: TextSchema,
    /**
     * The keys of a pick Round's options, one letter per option in order,
     * each letter once, e.g. «АБВГ» (spec #1674).
     */
    optionKeys: TextSchema.refine(
      (keys) => new Set(keys).size === Array.from(keys).length,
      'Expected each key once',
    ),
    /**
     * A Synonym Row's Round, in any Game Mode that asks about rows: the label
     * over its question, e.g. «СИНОНІМИ», and the question, e.g. «Що є
     * синонімом до „іти“?». Takes `{dominant}`, the row's dominant with its Stress.
     */
    synonymRow: z.strictObject({ label: TextSchema, prompt: templateOf('dominant') }),
    /** A Tip's Round, which asks the Tip's own question: the label over it, e.g. «ПОРАДА». */
    tip: z.strictObject({ label: TextSchema }),
    /**
     * A Round that asks a Word by its Example with a gap: the label over it,
     * e.g. «ЯКЕ СЛОВО ПРОПУЩЕНО?», and what VoiceOver reads for the gap, e.g. «пропуск».
     */
    gap: z.strictObject({ label: TextSchema, voiceOver: TextSchema }),
    /**
     * A Round the reader answers by typing: the field's placeholder, which
     * VoiceOver reads as its name, e.g. «Твоя відповідь», and its submit button, e.g. «Перевірити».
     */
    typed: z.strictObject({ label: TextSchema, submit: TextSchema }),
    /** What VoiceOver reads of the timer of a mode with a time limit, e.g. «лишилось 40 секунд». Takes `{count}`, the seconds left. */
    timer: PluralSchema,
    /** The seconds left as the timer shows them, e.g. «40 с». Takes `{seconds}`. */
    timerShown: TextSchema,
  }),
  /** The ✕ that leaves a Game and its confirmation, a system alert. */
  exit: z.strictObject({
    /** The ✕ as VoiceOver reads it, e.g. «Вийти з гри». */
    label: TextSchema,
    title: TextSchema,
    message: TextSchema,
    /** The destructive button that drops the Game. */
    confirm: TextSchema,
    /** The button that goes back to the same Round. */
    cancel: TextSchema,
  }),
  /** The sheet after an answer, which only its button closes. */
  sheet: z.strictObject({
    /** Its title after a right answer, e.g. «Правильно!». */
    correct: TextSchema,
    /** Its title after a wrong one, e.g. «Не цього разу». */
    wrong: TextSchema,
    /** The button that goes on, e.g. «Далі». */
    next: TextSchema,
  }),
  /** The Game Review under the result: a row per Round played. */
  review: z.strictObject({
    /** The heading over the rows, e.g. «Твої раунди». */
    title: TextSchema,
    /** What VoiceOver reads for ✓, e.g. «правильно». */
    right: TextSchema,
    /** What VoiceOver reads for ✗, e.g. «помилка». */
    wrong: TextSchema,
    /** The reader's wrong pick under the row, e.g. «Ваш вибір: шпаркий». Takes `{text}`. */
    picked: templateOf('text'),
    /** The text the reader typed instead of the right one, e.g. «Твоя відповідь: шпаркий». Takes `{text}`. */
    typed: templateOf('text'),
    /**
     * A row whose right answer names something other than its Entry, the row's
     * title then that answer, e.g. «бурса — латинська» in «Звідки слово». Takes
     * `{title}` and `{answer}`.
     */
    withAnswer: templateOf('title', 'answer'),
    /** What VoiceOver says a tap on a row does: expand it. */
    expandHint: TextSchema,
    /** What VoiceOver says a tap on an expanded row does: open the Entry. */
    openHint: TextSchema,
  }),
  /** The «Фініш» poster of a finished Game and a time-up (spec #1674). */
  finish: z.strictObject({
    title: TextSchema,
    /** Over a Game with every Round right, e.g. «Влучно!». */
    won: TextSchema,
    /** Over any other finished Game, e.g. «Ще раунд!». */
    more: TextSchema,
    /** Over a time-up, e.g. «Час!». */
    timeUp: TextSchema,
    /** The right answers, e.g. «12 з 15 влучань». Takes `{count}`, the right answers, and `{total}`. */
    hits: pluralOf('total'),
    /** Over a new Best result, e.g. «Новий рекорд!». */
    newBest: TextSchema,
    /** The label over the XP earned, e.g. «Досвід». */
    xp: TextSchema,
    /** The XP earned, e.g. «35 XP». Takes `{count}`. */
    xpCount: templateOf('count'),
    /** The label over the Best result, e.g. «Рекорд». */
    best: TextSchema,
  }),
  /** The head of the Lives-over screen, e.g. «ВГАДАЙ СЛОВО · 7/15». Takes `{mode}`, `{score}` and `{total}` (spec #1674). */
  livesOver: templateOf('mode', 'score', 'total'),
  /** The texts both final screens share (spec #1674). */
  finals: z.strictObject({
    /** The title over the Game Review rows, e.g. «Твої раунди». */
    rounds: TextSchema,
    /** A wrong Round's chosen answer, e.g. «Твій вибір: вереск». Takes `{text}`. */
    chosen: templateOf('text'),
    /** The button that starts a new Game in the same mode, e.g. «Ще раз!». */
    again: TextSchema,
    /** The button that goes to the Games hub, e.g. «До ігор». */
    toGames: TextSchema,
  }),
  /** The result screen. */
  result: z.strictObject({
    won: z.strictObject({
      title: TextSchema,
      /** The line under the title, e.g. «Усі 15 раундів пройдено.». Takes `{count}`, the Rounds of a Game. */
      line: PluralSchema,
    }),
    lost: z.strictObject({ title: TextSchema, line: TextSchema }),
    /** The end of a Game in a mode with a time limit, once its time is up, e.g. «Час вийшов!». */
    timeUp: z.strictObject({ title: TextSchema, line: TextSchema }),
    /** The word under the right answers of a Game in a mode with a time limit, e.g. «правильних відповідей». */
    right: PluralLabelSchema,
    /** The word under the Rounds passed, «11 / 15», agreeing with the Rounds of a Game, e.g. «раундів». */
    rounds: PluralLabelSchema,
    /** The word under the Lives left, e.g. «життів». */
    lives: PluralLabelSchema,
    /** The word under the best result, the Game just over included, e.g. «рекорд». */
    best: PluralLabelSchema,
    /** The button that starts a new Game in the same mode. */
    again: TextSchema,
    /** The button that goes to the Feed. */
    home: TextSchema,
  }),
});
