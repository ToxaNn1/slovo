import { FeatureSwitchesSchema, type FeatureSwitches } from './edition';

/**
 * The catalogue of the Feature Switches (ADR 0196): one record per switch,
 * the only place that says what a switch is. The Edition's schema takes its
 * keys from here, `DEPENDS_ON` its dependencies, the admin its name, line and
 * group. The JSDoc above a record is the switch's meaning.
 */

/** The parts of the app the admin groups the Feature Switches by. */
export type FeatureSwitchGroup =
  | 'content'
  | 'feed'
  | 'games'
  | 'crossword'
  | 'progress'
  | 'notifications'
  | 'widgets'
  | 'account'
  | 'onboarding'
  | 'look'
  | 'analytics';

/** What the catalogue holds of one Feature Switch, given the names of all of them. */
export interface FeatureSwitchRecord<Switch extends string = string> {
  /** The owner's name of the switch in the admin, in Ukrainian. */
  readonly name: string;
  /** One plain line in the admin on what the switch turns on in the app, in Ukrainian. */
  readonly line: string;
  /** The part of the app the admin shows the switch under. */
  readonly group: FeatureSwitchGroup;
  /**
   * The switches this feature stands on: it is in effect only while each of
   * them is in effect too (ADR 0040). None: it depends on nothing.
   */
  readonly dependsOn?: readonly Switch[];
}

/** The catalogue as written, checked: every record complete and every dependency a switch of it. */
function catalogue<
  const Catalogue extends { [S in keyof Catalogue]: FeatureSwitchRecord<keyof Catalogue & string> },
>(
  records: Catalogue,
): { readonly [S in keyof Catalogue]: FeatureSwitchRecord<keyof Catalogue & string> } {
  return records;
}

