import type { AdminApiOutputs } from '@slovo/contracts/admin-api';

type Counters = AdminApiOutputs['counters'];
type Answer = Counters['answers'][number];
type TopWord = Counters['top']['known'][number];
type EditionCard = AdminApiOutputs['editionCard'];

/** The counted questions in the order the onboarding asks them, each as the reader saw it. */
const QUESTIONS: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'level', label: '«Як добре ти знаєш мову?»' },
  { id: 'why', label: '«Навіщо тобі рідкісні слова?»' },
  { id: 'dailyGoal', label: '«Скільки слів на день?»' },
  { id: 'notificationTime', label: '«Коли нагадати?»' },
  { id: 'who', label: '«Хто ви?» (старі версії застосунку)' },
];

const BUCKETS = { morning: 'Зранку', midday: 'Вдень', evening: 'Увечері' } as const;

const percent = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 100);

const RECORDS = new Intl.PluralRules('uk-UA');
const times = (count: number) =>
  `${String(count)} ${RECORDS.select(count) === 'few' ? 'рази' : 'разів'}`;

/** An answer as the reader picked it, from the Editions' own options; an id they no longer offer as it is. */
function answerLabel(cards: readonly EditionCard[], question: string, answer: string): string {
  for (const card of cards) {
    if (question === 'level' || question === 'why') {
      const option = card.questionnaire[question].find(({ id }) => id === answer);
      if (option !== undefined) return option.label;
    }
    if (
      question === 'notificationTime' &&
      (answer === 'morning' || answer === 'midday' || answer === 'evening')
    ) {
      return `${BUCKETS[answer]}, ${card.onboardingNotificationTimes[answer]}`;
    }
  }
  if (question === 'dailyGoal') {
    return answer === 'none' ? 'Без цілі (крок пропущено)' : `${answer} слів на день`;
  }
  if (question === 'notificationTime') {
    if (answer === 'none') return 'Без нагадувань';
    if (answer === 'other') return 'Інший час';
    if (answer === 'morning' || answer === 'midday' || answer === 'evening') return BUCKETS[answer];
  }
  return answer;
}

/** A row of counts: a label, a bar of its share when it has one, the count and the share. */
function CountRow({
  label,
  count,
  share,
  of = '%',
}: {
  readonly label: string;
  readonly count: number;
  readonly share?: number;
  readonly of?: string;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
      <span className="truncate">{label}</span>
      <span className={share === undefined ? '' : 'h-2.5 rounded-full bg-sunk'}>
        {share !== undefined && (
          <span
            className="block h-2.5 rounded-full bg-primary"
            style={{ width: `${String(share)}%` }}
          />
        )}
      </span>
      <span className="text-right text-xs tabular-nums">
        <span className="font-mono font-semibold">{count}</span>
        {share !== undefined && (
          <span className="text-muted-foreground"> · {`${String(share)} ${of}`}</span>
        )}
      </span>
    </li>
  );
}

/** The panel every counter card shares. */
const PANEL = 'flex flex-col gap-3 rounded-2xl bg-surface px-[18px] py-4 shadow-panel';

/** The Words most counted for a mark, numbered, each with its readers; a line when there is none. */
function TopWords({
  label,
  words,
  none,
}: {
  readonly label: string;
  readonly words: readonly TopWord[];
  readonly none: string;
}) {
  return (
    <figure aria-label={label} className={PANEL}>
      <figcaption className="font-display text-[13px] font-medium">{label}</figcaption>
      {words.length === 0 ? (
        <p className="text-sm text-muted-foreground">{none}</p>
      ) : (
        <ol aria-label={label} className="flex flex-col gap-1.5">
          {words.map(({ entryId, lemma, count }, at) => (
            <li key={entryId} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{`${String(at + 1)}. ${lemma}`}</span>
              <span className="font-mono text-xs font-semibold tabular-nums">{count}</span>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}

/**
 * Community Counters as the Власник reads them: the marks readers set now and
 * the Favorites, with what each means, the Words most counted for each, and
 * every questionnaire answer grouped
 * by its question with its share. All anonymous totals: no reader is named
 * (ADR 0060, 0068).
 */
export function CommunityCounters({
  counters,
  cards,
}: {
  readonly counters: Counters;
  readonly cards: readonly EditionCard[];
}) {
  const marks = counters.known + counters.unknown;
  return (
    <div className="flex flex-col gap-4">
      <div className={PANEL}>
        <h2 className="font-display text-[13px] font-medium">Лічильники спільноти</h2>
        <p className="text-sm text-muted-foreground">
          Анонімні підсумки з телефонів, де не вимкнено «Ділитися анонімною статистикою»: без
          облікових записів і без id читача. Знята позначка віднімається, тож це те, що стоїть
          зараз.
        </p>
        <ul aria-label="Позначки читачів" className="flex flex-col gap-2.5">
          <CountRow
            label="Натиснули «Знаю»"
            count={counters.known}
            share={percent(counters.known, marks)}
            of="% позначок"
          />
          <CountRow
            label="Натиснули «Не знаю»"
            count={counters.unknown}
            share={percent(counters.unknown, marks)}
            of="% позначок"
          />
          <CountRow label="Додали в Улюблене" count={counters.saved} />
        </ul>
        <p className="text-sm text-muted-foreground">
          Усього позначок: {marks}. «Знаю» і «Не знаю» читач ставить на картці; «Не знаю» повертає
          картку на повторення.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <TopWords
          label="Найчастіше «Не знаю»"
          words={counters.top.unknown}
          none="Ще ніхто не натиснув «Не знаю»"
        />
        <TopWords
          label="Найчастіше «Знаю»"
          words={counters.top.known}
          none="Ще ніхто не натиснув «Знаю»"
        />
        <TopWords
          label="Найчастіше в Улюбленому"
          words={counters.top.saved}
          none="Ще ніхто не додав слово в Улюблене"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {questionsOf(counters.answers).map(({ id, label, answers }) => {
          const total = answers.reduce((sum, { count }) => sum + count, 0);
          return (
            <figure key={id} aria-label={label} className={PANEL}>
              <figcaption className="font-display text-[13px] font-medium">{label}</figcaption>
              <ul className="flex flex-col gap-2.5">
                {answers.map(({ answer, count }) => (
                  <CountRow
                    key={answer}
                    label={answerLabel(cards, id, answer)}
                    count={count}
                    share={percent(count, total)}
                  />
                ))}
              </ul>
              <p className="mt-auto text-sm text-muted-foreground">Відповіли {times(total)}</p>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

/** The answers grouped by question, in the onboarding's order, the most picked first; an unknown question last, by its id. */
function questionsOf(answers: readonly Answer[]) {
  const ids = [...new Set(answers.map(({ question }) => question))];
  const known = QUESTIONS.filter(({ id }) => ids.includes(id));
  const unknown = ids
    .filter((id) => !QUESTIONS.some((question) => question.id === id))
    .map((id) => ({ id, label: id }));
  return [...known, ...unknown].map(({ id, label }) => ({
    id,
    label,
    answers: answers
      .filter(({ question }) => question === id)
      .toSorted((one, two) => two.count - one.count),
  }));
}