/** Every Feature Switch, in the order the Edition declares them. */
export const FEATURE_SWITCHES = catalogue({
  game: {
    name: 'Ігри',
    line: 'Вкладка з іграми на запам’ятовування слів.',
    group: 'games',
  },
  corrections: {
    name: 'Виправлення',
    line: 'Картки з типовими помилками і тим, як казати правильно.',
    group: 'content',
  },
  /** Idioms: the third kind of Entry, idioms and place names (ADR 0046). */
  idioms: {
    name: 'Фразеологізми',
    line: 'Картки з приказками, фразеологізмами й назвами місць.',
    group: 'content',
  },
  /** Synonym Rows: the fourth kind of Entry, a dominant word and a row of its synonyms (ADR 0051). */
  synonymRows: {
    name: 'Ряди синонімів',
    line: 'Картки з головним словом і рядом його синонімів.',
    group: 'content',
  },
  /** Tips: the fifth kind of Entry, rules of good speech (ADR 0051). */
  tips: {
    name: 'Поради',
    line: 'Картки з правилами гарної мови.',
    group: 'content',
  },
  /** The Account, under the Edition's `accountName`: its Settings row, its screen and the backend's answers to it. */
  account: {
    name: 'Обліковий запис',
    line: 'Рядок у налаштуваннях і екран для входу в обліковий запис.',
    group: 'account',
  },
  /** Sign in with Google: the second Sign-in method, its button and the backend's procedure for it (ADR 0047). */
  googleSignIn: {
    name: 'Вхід через Google',
    line: 'Кнопка входу в обліковий запис через Google.',
    group: 'account',
  },
  /** Sign in with Apple: the third Sign-in method, its button on iOS and the backend's procedure for it. */
  signInWithApple: {
    name: 'Вхід через Apple',
    line: 'Кнопка входу в обліковий запис через Apple на iOS.',
    group: 'account',
  },
  /** Sync: the background exchange of the reader's words with their Account. Apart from `account`, so Sync can stop while sign-in keeps working. */
  sync: {
    name: 'Синхронізація',
    line: 'Слова читача самі зберігаються в його обліковому записі.',
    group: 'account',
    dependsOn: ['account'],
  },
  /** Content updates: the app's daily check for a newer Language Pack. */
  contentUpdates: {
    name: 'Оновлення слів',
    line: 'Застосунок щодня шукає нову версію словника.',
    group: 'content',
  },
  /** Notifications: the daily reminders the Core plans (ADR 0021). */
  notifications: {
    name: 'Нагадування',
    line: 'Щоденні сповіщення, які нагадують зайти в застосунок.',
    group: 'notifications',
  },
  /** The home-screen widget: the Widget Snapshot and the widget it feeds. */
  widget: {
    name: 'Віджет',
    line: 'Віджет на головному екрані телефона.',
    group: 'widgets',
  },
  /** The widget goal ring: today's Daily Goal progress and the Streak on the medium widget, in the Widget Snapshot. */
  widgetGoalRing: {
    name: 'Кільце цілі у віджеті',
    line: 'Середній віджет показує прогрес денної цілі та серію.',
    group: 'widgets',
  },
  /** The lock-screen widget: its families in the widget extension and its content in the Widget Snapshot. */
  lockScreenWidget: {
    name: 'Віджет екрана блокування',
    line: 'Віджет, який видно на заблокованому екрані.',
    group: 'widgets',
  },
  /** Share Cards: the buttons that make and share an image of an Entry. */
  shareCards: {
    name: 'Картки для поширення',
    line: 'Кнопки, що роблять із запису картинку, якою можна поділитися.',
    group: 'content',
  },
  /** Pronunciation: the buttons that play a Word's audio. */
  pronunciation: {
    name: 'Вимова',
    line: 'Кнопки, що озвучують слово.',
    group: 'content',
  },
  /** «Голос диктора»: the reader's choice of the Narrator Voice that reads; off while `pronunciation` is, and off the default voice reads (ADR 0083). */
  narratorVoice: {
    name: 'Голос диктора',
    line: 'Читач сам обирає голос, яким озвучуються слова.',
    group: 'content',
    dependsOn: ['pronunciation'],
  },
  /** Recordings only: the device voice never reads a Word, and a Word without a Recording in the chosen Narrator Voice shows a disabled sound button (ADR 0195). */
  recordedOnly: {
    name: 'Лише записи',
    line: 'Слово озвучує тільки записаний голос; без запису кнопка вимкнена й пояснює чому.',
    group: 'content',
    dependsOn: ['pronunciation'],
  },
  /** The Word of the Day: its pick, its notification and its widget. */
  wordOfTheDay: {
    name: 'Слово дня',
    line: 'Щоденний вибір слова зі сповіщенням і віджетом.',
    group: 'content',
  },
  /** The statistics screens and the Streak. */
  statistics: {
    name: 'Статистика',
    line: 'Екрани зі статистикою навчання і серія днів поспіль.',
    group: 'progress',
  },
  /** Knowledge Marks: the Known / Unknown marks on Words, Corrections and Idioms, and the Review they feed. */
  knowledge: {
    name: 'Позначки «знаю»',
    line: 'Позначки «Знаю» і «Не знаю» на записах та повторення за ними.',
    group: 'feed',
  },
  /** The confirmed-Entry counts the Profile and the Badges show; with it off they are hidden and nothing is confirmed, while Review goes on under `knowledge` (ADR 0043). */
  confirmedEntries: {
    name: 'Підтверджені записи',
    line: 'Лічильники підтверджених записів у профілі та на відзнаках.',
    group: 'progress',
  },
  /** Self-check: the setting that hides a card's meaning until the reader reveals it. */
  selfCheck: {
    name: 'Самоперевірка',
    line: 'Налаштування, що ховає значення картки, доки читач його не відкриє.',
    group: 'feed',
  },
  /** «Рідкість», the Rarity Range every surface obeys (ADR 0156): «Рідкість» in Settings is five slanted bars, «від 2 до 4» or «лише 3», tapped or dragged, and every surface keeps the Words outside it out. Off, every Word up to rarity 5 is in, as before 1.0. */
  rarityCeiling: {
    name: 'Межа рідкісності',
    line: 'Налаштування «Рідкість», яке обмежує, наскільки рідкісні слова показують.',
    group: 'content',
  },
  /** Game Review: the list of every Round on the Game's result. */
  gameReview: {
    name: 'Розбір гри',
    line: 'Після гри список усіх запитань із відповідями.',
    group: 'games',
  },
  /** The Game Mode «Вгадай слово» (`guess-word`); off while `game` is (ADR 0052). */
  gameGuessWord: {
    name: 'Гра «Вгадай слово»',
    line: 'Режим, де за значенням треба вгадати слово.',
    group: 'games',
    dependsOn: ['game'],
  },
  /** The Game Mode «Обери правильне» (`correction`); off while `game` is (ADR 0052). */
  gameCorrection: {
    name: 'Гра «Обери правильне»',
    line: 'Режим, де з двох варіантів треба обрати правильний.',
    group: 'games',
    dependsOn: ['game', 'corrections'],
  },
  /** The Game Mode «Наголос» (`stress`); off while `game` is (ADR 0052). */
  gameStress: {
    name: 'Гра «Наголос»',
    line: 'Режим, де треба поставити наголос у слові.',
    group: 'games',
    dependsOn: ['game'],
  },
  /** The Game Mode «Пари» (`pairs`); off while `game` is (ADR 0052). */
  gamePairs: {
    name: 'Гра «Пари»',
    line: 'Режим, де слова треба поєднати з їхніми значеннями.',
    group: 'games',
    dependsOn: ['game'],
  },
  /** The Game Mode «Виживання» (`survival`); off while `game` is (ADR 0052). */
  gameSurvival: {
    name: 'Гра «Виживання»',
    line: 'Режим, де гра триває до першої помилки.',
    group: 'games',
    dependsOn: ['game', 'corrections'],
  },
  /** The Game Mode «На час» (`timed`); off while `game` is (ADR 0052). */
  gameTimed: {
    name: 'Гра «На час»',
    line: 'Режим, де треба встигнути відповісти якнайбільше за обмежений час.',
    group: 'games',
    dependsOn: ['game'],
  },
  /** The Game Mode «Фразеологізми» (`idiom-meaning`); off while `game` is (ADR 0052). */
  gameIdiomMeaning: {
    name: 'Гра «Фразеологізми»',
    line: 'Режим, де треба обрати значення фразеологізму.',
    group: 'games',
    dependsOn: ['game', 'idioms'],
  },
  /** The Game Mode «Англіцизми» (`anglicism`); off while `game` is (ADR 0052). */
  gameAnglicism: {
    name: 'Гра «Англіцизми»',
    line: 'Режим, де до англіцизму треба обрати українську заміну.',
    group: 'games',
    dependsOn: ['game', 'corrections'],
  },
  /** The Game Mode «Склади вислів» (`build-idiom`); off while `game` is (ADR 0052). */
  gameBuildIdiom: {
    name: 'Гра «Склади вислів»',
    line: 'Режим, де з частин треба скласти цілий вислів.',
    group: 'games',
    dependsOn: ['game', 'idioms'],
  },
  /** The Game Mode «Впиши слово» (`type-word`); off while `game` is (ADR 0052). */
  gameTypeWord: {
    name: 'Гра «Впиши слово»',
    line: 'Режим, де слово треба вписати самому.',
    group: 'games',
    dependsOn: ['game', 'corrections'],
  },
  /** The Game Mode «Анаграми» (`anagram`); off while `game` is (ADR 0052). */
  gameAnagram: {
    name: 'Гра «Анаграми»',
    line: 'Режим, де зі змішаних літер треба скласти слово.',
    group: 'games',
    dependsOn: ['game'],
  },
  /** The Game Mode «За літерами» (`by-letters`); off while `game` is (ADR 0052). */
  gameByLetters: {
    name: 'Гра «За літерами»',
    line: 'Режим, де слово складають із наданих літер.',
    group: 'games',
    dependsOn: ['game'],
  },
  /** The Game Mode «Звідки слово» (`origin`); off while `game` is (ADR 0052). */
  gameOrigin: {
    name: 'Гра «Звідки слово»',
    line: 'Режим, де треба вгадати походження слова.',
    group: 'games',
    dependsOn: ['game'],
  },
  /** The Daily Crossword; off while `game` is (ADR 0052). */
  dailyCrossword: {
    name: 'Щоденний кросворд',
    line: 'Новий кросворд щодня серед ігор.',
    group: 'crossword',
    dependsOn: ['game'],
  },
  /** Search: its header button and screen over every non-Retired, non-Hidden Entry (ADR 0054). */
  search: {
    name: 'Пошук',
    line: 'Кнопка й екран пошуку по всіх записах.',
    group: 'content',
  },
  /** The Rarity Test: the short test that sets the top of the Rarity Range (ADR 0054, 0156). */
  rarityTest: {
    name: 'Тест рідкісності',
    line: 'Короткий тест, що підбирає читачеві межу рідкісності слів.',
    group: 'content',
    dependsOn: ['rarityCeiling'],
  },
  /** The Weekly Recap «Твій тиждень»: the Monday Feed Notice about the week before (ADR 0054). */
  weeklyRecap: {
    name: 'Підсумок тижня',
    line: 'У понеділок у стрічці з’являється підсумок «Твій тиждень».',
    group: 'progress',
  },
  /** Yesterday: the Feed Notice «Пам’ятаєш учорашнє слово?» (ADR 0054). */
  yesterday: {
    name: 'Учорашнє слово',
    line: 'У стрічці питання «Пам’ятаєш учорашнє слово?».',
    group: 'feed',
  },
  /** The Word of the Day archive «Слова дня» in Saved (ADR 0054). */
  wordOfTheDayArchive: {
    name: 'Архів слів дня',
    line: 'У збережених є добірка «Слова дня» за минулі дні.',
    group: 'content',
  },
  /** The Active Days calendar on the statistics screen (ADR 0054). */
  activeDaysCalendar: {
    name: 'Календар активних днів',
    line: 'На екрані статистики видно, у які дні читач користувався застосунком.',
    group: 'progress',
  },
  /** The polite pause: the notification plan stops 14 days after the last open, with the Edition's farewell (ADR 0054). */
  politePause: {
    name: 'Ввічлива пауза',
    line: 'Сповіщення вщухають, якщо читач не заходив два тижні.',
    group: 'notifications',
  },
  /** The first week: one intro Feed Notice on each of a new reader's first 7 Active Days (ADR 0054). */
  firstWeek: {
    name: 'Перший тиждень',
    line: 'У перші сім днів читача стрічка показує по одному вступному повідомленню.',
    group: 'onboarding',
  },
  /** «Сезонний декор»: the Decor motif of the local date's Holiday or Season, and its setting (ADR 0055). */
  seasonalDecor: {
    name: 'Сезонний декор',
    line: 'Оформлення змінюється до свят і пір року.',
    group: 'look',
  },
  /** The falling Stress: the Stress mark of a Word card's Lemma falls onto its vowel (ADR 0055). */
  stressAnimation: {
    name: 'Падіння наголосу',
    line: 'На картці слова наголос падає на свою голосну.',
    group: 'content',
  },
  /** Illustrations: the Illustration a Word may carry above its Definition (ADR 0055). */
  illustrations: {
    name: 'Ілюстрації',
    line: 'У слів, які мають малюнок, він показаний над значенням.',
    group: 'content',
  },
  /** Mistake Reports: the Entry card's menu item, its sheet and the queue that sends them (ADR 0056). */
  mistakeReports: {
    name: 'Повідомлення про помилки',
    line: 'У меню запису є пункт, щоб повідомити про помилку в ньому.',
    group: 'content',
  },
  /** Community Counters: the line under the mark buttons and the changes the device sends (ADR 0060). */
  communityCounters: {
    name: 'Лічильники спільноти',
    line: 'Під кнопками позначок видно, скільки читачів знають слово.',
    group: 'progress',
  },
  /** The Community Word «Слово тижня спільноти»: its Monday Feed Notice (ADR 0060). */
  communityWord: {
    name: 'Слово тижня спільноти',
    line: 'У понеділок у стрічці з’являється слово тижня від спільноти.',
    group: 'progress',
    dependsOn: ['communityCounters'],
  },
  /** Analytics: the product events sent through the Core's port while the reader shares anonymous statistics (ADR 0068). */
  analytics: {
    name: 'Аналітика',
    line: 'Застосунок надсилає анонімну статистику користування, якщо читач дозволив.',
    group: 'analytics',
  },
  /** The Visit events «Відвідини»: the app coming to and leaving the foreground, with how long it stayed; off while `analytics` is (spec #1709). */
  analyticsSessions: {
    name: 'Аналітика: відвідини',
    line: 'Рахується, коли читач відкриває застосунок і як довго в ньому буває.',
    group: 'analytics',
    dependsOn: ['analytics'],
  },
  /** The event of a Feature Switch's screen opened, named by the switch; off while `analytics` is (spec #1709). */
  analyticsFeatureUsed: {
    name: 'Аналітика: екрани',
    line: 'Рахується, які можливості читач відкриває.',
    group: 'analytics',
    dependsOn: ['analytics'],
  },
  /** The event of a Search query with nothing found, by its length only; off while `analytics` is (spec #1709). */
  analyticsSearchNoResult: {
    name: 'Аналітика: порожній пошук',
    line: 'Рахується, коли пошук нічого не знайшов (лише довжина запиту).',
    group: 'analytics',
    dependsOn: ['analytics'],
  },
  /** The event of the reader's answer to the device's notification permission; off while `analytics` is (spec #1709). */
  analyticsNotificationPermission: {
    name: 'Аналітика: дозвіл на сповіщення',
    line: 'Рахується відповідь читача на запит дозволу на сповіщення.',
    group: 'analytics',
    dependsOn: ['analytics'],
  },
  /** The NPS answer event, 0 to 10; no screen asks it yet; off while `analytics` is (spec #1709). */
  analyticsNps: {
    name: 'Аналітика: оцінка застосунку',
    line: 'Рахується оцінка застосунку від 0 до 10, коли застосунок про неї питає.',
    group: 'analytics',
    dependsOn: ['analytics'],
  },
  /** The Game events, started and finished; off while `analytics` is (spec #1709). */
  analyticsGames: {
    name: 'Аналітика: ігри',
    line: 'Рахується, коли гру почали й закінчили.',
    group: 'analytics',
    dependsOn: ['analytics'],
  },
  /** The calligraphic Lemma: the Lemma on the Word of the Day card in the Feed set in the Edition's calligraphic font. */
  calligraphy: {
    name: 'Каліграфічне слово',
    line: 'Слово дня в стрічці написане каліграфічним шрифтом видання.',
    group: 'content',
  },
  /** Spotlight: the Spotlight Snapshot the app writes into the system search; off, the snapshot is empty (ADR 0057). */
  spotlight: {
    name: 'Пошук iOS (Spotlight)',
    line: 'Слова можна знайти через системний пошук телефона.',
    group: 'feed',
  },
  /** App Intents: «Слово дня» and «Відкрити гру» open the Word of the Day card and the Game; off, they open the app's start (ADR 0057). */
  appIntents: {
    name: 'Команди Siri',
    line: 'Команди «Слово дня» та «Відкрити гру» працюють із системи.',
    group: 'widgets',
  },
  /** Collection Links: «Поділитися посиланням» on a Collection and the `c/<id>` links that open its copy (ADR 0058). */
  collectionLinks: {
    name: 'Посилання на добірки',
    line: 'Добіркою можна поділитися посиланням, яке відкриє її копію.',
    group: 'content',
  },
  /** A Word from the widget's link takes the place of the open Entry, so «Назад» returns to the Feed. */
  replaceOpenEntry: {
    name: 'Слово з віджета',
    line: 'Слово з віджета заступає відкритий запис, і «Назад» веде до стрічки.',
    group: 'feed',
  },
  /** The Mix kind weights: «Менше», «Звичайно» or «Більше» for each kind beside Words, which space its Feed turns; off, every kind keeps its turn of 0.9. */
  mixKindWeights: {
    name: 'Частота видів записів',
    line: 'Читач сам обирає, як часто в стрічці з’являються фрази, поради й інше.',
    group: 'feed',
  },
  /** The XP log: XP for Game learning actions, kept per Edition, and the XP bar on the Feed (ADR 0066). */
  xpLog: {
    name: 'Досвід (XP)',
    line: 'За навчальні дії нараховується досвід, у стрічці видно смужку XP.',
    group: 'progress',
  },
  /** Streak freezes: a held freeze covers a missed day automatically, 2 at the start, one more per 7 Streak days, at most 2 held (ADR 0066). */
  streakFreezes: {
    name: 'Заморозки серії',
    line: 'Заморозка сама рятує серію, якщо читач пропустив день.',
    group: 'progress',
    dependsOn: ['xpLog'],
  },
  /** The Break: the reader pauses the Streak for up to 7 days, once every 30 days, free; its days keep the Streak and add nothing (ADR 0066). */
  streakBreak: {
    name: 'Перерва в серії',
    line: 'Читач може призупинити серію до семи днів без втрат.',
    group: 'progress',
    dependsOn: ['xpLog'],
  },
  /** The Quick Question: every Nth Feed card asks one Round from an enabled Game Mode over an Eligible Entry; off, the Feed of 0.9. */
  quickQuestion: {
    name: 'Швидке запитання',
    line: 'Іноді просто в стрічці з’являється запитання з гри.',
    group: 'feed',
    dependsOn: ['game'],
  },
  /** The Word Meaning question: the Quick Question may ask what an Eligible Word means, with four Definitions to pick from; off while `quickQuestion` is (ADR 0128). */
  quickQuestionWordMeaning: {
    name: 'Швидке запитання про значення',
    line: 'У швидкому запитанні можна обирати значення слова з чотирьох.',
    group: 'feed',
    dependsOn: ['quickQuestion'],
  },
  /** The onboarding step «ГРАЙ!» after the first Word, which shows the Games; off while `game` is (ADR 0067). */
  playStep: {
    name: 'Крок «Грай!»',
    line: 'У вступі після першого слова читачеві показують ігри.',
    group: 'feed',
    dependsOn: ['game'],
  },
  /** Levels: the Level derived from total XP, its Edition name and the level-milestone Feed Notices (ADR 0066). */
  levels: {
    name: 'Рівні',
    line: 'Рівень читача росте від набраного досвіду й має назву видання.',
    group: 'progress',
    dependsOn: ['xpLog'],
  },
  /** The Daily Goal: its Settings row, its progress on the XP bar and its celebration trigger (ADR 0066). */
  dailyGoal: {
    name: 'Ціль дня',
    line: 'Денна ціль із прогресом на смужці досвіду.',
    group: 'progress',
    dependsOn: ['xpLog'],
  },
  /** The Seen-Word XP: 1 XP for each Word Seen for the first time, up to the day's Daily Goal; off, viewing earns nothing. */
  seenWordXp: {
    name: 'Досвід за перегляд слів',
    line: 'Кожне нове переглянуте слово дає 1 очко досвіду.',
    group: 'progress',
    dependsOn: ['xpLog', 'dailyGoal'],
  },
  /** The Feed Notice «Може, на сьогодні досить?» once a local day after 50 distinct Seen Entries (ADR 0066). */
  enoughForToday: {
    name: 'Досить на сьогодні',
    line: 'У стрічці раз на день питання «Може, на сьогодні досить?».',
    group: 'progress',
  },
  /** The Feed Notice «Ціль дня виконано!» once the reader meets the day's Daily Goal (ADR 0129). */
  goalReachedCard: {
    name: 'Картка «Ціль дня виконано»',
    line: 'Коли ціль дня виконано, у стрічці з’являється вітальна картка.',
    group: 'progress',
    dependsOn: ['xpLog', 'dailyGoal'],
  },
  /** The onboarding questions «Як добре ти знаєш мову?» and «Навіщо», their Feed settings and their anonymous counters (ADR 0067, 0068). */
  questionnaire: {
    name: 'Вступні запитання',
    line: 'У вступі застосунок питає, наскільки добре читач знає мову і навіщо вчить.',
    group: 'onboarding',
  },
  /** Badges: kept milestones from the Core's catalogue of conditions, chosen and named by the Edition (ADR 0066). */
  badges: {
    name: 'Відзнаки',
    line: 'Відзнаки за досягнення, які читач заробляє.',
    group: 'progress',
    dependsOn: ['xpLog'],
  },
  /** The Level ladder of the Profile: one card per Level name with its range of Levels, and the bar to the next name (spec #1641, ADR 0085); off while `xpLog` is. */
  levelLadder: {
    name: 'Драбина рівнів',
    line: 'У профілі видно всі назви рівнів і смугу до наступної назви.',
    group: 'progress',
    dependsOn: ['xpLog'],
  },
  /** The Badge sheet: a tap on any Badge opens its name, date or progress, and an unearned one answers with a toast (ADR 0085); off while `xpLog` or `badges` is. */
  badgeSheet: {
    name: 'Картка відзнаки',
    line: 'Дотик до відзнаки відкриває її назву, дату або прогрес.',
    group: 'progress',
    dependsOn: ['xpLog', 'badges'],
  },
  /** The Badge families overview heading the Badges screen: each family's mark, name, count, description and shape (ADR 0145); off while `xpLog` or `badges` is. */
  badgeFamiliesOverview: {
    name: 'Огляд родин відзнак',
    line: 'Екран «Відзнаки» починається з шести родин: знак, назва, опис і форма.',
    group: 'progress',
    dependsOn: ['xpLog', 'badges'],
  },
  /** The Streak freeze card of the Profile: the freezes held, the last 7 days and the days saved (ADR 0085); off while `xpLog` is. */
  streakFreezeCard: {
    name: 'Картка заморозок',
    line: 'У профілі видно заморожені дні, останній тиждень і врятовані дні.',
    group: 'progress',
    dependsOn: ['xpLog'],
  },
  /** The Break card of the Profile while a Break runs: its dates, a 14-day strip and the next Break's date (ADR 0085); off while `xpLog` is. */
  breakCard: {
    name: 'Картка перерви',
    line: 'У профілі під час перерви видно її дати й день наступної.',
    group: 'progress',
    dependsOn: ['xpLog'],
  },
  /** The Active Days calendar's day lines: a tap on a day tells what happened on it (ADR 0085); off while `xpLog` is. */
  calendarDayLines: {
    name: 'Підписи днів календаря',
    line: 'Дотик до дня календаря розповідає, що в цей день було.',
    group: 'progress',
    dependsOn: ['xpLog'],
  },
  /** The Share Cards of a Level reached, a Badge earned and a Streak milestone; off while `shareCards` or `xpLog` is. */
  progressShareCards: {
    name: 'Картки досягнень',
    line: 'Можна поділитися карткою про новий рівень, відзнаку чи серію.',
    group: 'progress',
    dependsOn: ['shareCards', 'xpLog'],
  },
  /** «Підказка»: the Crossword Hint, which fills one letter of the current Word, costs nothing and marks the day as hinted (ADR 0087); off while `dailyCrossword` is. */
  crosswordHint: {
    name: 'Підказка в кросворді',
    line: 'Кнопка «Підказка» відкриває одну літеру слова.',
    group: 'crossword',
    dependsOn: ['dailyCrossword'],
  },
  /** The Solve time: the on-screen seconds of the Daily Crossword, kept with its XP log record and shown on the solved card (ADR 0087); off while `dailyCrossword` is. */
  crosswordSolveTime: {
    name: 'Час розгадування',
    line: 'У кросворді рахується час, і його видно на готовій картці.',
    group: 'crossword',
    dependsOn: ['dailyCrossword'],
  },
  /** The solved screen of the Daily Crossword, «Розгадано!» with its share buttons (ADR 0087); off while `dailyCrossword` is. */
  crosswordSolvedScreen: {
    name: 'Екран «Розгадано!»',
    line: 'Після розгаданого кросворда з’являється екран із кнопками поширення.',
    group: 'crossword',
    dependsOn: ['dailyCrossword'],
  },
  /** The full-screen Badge stamp after a solved Daily Crossword that earns a Badge (ADR 0087); off while `dailyCrossword` or `badges` is. */
  crosswordBadgeStamp: {
    name: 'Печатка відзнаки за кросворд',
    line: 'Відзнаку за кросворд показано на весь екран.',
    group: 'crossword',
    dependsOn: ['dailyCrossword', 'badges'],
  },
  /** The Mascot beside the question of a Round, in its waiting, glad, wincing and sad states (ADR 0139); off while `game` is. */
  gameRoundMascot: {
    name: 'Талісман у грі',
    line: 'Біля запитання гри стоїть талісман, який реагує на відповідь.',
    group: 'games',
    dependsOn: ['game'],
  },
  /** The third end action «До стрічки» beside «Ще раз» and «До ігор» (ADR 0139); off while `game` is. */
  gameEndToFeed: {
    name: 'Кнопка «До стрічки»',
    line: 'Наприкінці гри є третя кнопка, що веде до стрічки.',
    group: 'games',
    dependsOn: ['game'],
  },
  /** The toast on a tap of a Game Mode that cannot be played, which keeps its normal look (ADR 0139); off while `game` is. */
  gameModeToast: {
    name: 'Підказка про недоступну гру',
    line: 'Дотик до гри, у яку ще не можна грати, показує коротке пояснення.',
    group: 'games',
    dependsOn: ['game'],
  },
  /** The farewell: the polite pause ends with the Edition's farewell on the 14th day without an open; off, it ends in silence. */
  notificationFarewell: {
    name: 'Прощання',
    line: 'Коли сповіщення вщухають, застосунок на прощання пише слово від видання.',
    group: 'notifications',
  },
  /** The notification explainer: the sheet before the system permission prompt, after the first met Daily Goal or on day 3, and its one re-ask Feed Notice 7 days after a refusal. */
  notificationExplainer: {
    name: 'Пояснення про сповіщення',
    line: 'Перед запитом дозволу застосунок пояснює, навіщо потрібні сповіщення.',
    group: 'notifications',
    dependsOn: ['notifications'],
  },
  /** «Коли нагадати?»: the onboarding step after the Daily Goal that sets the one Notification time or none; off while `notifications` is. */
  notificationTimeStep: {
    name: 'Крок «Коли нагадати?»',
    line: 'У вступі читач обирає час нагадування або вимикає його.',
    group: 'notifications',
    dependsOn: ['notifications'],
  },
  /** The later questions through Feed Notices (the interests, the self-rating, the Mix review, the Rarity Test offer and, for an existing reader, the Daily Goal) and the questionnaire retake in Settings (ADR 0067). */
  laterQuestions: {
    name: 'Запитання згодом',
    line: 'Стрічка згодом питає про інтереси, самооцінку та ціль, їх можна пройти ще раз.',
    group: 'onboarding',
  },
  /** «Що тобі цікаво?», the interests among the later questions; off, the Feed skips it and asks the next one (owner 15.11). */
  interestsQuestion: {
    name: 'Запитання «Що тобі цікаво?»',
    line: 'Стрічка питає читача про його інтереси.',
    group: 'onboarding',
    dependsOn: ['laterQuestions'],
  },
  /** The Profile: the screen of the reader's whole progress and the save-progress Feed Notice (ADR 0066). */
  profile: {
    name: 'Профіль',
    line: 'Екран з усім прогресом читача.',
    group: 'progress',
    dependsOn: ['xpLog'],
  },
  /** The Mascot: the Edition's silent figure with its short lines (CONTEXT.md, Mascot). */
  mascot: {
    name: 'Талісман',
    line: 'Мовчазна постать видання з короткими репліками.',
    group: 'look',
  },
  /** The Interface sounds (a shout, a right answer, a wrong answer, a tap) and the «Звуки» setting (ADR 0070). */
  sounds: {
    name: 'Звуки',
    line: 'Звуки інтерфейсу й налаштування «Звуки».',
    group: 'look',
  },
  /** «Менше руху»: the Settings switch that turns every animation into its calmer variant, as the system's Reduce Motion does (ADR 0055). */
  reduceMotion: {
    name: 'Менше руху',
    line: 'Налаштування, що робить усі анімації спокійнішими.',
    group: 'look',
  },
  /** The fast reveal: in one visit to the Feed the first Entry card plays the full reveal and every next card a fast one; off, every card plays the full reveal. */
  fastReveal: {
    name: 'Швидка поява карток',
    line: 'Перша картка з’являється з повною анімацією, наступні швидше.',
    group: 'feed',
  },
  /** The Mood check-in: the Dashboard block that asks «Як настрій?» once a day (ADR 0076). */
  mood: {
    name: 'Настрій',
    line: 'На головній раз на день питають «Як настрій?».',
    group: 'feed',
  },
  /** The Mood's effect: the line under the Mood check-in that says what the picked Mood changed in the Feed, and the second tap that unpicks it (ADR 0185). Off while `mood` is. */
  moodEffect: {
    name: 'Що змінив настрій',
    line: 'Під настроями рядок каже, що змінилось у стрічці; другий дотик знімає настрій.',
    group: 'feed',
    dependsOn: ['mood'],
  },
  /** «Попередні слова»: the Dashboard block with the three newest Word of the Day archive days before today (ADR 0076). Off while `wordOfTheDayArchive` is. */
  previousWords: {
    name: 'Попередні слова',
    line: 'На головній показані три останні слова дня.',
    group: 'feed',
    dependsOn: ['wordOfTheDayArchive'],
  },
  /** The Correction Types rail: the Dashboard's tile per Correction Type with its screen (ADR 0076). Off while `corrections` is. */
  correctionTypes: {
    name: 'Типи виправлень',
    line: 'На головній є плитки типів виправлень, кожна зі своїм екраном.',
    group: 'content',
    dependsOn: ['corrections'],
  },
  /** Curated Collections: the Dashboard's «SLOVO пропонує» rail of editorial Entry sets from the Language Pack, above «Категорії» (ADR 0076, 0178). */
  curatedCollections: {
    name: 'Добірки редакції',
    line: 'На головній є стрічка «Добірки» з підбором записів від редакції.',
    group: 'content',
  },
  /** The gestures hint's demo: while «ГОРТАЙ ПАЛЬЦЕМ» is open, the Feed's card plays the swipes right, left and up in a loop, its edge labels sliding in, with a finger over it and each row of the sheet lit in turn (ADR 0112); off, the sheet stands still. Off while `knowledge` is. */
  gesturesHintDemo: {
    name: 'Показ жестів',
    line: 'У підказці про жести картка сама показує свайпи.',
    group: 'feed',
    dependsOn: ['knowledge'],
  },
  /** «Показати підказку жестів» in Settings (owner 16.11): forgets that the gestures hint was shown, so the Feed shows «ГОРТАЙ ПАЛЬЦЕМ» once more. Off while `knowledge` is. */
  gesturesHintAgain: {
    name: 'Підказка жестів знову',
    line: 'У Налаштуваннях є рядок, що ще раз показує підказку про жести в Стрічці.',
    group: 'feed',
    dependsOn: ['knowledge'],
  },
  /** The source tab: every tabbed Entry card's last tab «Джерело» names its sources, each on its own line, and the source line leaves the other tabs (ADR 0116). Off, the source line stays in its tab. */
  sourceTab: {
    name: 'Вкладка «Джерело»',
    line: 'Останньою вкладкою картки стоїть «Джерело» зі списком джерел.',
    group: 'content',
  },
  /** The Tip card's tab «Винятки»: a Tip with exceptions shows them after «Правило», their text and their words in chips (ADR 0120). Off, the card has «Правило» alone. */
  tipExceptions: {
    name: 'Вкладка «Винятки»',
    line: 'Картка поради має вкладку з винятками з правила.',
    group: 'content',
  },
  /** The Search button of the Feed's header, which opens the Search screen; Search itself stays under `search`. Off while `search` is. */
  searchButton: {
    name: 'Кнопка пошуку',
    line: 'У шапці стрічки є кнопка, що відкриває пошук.',
    group: 'content',
    dependsOn: ['search'],
  },
  /** The Feed header's wordmark as a button that opens the Dashboard (ADR 0079). */
  dashboardWordmark: {
    name: 'Назва веде на головну',
    line: 'Назва застосунку в шапці стрічки відкриває головну.',
    group: 'feed',
  },
  /** The daily splash: a tap on the Dashboard's logo plays the short splash cut, then the Dashboard again (ADR 0105). */
  dailySplash: {
    name: 'Щоденна заставка',
    line: 'Дотик до логотипа на головній показує коротку заставку.',
    group: 'feed',
  },
  /** The hero's sparks: the Mascot in the Dashboard's hero throws sparks from its megaphone, always, not as Decor (ADR 0109). */
  heroSparks: {
    name: 'Іскри талісмана',
    line: 'Талісман на головній викидає іскри з мегафона.',
    group: 'feed',
  },
  /** The «Стрічка» tab opens the Feed, not the Dashboard, which stays the home at launch (ADR 0093). */
  feedTab: {
    name: 'Вкладка «Стрічка»',
    line: 'Вкладка «Стрічка» відкриває стрічку, а не головну.',
    group: 'feed',
  },
  /** Category screens: the Dashboard's «Категорії» rail of Categories of Words, their grid and each one's screen (ADR 0081). */
  categoryScreens: {
    name: 'Екрани категорій',
    line: 'На головній є стрічка «Категорії» слів, кожна зі своїм екраном.',
    group: 'feed',
  },
  /** The grid of the Categories of Corrections behind the «Виправлення» rail header and each one's screen (ADR 0081); off, the header is a plain title. Off while `corrections` is. */
  correctionCategoryScreens: {
    name: 'Категорії виправлень',
    line: 'Заголовок «Виправлення» відкриває сітку категорій виправлень.',
    group: 'feed',
    dependsOn: ['corrections'],
  },
  /** The «Виправлення» rail's header counts its Correction Types and opens their grid, k2 «Категорії» under it (ADR 0140, owner 15.11). */
  correctionTypeGrid: {
    name: 'Сітка типів виправлень',
    line: 'Заголовок «Виправлення» рахує типи і відкриває їхню сітку.',
    group: 'feed',
    dependsOn: ['correctionCategoryScreens'],
  },
  /** The Category's Feed: a tap on a Word of a Category's screen opens a Feed of that Category's Words alone, from the tapped one in Language Pack order and round again after the last (ADR 0110); off, the tap opens the Word's card as Search does. Off while `categoryScreens` is. */
  categoryFeed: {
    name: 'Стрічка категорії',
    line: 'Дотик до слова категорії відкриває стрічку лише з її слів.',
    group: 'feed',
    dependsOn: ['categoryScreens'],
  },
  /** A Curated Collection's Feed: a tap on an Entry of a Curated Collection's screen opens a Feed of that collection's Entries of every kind alone, from the tapped one in its order and round again after the last (ADR 0178); off, the tap opens the Entry's card as Search does. Off while `curatedCollections` is. */
  curatedCollectionFeed: {
    name: 'Стрічка добірки',
    line: 'Дотик до запису добірки відкриває стрічку лише з її записів.',
    group: 'feed',
    dependsOn: ['curatedCollections'],
  },
  /** «Скопіювати посилання» on the share sheet of a Collection, which copies its Collection Link with `expo-clipboard` (ADR 0132); off until the EAS build with that module is out, and off the sheet keeps the system Share alone. Off while `collectionLinks` is. */
  collectionLinkCopy: {
    name: 'Копіювання посилання',
    line: 'У вікні поширення добірки є кнопка «Скопіювати посилання».',
    group: 'content',
    dependsOn: ['collectionLinks'],
  },
  /** The Due Quiz «Перевір себе» on «Вчу»: three meanings for each Word due for Review today, right sets Known and wrong Unknown (ADR 0131); off, «Вчу» has no card. Off while `knowledge` is. */
  dueQuiz: {
    name: 'Перевір себе',
    line: 'У розділі «Вчу» картка з перевіркою слів, які час повторити.',
    group: 'feed',
    dependsOn: ['knowledge'],
  },
  /** The Profile's confirmed Entries by rarity («Підтверджені записи за рідкістю»); off while `profile` or `confirmedEntries` is. */
  profileConfirmedByRarity: {
    name: 'Підтверджені за рідкістю',
    line: 'У профілі видно підтверджені записи за рівнем рідкісності.',
    group: 'progress',
    dependsOn: ['profile', 'confirmedEntries'],
  },
  /** The Profile's Best result of each Game Mode («Найкраще в грі»); off while `profile` or `game` is. */
  profileGameBest: {
    name: 'Найкраще в грі',
    line: 'У профілі видно найкращий результат у кожній грі.',
    group: 'games',
    dependsOn: ['profile', 'game'],
  },
  /** Force update: the banner below the soft minimum and the blocking screen below the hard minimum of the app version (ADR 0089); off, neither shows. */
  forceUpdate: {
    name: 'Примусове оновлення',
    line: 'Застосунок просить оновитися або не пускає далі зі старою версією.',
    group: 'look',
  },
  /** «Нагору»: the round arrow-up button over a long list once the reader has scrolled down, which scrolls the list gently back to its top; off, no button. */
  scrollToTop: {
    name: 'Кнопка «Нагору»',
    line: 'Над довгим списком є кругла стрілка, що повертає на початок.',
    group: 'feed',
  },
  /** «Скинути прогрес»: the reset marker in the XP log, after which every progress value counts from zero (ADR 0133); off, no button. Off while `xpLog` is. */
  progressReset: {
    name: 'Скидання прогресу',
    line: 'Кнопка «Скинути прогрес» починає лічити весь прогрес з нуля.',
    group: 'progress',
    dependsOn: ['xpLog'],
  },
  /** «Експортувати мої дані»: one file of the reader's user state, built on the device and handed to the system share window (ADR 0135); off, the row is absent. */
  dataExport: {
    name: 'Експорт даних',
    line: 'Рядок «Експортувати мої дані» дає файл із даними читача.',
    group: 'account',
  },
  /** The reader's name on the Profile: its header and its «Ім’я» row (ADR 0136); off, the header shows the Level alone. Off while `profile` is. */
  readerName: {
    name: 'Ім’я читача',
    line: 'У профілі є ім’я читача в шапці та рядок «Ім’я».',
    group: 'account',
    dependsOn: ['profile'],
  },
  /** The widget previews «Малий», «Середній» and «Екран блокування» on the Widgets screen, drawn from the Widget Snapshot; off, the steps alone. Off while `widget` is. */
  widgetPreviews: {
    name: 'Перегляд віджетів',
    line: 'На екрані віджетів видно, який вигляд матимуть малий, середній і на екрані блокування.',
    group: 'widgets',
    dependsOn: ['widget'],
  },
  /** The switch-off unit: turning «Ділитися анонімною статистикою» off sends one anonymous +1 with the Edition alone, and nothing after (ADR 0163); off, nothing is sent at switch-off. */
  statisticsOffCounter: {
    name: 'Лічильник вимкнень статистики',
    line: 'Коли читач вимикає анонімну статистику, застосунок один раз надсилає анонімну одиницю, лише з виданням.',
    group: 'analytics',
  },
});

/**
 * The states of a test or fixture Edition: every Feature Switch `on` but the
 * ones it states (ADR 0196). The real Edition declares every switch itself.
 */
export function featureSwitchStates(stated: Partial<FeatureSwitches> = {}): FeatureSwitches {
  return FeatureSwitchesSchema.parse({
    ...Object.fromEntries(Object.keys(FEATURE_SWITCHES).map((feature) => [feature, 'on'])),
    ...stated,
  });
}
