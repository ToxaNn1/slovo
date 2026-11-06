import type { ColorTokens, EditionTokens, FontSize, MascotState } from '@slovo/contracts';

/**
 * The design tokens from `docs/design/README.md`. The Core names every
 * token and holds the neutral values; an Edition supplies its own values in
 * `editions/<edition>/tokens.json` (ADR 0006). Sizes and spacing belong to the
 * layouts, so they stay in the Core.
 *
 * This file holds the shared base: the Theme's colours, the type roles, the
 * shadows, wedges and halftone, motion and the Mascot, the spacing grid and the
 * measures every screen shares.
 */

/** Light or dark: how the app is drawn right now. */
export type ColorScheme = 'light' | 'dark';

export interface DesignTokens {
  readonly colors: Readonly<Record<ColorScheme, ColorTokens>>;
  /** Font family names, or `undefined` for the platform's system font. */
  readonly fontFamilies: { readonly word: string | undefined; readonly ui: string | undefined };
  readonly radii: {
    readonly tile: number;
    readonly card: number;
    readonly chip: number;
    readonly button: number;
    readonly sheet: number;
  };
}

/**
 * The Core's neutral tokens, used for every group an Edition leaves out: greys
 * alone. A right answer and the heart take the accent, a wrong answer the ink,
 * and a destructive action a grey that carries white text in both Themes.
 */
export const coreTokens: DesignTokens = {
  colors: {
    light: {
      background: '#F4F4F2',
      surface: '#FFFFFF',
      ink: '#161616',
      muted: '#6A6A6A',
      accent: '#161616',
      decor: '#D6D6D2',
      surfaceSunken: '#EFEFEC',
      line: 'rgba(0, 0, 0, 0.1)',
      correct: '#161616',
      wrong: '#161616',
      heart: '#161616',
      destructive: '#6A6A6A',
      tile: '#FFFFFF',
      tileEdge: '#D6D6D2',
      accentEdge: '#000000',
      onAccent: '#FFFFFF',
      highlight: '#E8E8E5',
      silhouette: 'rgba(0, 0, 0, 0.14)',
      tabBar: 'rgba(244, 244, 242, 0.94)',
    },
    dark: {
      background: '#111111',
      surface: '#1C1C1C',
      ink: '#F2F2F0',
      muted: '#9C9C9C',
      accent: '#F2F2F0',
      decor: '#3A3A3A',
      surfaceSunken: '#262626',
      line: 'rgba(255, 255, 255, 0.12)',
      correct: '#F2F2F0',
      wrong: '#F2F2F0',
      heart: '#F2F2F0',
      destructive: '#6A6A6A',
      tile: '#262626',
      tileEdge: '#000000',
      accentEdge: '#9C9C9C',
      onAccent: '#111111',
      highlight: '#3A3A3A',
      silhouette: 'rgba(255, 255, 255, 0.1)',
      tabBar: 'rgba(17, 17, 17, 0.94)',
    },
  },
  fontFamilies: { word: undefined, ui: undefined },
  radii: { tile: 14, card: 22, chip: 14, button: 14, sheet: 22 },
};

/** The Edition's tokens over the Core's neutral ones, group by group. */
export function designTokens(edition: EditionTokens): DesignTokens {
  return {
    colors: edition.colors ?? coreTokens.colors,
    fontFamilies: edition.fontFamilies ?? coreTokens.fontFamilies,
    radii: edition.radii ?? coreTokens.radii,
  };
}

/** A font weight a type role sets; the Edition's families bring these weights. */
export type FontWeight = '400' | '500' | '600' | '700' | '800' | '900';

/** One type role of the design: which family slot it takes and how it sets text. */
export interface TypeRoleSpec {
  readonly family: 'word' | 'ui';
  readonly size: number;
  readonly weight: FontWeight;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly textTransform: 'none' | 'uppercase';
}

const role = (
  family: TypeRoleSpec['family'],
  weight: FontWeight,
  size: number,
  lineHeight: number,
  letterSpacing = 0,
  textTransform: TypeRoleSpec['textTransform'] = 'none',
): TypeRoleSpec => ({ family, size, weight, lineHeight, letterSpacing, textTransform });

/**
 * The Core's type roles (ADR 0070): a role carries its weight, so components
 * write none. The word family sets the loud roles, the UI family the reading
 * text and the meta.
 */
export const typeRoles = {
  shout: role('word', '900', 96, 88, -5),
  heroWord: role('word', '900', 50, 50, -1.5),
  screenTitle: role('word', '900', 30, 30, -1, 'uppercase'),
  heading: role('word', '800', 18, 20, 0.5),
  eyebrow: role('word', '700', 11, 13, 2, 'uppercase'),
  buttonLabel: role('word', '900', 16, 16, 0, 'uppercase'),
  listWord: role('word', '800', 17, 20),
  /** Reading text: a Definition. */
  definition: role('ui', '500', 19, 27),
  /** Reading text: an Example. */
  example: role('ui', '400', 17, 25),
  /** Reading text: the line under a heading. */
  sub: role('ui', '500', 15, 21),
  meta: role('ui', '500', 13, 17),
  /** A Settings row's label. */
  rowLabel: role('ui', '600', 16, 19),
  /** The muted line under a Settings row's label, and its value. */
  rowSub: role('ui', '400', 13, 17),
  /** A tab's label under its icon. */
  tabLabel: role('ui', '600', 11, 11),
  /** The rotated black title of a bottom sheet. */
  sheetTitle: role('word', '900', 18, 18, 0.5, 'uppercase'),
  /** The title of a row of the gestures hint sheet, «Вправо — знаю». */
  hintRowTitle: role('word', '900', 15, 17),
  /** A toast's message. */
  toast: role('ui', '600', 14, 19),
  /** The label of a toast's button. */
  toastAction: role('word', '800', 12, 12, 0, 'uppercase'),
  /** The mark's label in the wedge at the edge a swiped Entry card leaves (board 04). */
  swipeEdge: role('word', '900', 26, 26, -0.5, 'uppercase'),
  /** The stamp a swipe leaves on a marked Entry card. */
  swipeStamp: role('word', '800', 18, 22, 2, 'uppercase'),
  /** The app's name beside the wedge at the top of the Feed. */
  logo: role('word', '900', 22, 22, -0.5),
  /** Today in the Feed's header. */
  headerDate: role('ui', '600', 13, 13),
  /** The Streak in its pill. */
  streak: role('word', '800', 14, 14),
  /** The word an onboarding step shouts on its red top. */
  stepShout: role('word', '900', 168, 151, -8),
  /** An onboarding step's title. */
  stepTitle: role('word', '800', 28, 31, -0.5),
  /** An onboarding step's text under its title. */
  stepText: role('ui', '400', 16, 23),
  /** The number on a Daily Goal tile of the onboarding. */
  goalNumber: role('word', '900', 26, 26),
  /** The unit under a Daily Goal tile's number. */
  goalUnit: role('ui', '600', 12, 12),
  /** The title of a Feed Notice's card. */
  noticeTitle: role('word', '900', 22, 24),
  /** The text of a Feed Notice's card, under its title. */
  noticeText: role('ui', '400', 15, 22),
  /** A number of the Weekly Recap. */
  recapNumber: role('word', '900', 24, 24),
  /** The label under a number of the Weekly Recap. */
  recapLabel: role('ui', '500', 12, 14),
  /** The Word of the Community Word card. */
  communityWord: role('word', '900', 30, 30, -0.5),
  /** The Definition under the Word of the Community Word card. */
  communityDefinition: role('ui', '500', 16, 22),
  /** The title of the end-of-Cycle card. */
  endOfCycleTitle: role('word', '900', 26, 29),
  /** The Games screen's title. */
  gamesTitle: role('word', '900', 36, 36, -1, 'uppercase'),
  /** The title of a group of Game Modes, after its red mark. */
  groupTitle: role('word', '800', 13, 13, 1.5, 'uppercase'),
  /** The glyph on a Game Mode's tile. */
  modeGlyph: role('word', '900', 15, 15),
  /** A Game Mode's name in its row. */
  modeName: role('ui', '700', 16, 18),
  /** A Game Mode's line under its name. */
  modeLine: role('ui', '400', 13, 16),
  /** A Game Mode's Best result at the end of its row. */
  modeBest: role('word', '800', 12, 12),
  /** The Daily Crossword's name on its red card. */
  crosswordTitle: role('word', '900', 19, 20, 0, 'uppercase'),
  /** The Daily Crossword's name in its screen's header, beside the back tile. */
  crosswordHeader: role('word', '900', 18, 18, 0, 'uppercase'),
  /** How far today's Daily Crossword has come, on its red card. */
  crosswordState: role('word', '800', 12, 12, 1, 'uppercase'),
  /** The day under the Daily Crossword's name on its red card. */
  crosswordDay: role('ui', '600', 13, 17),
  /** A letter in a cell of the small grid on the Daily Crossword's red card. */
  crosswordMiniLetter: role('word', '800', 11, 13, 0, 'uppercase'),
  /** The XP earned in all, in its pill beside the Games screen's title. */
  xpPill: role('word', '800', 13, 13),
  /** How many Rounds have passed, in a Game's header when it has no Round limit. */
  roundPassed: role('word', '800', 13, 13),
  /** The «−1» that rises from a lost Life. */
  lifeLost: role('word', '900', 13, 13),
  /** The label over a Round's prompt, and a Quick Question's title. */
  roundLabel: role('word', '800', 12, 12, 1.5, 'uppercase'),
  /** A Round's head: its label and place, such as «НАГОЛОС · 6/10». */
  roundHead: role('word', '800', 12, 12, 2, 'uppercase'),
  /** A Round's prompt on its card. */
  roundPrompt: role('word', '800', 24, 30),
  /** A Round's option on its tile. */
  roundOption: role('word', '800', 18, 22),
  /** The verdict over the Round's answer sheet, right or wrong: the board's big uppercase banner title. */
  roundVerdict: role('word', '900', 30, 30, -0.5, 'uppercase'),
  /** The right answer on the Round's answer sheet. */
  roundAnswer: role('word', '500', 30, 39),
  /** A Round's explanation, and the Definition under its prompt. */
  roundExplanation: role('ui', '400', 16, 25),
  /** A letter in a blank of the typed answer. */
  blankLetter: role('word', '900', 22, 26),
  /** What the user types as a Round's answer. */
  typedAnswer: role('word', '800', 20, 24),
  /** The number of a step of the widget guide. */
  guideNumber: role('ui', '700', 15, 15),
  /** The title of a step of the widget guide. */
  guideTitle: role('ui', '700', 17, 20),
  /** The Lemma on a widget of the widget guide's drawing. */
  widgetLemma: role('word', '500', 24, 29),
  /** The short line under the Lemma on the drawing's medium widget. */
  widgetLine: role('word', '500', 12, 15),
  /** An Idiom's «Походження». */
  idiomEtymology: role('ui', '400', 14, 20),
  /** The name of a hidden category on the Hidden screen. */
  hiddenName: role('ui', '700', 15, 18),
  /** The count beside a Collection's title. */
  collectionCount: role('word', '500', 22, 22),
  /** A recent query of Search. */
  recentQuery: role('ui', '600', 16, 19),
  /** The text button that clears the recent queries of Search. */
  recentClear: role('ui', '600', 15, 18),
  /** The text button that clears the history of the Saved screen. */
  historyClear: role('ui', '600', 17, 20),
  /** The line on a solved Daily Crossword. */
  crosswordSolved: role('word', '500', 28, 32),
  /** A segment's label in a segmented control. */
  segment: role('ui', '700', 13, 16),
  /** The part of speech beside the Lemma on a Word card. */
  partOfSpeech: role('ui', '600', 15, 15),
  /** A Word named as a link inside a line of reading text, such as a Synonym Row's dominant. */
  linkWord: role('word', '800', 15, 21),
  /** An accent text button's label, such as a Word card's "more". */
  textLink: role('ui', '700', 15, 15),
  /** The text under a section heading of a card: the Word History, the etymology. */
  sectionText: role('ui', '400', 15, 22),
  /** A non-standard form a Word card links to a Correction, in italics. */
  oftenSaidForm: role('word', '400', 14, 18),
  /** A Collection's name on its card of the Collections screen. */
  collectionCardName: role('word', '800', 14, 17),
  /** How many Entries a Collection holds, under its name on its card. */
  collectionCardCount: role('ui', '600', 12, 12),
  /** A Synonym Row member's shade note, in italics after it. */
  shadeNote: role('ui', '400', 13, 17),
  /** `Lemma, hero`: the onboarding welcome's Lemma. */
  heroLemma: role('word', '900', 76, 76),
  /** A quiet text button of the onboarding, such as «Пропустити» and «Пізніше». */
  quietAction: role('ui', '700', 14, 17),
  /** A Word on its cell of the Pairs Game. */
  pairsWord: role('word', '800', 14, 16),
  /** A Definition on its cell of the Pairs Game, wrapping over as many lines as it needs. */
  pairsDefinition: role('ui', '600', 15, 19),
  /** An empty state's title. */
  emptyTitle: role('word', '900', 22, 25),
  /** An empty state's line of muted text under its title. */
  emptyText: role('ui', '400', 15, 22),
  /** A letter of the Word in a Round of the vowel form, in the Round's prompt size. */
  vowelWordLetter: role('word', '500', 25, 32.5),
  /** A vowel on its button in a Round of the vowel form. */
  vowelButton: role('word', '900', 25, 32.5),
  /** A reminder's time on its Settings row. */
  reminderTime: role('word', '500', 22, 26),
  /** The «soon» tag of a Settings row that a later version brings. */
  soonTag: role('ui', '700', 11, 13, 1.5, 'uppercase'),
  /** A letter on its cell of the Daily Crossword. */
  crosswordLetter: role('word', '900', 26, 31.2, 0, 'uppercase'),
  /** The clue of the Daily Crossword's selected word, on its bar. */
  crosswordClue: role('ui', '600', 15, 19.5),
  /** The selected word's number and direction, such as «1→», on its red badge of the clue bar. */
  crosswordClueNumber: role('word', '900', 14, 14),
  /** A word's number in the corner of its first cell of the Daily Crossword. */
  crosswordCellNumber: role('ui', '700', 10, 10),
  /** A letter on a key of the Daily Crossword's keyboard. */
  crosswordKey: role('ui', '700', 15, 18, 0, 'uppercase'),
  /** A letter of the wordmark popping up on the splash, on its 390-wide frame; the splash scales it. */
  splashLetter: role('word', '900', 58, 58, -2),
  /** The tagline under the splash's wordmark, on its 390-wide frame; the splash scales it. */
  splashTagline: role('ui', '500', 17, 17),
  /** The Category's name on its filled chip of a Word card. */
  categoryChip: role('ui', '600', 12.5, 15),
  /** A chip's label: a Category of the Mix, a tab of the Saved screen. */
  chipLabel: role('ui', '700', 14, 17),
  /** The count beside a chip's label. */
  chipCount: role('ui', '600', 12, 14),
  /** The seconds left beside a timed Game's bar. */
  timerSeconds: role('word', '800', 14, 17),
  /** The Community Counters line under an Entry card's mark buttons. */
  communityCounters: role('ui', '400', 13, 17),
  /** The giant ∞ behind the end-of-Cycle card. */
  endOfCycleInfinity: role('word', '900', 330, 330),
  /** A Badge's symbol on its mark, at a 156-wide mark; the mark scales it to a third of its side. */
  badgeSymbol: role('word', '900', 52, 62),
  /** The Game Review's title. */
  reviewTitle: role('word', '800', 15, 15),
  /** The ✓ or ✗ on a Round's mark in the Game Review. */
  reviewMark: role('word', '900', 13, 13),
  /** A Round's Lemma in the Game Review. */
  reviewWord: role('ui', '700', 15, 17),
  /** The line under a Round's Lemma in the Game Review: what was picked. */
  reviewPicked: role('ui', '500', 12, 14),
  /** A label over a part of an expanded Round, such as the standard form. */
  reviewHeading: role('ui', '700', 13, 17),
  /** The standard form of an expanded Round's Correction. */
  reviewForm: role('ui', '500', 15, 22),
  /** The big Streak at the top of the stats sheet. */
  statsStreak: role('word', '500', 64, 70),
  /** The words beside the big Streak of the stats sheet. */
  statsStreakLabel: role('ui', '600', 16, 20),
  /** A count's number on the stats sheet's grid. */
  statsCount: role('word', '500', 28, 34),
  /** The words under a count of the stats sheet, and the Best Streak. */
  statsNote: role('ui', '400', 14, 18),
  /** A line of the stats sheet's Known and due counts. */
  statsLine: role('ui', '400', 16, 22),
  /** The title of the Feed's error state. */
  errorTitle: role('word', '500', 28, 34),
  /** What went wrong, under the title of the Feed's error state. */
  errorText: role('ui', '400', 15, 24),
  /** A Tip's title. */
  tipTitle: role('word', '900', 22, 25),
  /** What leads a list row's Lemma, such as a Collection's name, in the Lemma's size. */
  listLeading: role('ui', '500', 17, 20),
  /** The trailing text of a list row, such as when it was saved. */
  rowTrailing: role('ui', '700', 12, 12),
  /** The title on the red panel of the Game's result. */
  resultTitle: role('word', '900', 40, 38, -1.5),
  /** The line under the title of the Game's result. */
  resultLine: role('ui', '700', 16, 20),
  /** The capitalised label over a group of controls or a card's section. */
  sectionLabel: role('word', '800', 13, 13, 1, 'uppercase'),
  /** How far a run of questions has come, such as «4 з 10» of the Rarity Test. */
  progressCount: role('ui', '600', 13, 13),
  /** A Badge's date or progress under its mark on the Badges screen. */
  badgeProgress: role('ui', '500', 11, 13),
  /** A Badge's name under its title on the stamp of a newly earned Badge. */
  stampName: role('ui', '500', 16, 21),
  /** The name over a Badge family's row of marks. */
  badgeFamily: role('word', '800', 12, 14, 1),
  /** A line of the Profile with no card of its own, such as all XP while the Levels are off. */
  profileText: role('ui', '400', 15, 22),
  /** The Level's number in the ring of the Profile's Level card. */
  levelNumber: role('word', '900', 44, 44),
  /** The word under the Level's number in its ring. */
  levelLabel: role('word', '700', 10, 10, 1.5, 'uppercase'),
  /** The Level's name on the Profile's Level card. */
  levelName: role('word', '900', 21, 23),
  /** The XP towards the next Level on the Profile's Level card. */
  levelXp: role('ui', '600', 14, 18),
  /** The Profile's giant red Streak. */
  profileStreak: role('word', '900', 60, 60, -2),
  /** The words beside the Profile's giant Streak. */
  profileStreakLabel: role('word', '800', 16, 18),
  /** The name of the screen before, beside the back tile that returns to it. */
  backLink: role('ui', '500', 14, 17),
  /** The label of an action a list row's swipe shows. */
  swipeAction: role('ui', '700', 14, 17),
  /** The «Повторити» tag of an Entry due for review. */
  reviewTag: role('word', '800', 11, 11, 1, 'uppercase'),
  /** The label over a form of a Correction: «Так часто кажуть», «Українською краще». */
  formLabel: role('ui', '600', 12, 12, 0.5),
  /** A Correction's non-standard form, struck through. */
  nonStandardForm: role('word', '800', 24, 26),
  /** A Correction's explanation, also in an expanded Round of the Game Review. */
  explanation: role('ui', '400', 15, 22),
  /** The Entry's Lemma over a sheet, such as the Collection sheet. */
  sheetLemma: role('word', '600', 20, 24),
  /** A text button of a sheet: «+ Нова колекція», a field's «Створити». */
  textButton: role('ui', '700', 17, 20),
  /** What the reader types in a field. */
  fieldText: role('ui', '500', 16, 20),
  /** The label over a field, and a small label of a form. */
  fieldLabel: role('ui', '600', 14, 18),
  /** What is wrong with a field's value, under it. */
  fieldProblem: role('ui', '600', 13, 17),
  /*
   * The Share Card's roles at the Story's scale; the card scales each by its
   * width, keeping the role's line height as a share of its size.
   */
  /** The giant glyph behind a Share Card's text. */
  shareGiant: role('word', '900', 320, 320, -8),
  /** The kicker over a Share Card's headline. */
  shareKicker: role('word', '800', 10, 13, 1.5, 'uppercase'),
  /** A Share Card's headline, with room above its glyphs for a Stress mark over a tall vowel. */
  shareHeadline: role('word', '900', 40, 44, -1),
  /** A Share Card's reading text. */
  shareSub: role('ui', '500', 12, 16.8),
  /** A label of a Share Card: over a form, under a stat. */
  shareLabel: role('ui', '600', 10, 14),
  /** A form on a Share Card under its label, such as the non-standard form. */
  shareForm: role('word', '500', 22, 30.8),
  /** A number of the Weekly Recap on its Share Card. */
  shareStat: role('word', '900', 18, 22),
  /** The watermark at the foot of a Share Card. */
  shareWatermark: role('ui', '600', 10, 12),
  /** The giant letter behind the About screen's red panel. */
  aboutGiant: role('word', '900', 220, 220),
  /** The app's name on the About screen's red panel. */
  aboutName: role('word', '900', 34, 34, -1),
  /** What SLOVO is, on the About screen's card. */
  aboutDescription: role('word', '500', 22, 30),
  /** Settings' title beside its back tile (design `SlovoApp`, Settings). */
  settingsTitle: role('word', '800', 22, 22),
  /** The title of a screen that a Settings row opens, beside its back tile. */
  settingsSubTitle: role('word', '800', 20, 22),
  /** The hero Word's Definition under its Lemma on the onboarding welcome. */
  heroDefinition: role('word', '500', 22, 29),
  /** A weekday's letters over a column of the Active Days calendar. */
  calendarWeekday: role('ui', '700', 11, 13),
  /** A day's number on its tile of the Active Days calendar. */
  calendarDay: role('word', '800', 13, 16),
  /** A hint under a control: why it is off, or what was refused. */
  hint: role('ui', '400', 15, 22),
  /** A letter on its chip of a Round's chips form. */
  chipLetter: role('word', '900', 26, 30),
  /** A word on its chip of a Round's chips form, smaller so an expression of 8 words fits. */
  chipWord: role('word', '800', 18, 22),
  /** The text of a small label chip, such as a Correction Type. */
  labelChip: role('ui', '700', 11.5, 14),
  /** The label under the Streak's number on its red tile of the Weekly Recap. */
  recapLabelMarked: role('ui', '600', 12, 14),
  /** The label under the icon of a tile of an Entry's action row, «Улюблене». */
  actionLabel: role('ui', '600', 10.5, 10.5),
  /** The line under an Entry's action row that says where the Entry is kept. */
  actionHint: role('ui', '600', 13, 15.6),
  /** The shout on the closed card of the Word of the Day, «ЛОВИ СЛОВО!». */
  heroShout: role('word', '900', 40, 38, -1.5, 'uppercase'),
  /** The kicker over the Lemma on a red ground, such as «СЛОВО ДНЯ · 3 ЛИСТОПАДА». */
  heroKicker: role('word', '800', 11, 11, 2, 'uppercase'),
  /** The giant letter behind the card of the Word of the Day: the Lemma's first, or «?» while it is closed. */
  giantLetter: role('word', '900', 360, 360),
  /** The giant letter behind the red panel on top of Entry details. */
  panelLetter: role('word', '900', 420, 420),
  /** The Dashboard's giant «?» behind the hero while it is closed. */
  dashboardQuestion: role('word', '900', 560, 560),
  /** The Dashboard's giant first letter behind the open hero. */
  dashboardLetter: role('word', '900', 520, 520),
  /** The Dashboard hero's kicker, such as «СЛОВО ДНЯ · 2.11». */
  dashboardKicker: role('word', '800', 12, 12, 2, 'uppercase'),
  /** The Dashboard hero's shout, «ЛОВИ СЛОВО!», on two lines. */
  dashboardShout: role('word', '900', 50, 47.5, -2, 'uppercase'),
  /** The Lemma in capitals on the open Dashboard hero. */
  dashboardLemma: role('word', '900', 50, 50, -1.5, 'uppercase'),
  /** The line under the shout or the Lemma on the Dashboard hero. */
  dashboardSubtitle: role('ui', '600', 15, 20.25),
  /** The Stress and part of speech under the Lemma on the Dashboard hero. */
  dashboardWordLine: role('ui', '600', 15, 15),
  /** «РІДКІСТЬ 3/5» beside the rarity bars on the Dashboard hero. */
  dashboardRarity: role('word', '700', 12, 12, 1, 'uppercase'),
  /** The short Definition on the open Dashboard hero. */
  dashboardDefinition: role('ui', '600', 16, 21.6),
  /** The closed Dashboard hero's ink button, «РОЗКРИТИ». */
  dashboardButton: role('word', '900', 16, 16, 0.5, 'uppercase'),
  /** The open Dashboard hero's «ДО КАРТКИ →», a size under «РОЗКРИТИ». */
  dashboardToCardButton: role('word', '900', 15, 15, 0.5, 'uppercase'),
  /** A block's title on the Dashboard, such as «Як настрій?». */
  blockTitle: role('word', '800', 15, 15),
  /** The count or note at the end of a block's title on the Dashboard. */
  blockNote: role('ui', '500', 13, 13),
  /** A Mood's name on its tile. */
  moodName: role('ui', '700', 15, 15),
  /** The date column of «Попередні слова», «31» over «жов». */
  previousDate: role('ui', '600', 12, 14.4),
  /** The Lemma of a row of «Попередні слова». */
  previousWord: role('word', '800', 17, 18.7),
  /** The short Definition of a row of «Попередні слова». */
  previousDefinition: role('ui', '400', 14, 18.2),
  /** A Curated Collection's name on its tile of the Categories rail. */
  categoryName: role('word', '800', 12, 13.8),
  /** «24 слова» on a tile of the Categories rail. */
  categoryCount: role('ui', '500', 12, 12),
  /** A grid screen's title, «Категорії» (board 05.2 k1). */
  gridTitle: role('word', '900', 28, 28, -1),
  /** The count on a grid screen title's baseline, «16». */
  gridCount: role('ui', '600', 14, 14),
  /** A Category's name on its tile of the k1 grid, hyphenated. */
  gridTileName: role('word', '800', 11, 12.65),
  /** A Correction Type's name on its tile of the Corrections rail. */
  correctionName: role('word', '800', 13, 15),
  /** The kicker beside the icon tile on a rail screen's hero, «ВИПРАВЛЕННЯ · 4 приклади». */
  railKicker: role('word', '700', 11, 11, 2),
  /** A rail screen's title on its hero, «Суржик». */
  railTitle: role('word', '900', 36, 36.7, -1),
  /** The line under a rail screen's title. */
  railDescription: role('ui', '500', 15, 21),
  /** «РОЗІБРАНО 0 З 4» over a rail screen's progress bar. */
  railProgress: role('word', '800', 11, 11, 1.5, 'uppercase'),
  /** The add button on a Curated Collection's hero, «ДОДАТИ». */
  railAdd: role('word', '900', 12, 12, 0.5, 'uppercase'),
  /** The type chip on a Correction's card, «суржик». */
  railChip: role('word', '700', 11, 11, 0.5),
  /** A small label on a card: «ТАК ЧАСТО КАЖУТЬ», «УКРАЇНСЬКОЮ КРАЩЕ». */
  railLabel: role('word', '700', 10, 10, 1.5, 'uppercase'),
  /** The struck non-standard form on a Correction's card. */
  railStruck: role('ui', '600', 18, 23.4),
  /** The ink button on a Correction's card, «ЯК ПРАВИЛЬНО?». */
  railButton: role('word', '900', 13, 13, 0, 'uppercase'),
  /** The standard form in a Correction card's revealed block. */
  railStandard: role('word', '900', 19, 22.8, -0.3),
  /** The explanation in a Correction card's revealed block. */
  railNote: role('ui', '500', 14, 19.6),
  /** «Категорія» over a quiet Category's name on its hero (k3). */
  quietLabel: role('ui', '600', 13, 17.55),
  /** A quiet Category's name on its hero (k3). */
  quietTitle: role('word', '800', 30, 32.4, -0.5),
  /** The line under a quiet Category's name (k3). */
  quietDescription: role('ui', '400', 15, 21.75),
  /** The Lemma of a plain row on a quiet Category's screen (k3). */
  quietWord: role('word', '800', 17, 18.7),
  /** The short Definition under it, the gloss. */
  quietGloss: role('ui', '400', 14, 18.2),
  /** The Lemma on a word card of a Curated Collection's screen. */
  railWord: role('word', '800', 19, 20.9),
  /** The «ЗНАЮ» stamp on a known word's card. */
  railKnown: role('word', '800', 10, 10, 1, 'uppercase'),
  /** The Stress and part of speech on a word card. */
  railMeta: role('ui', '500', 13, 13),
  /** The Definition on a word card. */
  railMeaning: role('ui', '400', 15, 21),
} as const satisfies Record<string, TypeRoleSpec>;

export type TypeRole = keyof typeof typeRoles;

/**
 * How far above the baseline the word family's tallest capital mark rises
 * (Ї; Й's breve is just below), and how far its descent falls, in em.
 * Measured in Unbounded Black.
 */
const WORD_CAPITAL_MARK_TOP = 1.01;
const WORD_DESCENT = 0.245;

/** The size a type role is drawn at: its font size and line height. */
export interface DrawnSize {
  readonly fontSize: number;
  readonly lineHeight: number;
}

/**
 * The room a word role needs above its line for a capital Й or Ї, drawn at
 * `drawn`, the role's own size unless given. iOS cuts a line set tighter
 * than the font from the top and keeps the descent at the bottom, so a breve
 * or dots over a capital fall outside the text's box and are clipped:
 * «МОВНИЙ» showed «МОВНИИ». Any word role can start with a capital, so each
 * one set tighter than the font gets the room, capitalised or not.
 */
export function capitalMarkRoom(name: TypeRole, drawn: DrawnSize = roleSize(name)): number {
  if (typeRoles[name].family !== 'word') return 0;
  return Math.max(
    0,
    Math.ceil((WORD_CAPITAL_MARK_TOP + WORD_DESCENT) * drawn.fontSize - drawn.lineHeight),
  );
}

/**
 * The top padding that holds a word role's capital marks, drawn at `drawn`,
 * and the top margin that pulls the line back to where the board sets it.
 */
export function capitalMarkStyle(name: TypeRole, drawn: DrawnSize = roleSize(name)) {
  const room = capitalMarkRoom(name, drawn);
  return room > 0 ? { paddingTop: room, marginTop: -room } : {};
}

/**
 * A type role drawn at `fontSize`, for text that scales a role itself: the
 * line height keeps its share of the size, and the capital marks get the
 * room they need at that size.
 */
export function roleAt(name: TypeRole, fontSize: number) {
  const { size, lineHeight } = typeRoles[name];
  const drawn = { fontSize, lineHeight: (lineHeight * fontSize) / size };
  return { ...drawn, ...capitalMarkStyle(name, drawn) };
}

/**
 * The text style of a type role in the given tokens' families. A word role
 * set tighter than the font carries `capitalMarkStyle`, so the marks draw
 * whole and the line stays where the board sets it. A component that sets
 * its own top margin on such a role adds the room's negative to it.
 */
export function typeStyle(name: TypeRole, tokens: Pick<DesignTokens, 'fontFamilies'>) {
  const { family, size, weight, lineHeight, letterSpacing, textTransform } = typeRoles[name];
  return {
    fontFamily: tokens.fontFamilies[family],
    fontSize: size,
    fontWeight: weight,
    lineHeight,
    letterSpacing,
    textTransform,
    ...capitalMarkStyle(name),
  };
}

/** A type role's size and line height alone, for text that scales them itself. */
export function roleSize(name: TypeRole): DrawnSize {
  const { size, lineHeight } = typeRoles[name];
  return { fontSize: size, lineHeight };
}

/**
 * The hard offset shadow under a pressed tile or button: no blur, the edge
 * colour straight below. Pressed, the tile drops by the difference, so its
 * bottom edge stays where it was.
 */
export const offsetShadow = {
  rest: { depth: 5 },
  pressed: { depth: 1, translateY: 4 },
  /** A key of an on-screen keyboard: a shallower edge, pressed down to the same thin one. */
  key: { depth: 3, translateY: 2 },
  /** A big card, as the Daily Crossword's: a deeper edge, pressed down to the same thin one. */
  card: { depth: 6, translateY: 5 },
} as const;

/** The edge colour of a tile's offset shadow: `accentEdge` under red, `tileEdge` under the rest. */
export function shadowEdge(colors: ColorTokens, onAccent: boolean): string {
  return onAccent ? colors.accentEdge : colors.tileEdge;
}

/** The halftone raster: ink dots of this radius on a square grid of this cell. */
export const halftone = { dot: 'rgba(20, 12, 10, 0.22)', radius: 1.1, cell: 6 } as const;

/** A wedge shape as polygon points, each `[x, y]` a fraction of the box. */
export type Wedge = readonly (readonly [number, number])[];

/** The design's wedge cuts. */
export const wedges = {
  /** A right edge narrower than the left: the toast. */
  wedge: [
    [0, 0],
    [1, 0.3],
    [1, 0.7],
    [0, 1],
  ],
  /** The logo's wedge at the top of the Feed: a right edge narrower than the left. */
  logo: [
    [0, 0],
    [1, 0.22],
    [1, 0.78],
    [0, 1],
  ],
  /** The ink «ЗНАЮ» wedge at a swiped card's left edge: its right edge narrower. */
  swipeKnown: [
    [0, 0],
    [1, 0.18],
    [1, 0.82],
    [0, 1],
  ],
  /** The light «НЕ ЗНАЮ» wedge at a swiped card's right edge: its left edge narrower. */
  swipeUnknown: [
    [0, 0.18],
    [1, 0],
    [1, 1],
    [0, 0.82],
  ],
  /** The Streak's mark in its pill: a cut gem, pointed at the top. */
  streak: [
    [0.5, 0.04],
    [0.875, 0.54],
    [0.667, 0.96],
    [0.333, 0.96],
    [0.125, 0.54],
    [0.375, 0.38],
  ],
  /** The two chevrons under the end-of-Cycle card, which point down to swipe on. */
  swipeOn: [
    [0, 0],
    [0.5, 0.333],
    [1, 0],
    [1, 0.267],
    [0.5, 0.6],
    [0, 0.267],
  ],
  swipeOnLower: [
    [0, 0.4],
    [0.5, 0.733],
    [1, 0.4],
    [1, 0.667],
    [0.5, 1],
    [0, 0.667],
  ],
  /** The loader's wedge: a right edge narrower than the left, from the middle. */
  loader: [
    [0, 0],
    [1, 0.25],
    [1, 0.75],
    [0, 1],
  ],
  /** A slanted band: the toast's mark. */
  band: [
    [0, 0],
    [1, 0.25],
    [1, 1],
    [0, 0.75],
  ],
  /** A box with its bottom right corner cut up. */
  cut: [
    [0, 0],
    [1, 0],
    [1, 0.8],
    [0, 1],
  ],
  /** A band whose top rises to the right: the Share Card's footer. */
  rise: [
    [0, 0.3],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
  /** A shield, pointed at the bottom. */
  shield: [
    [0, 0],
    [1, 0],
    [1, 0.64],
    [0.5, 1],
    [0, 0.64],
  ],
  /** A hexagon lying on its side: the Streak Badges. */
  hexagon: [
    [0.25, 0.03],
    [0.75, 0.03],
    [1, 0.5],
    [0.75, 0.97],
    [0.25, 0.97],
    [0, 0.5],
  ],
  /** A box whose bottom edge falls to the left: the red panel on top of Entry details. */
  panel: [
    [0, 0],
    [1, 0],
    [1, 0.86],
    [0, 1],
  ],
  /** The Dashboard hero's red ground: its bottom edge falls to the left from 90% of the right edge. */
  dashboardHero: [
    [0, 0],
    [1, 0],
    [1, 0.9],
    [0, 1],
  ],
  /** The ink plate under the Dashboard's logo: a left edge shorter than the right. */
  logoPlate: [
    [0, 0.16],
    [1, 0],
    [1, 1],
    [0, 0.84],
  ],
  /** The chevron at the end of a row of «Попередні слова». */
  chevron: [
    [0, 0],
    [0.4, 0],
    [1, 0.5],
    [0.4, 1],
    [0, 1],
    [0.6, 0.5],
  ],
  /** A diamond standing on its point: the Level Badges. */
  diamond: [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
  ],
} as const satisfies Record<string, Wedge>;

/** A cubic Bézier easing curve, as CSS `cubic-bezier(x1, y1, x2, y2)` takes it. */
export type Easing = readonly [number, number, number, number];

/** CSS `ease`, for the motions the design gives no curve. */
const ease: Easing = [0.25, 0.1, 0.25, 1];

/** The design's motions: durations in milliseconds and their curves (ADR 0070). */
export const motion = {
  press: { duration: 80, easing: ease },
  screen: { duration: 500, easing: [0.2, 0.8, 0.2, 1] },
  fly: { duration: 600, easing: [0.2, 0.9, 0.25, 1.15] },
  toast: { duration: 350, easing: [0.2, 0.9, 0.3, 1.1] },
  stamp: { duration: 450, easing: [0.2, 0.9, 0.3, 1.2] },
  /** The Level ring fills to the reader's progress. */
  ring: { duration: 1100, easing: [0.2, 0.8, 0.2, 1] },
  sheet: { duration: 450, easing: [0.2, 0.9, 0.3, 1] },
  pop: { duration: 300, easing: ease },
  /** One beat of the loader's wedges, from short to tall and back. */
  loader: { duration: 800, easing: [0.42, 0, 0.58, 1] },
  /** The toggle's knob slides over and overshoots. */
  switch: { duration: 280, easing: [0.3, 1.9, 0.5, 1] },
  /** Rows rise this far into place, one after another. */
  cascade: { duration: 400, easing: ease, rise: 16 },
  /** The tab indicator stretching in under the tab it moves to. */
  tab: { duration: 300, easing: [0.3, 1.6, 0.5, 1] },
  /** The red band sweeping over a screen as it enters. */
  sweep: { duration: 500, easing: [0.6, 0, 0.3, 1] },
  /** The Mood check-in folds to today's line, or opens its chips again, and the new part rises in. */
  collapse: { duration: 250, easing: ease, rise: 8 },
  /** Under Reduce Motion every motion is this one fade. */
  reduceMotion: { duration: 300, easing: ease },
} as const satisfies Record<
  string,
  { readonly duration: number; readonly easing: Easing; readonly rise?: number }
>;

/**
 * A screen's entrance (the design's `slScr` and `slSweep`), in fractions of
 * the screen's width: the screen slides in by `shift` points while its
 * slanted left edge, `slant` wider at the bottom than at the top, wipes from
 * the right edge `travel` across; a red band of `band.width` sweeps over it,
 * slanted by `band.skewX`, from `band.from` to `band.to` of its own width.
 */
export const screenEnter = {
  shift: 30,
  slant: 0.25,
  travel: 1.4,
  band: { width: 0.45, skewX: '-18deg', from: -1.7, to: 2.8 },
} as const;

/** The Mascot's width in points; its height follows the Edition's vector. */
export const mascotWidth = 130;

/**
 * Where the Mascot's figure stands at one point of its motion: `at` from 0 to
 * 1 through the cycle, a shift in points, a turn in degrees and a scale. What
 * a frame leaves out stays at rest.
 */
export interface MascotFrame {
  readonly at: number;
  readonly y?: number;
  readonly rotate?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
}

/**
 * The Mascot's motion in each state, from the design's keyframes (`rpBob`,
 * `rpBreath`, `rpShout`, `rpHop`, `rpPop`, `rpSquish`, `rpSway`), turning
 * about 30% across and 60% down the figure. `loop` repeats, `alternate` goes
 * back and forth, `once` plays and holds its end. The hat-off state is still,
 * and under Reduce Motion every state is the one fade of `motion.reduceMotion`.
 */
export const mascotMotion = {
  waits: {
    duration: 2400,
    repeat: 'loop',
    easing: [0.42, 0, 0.58, 1],
    frames: [{ at: 0 }, { at: 0.5, y: -5 }, { at: 1 }],
  },
  sleeps: {
    duration: 3000,
    repeat: 'loop',
    easing: [0.42, 0, 0.58, 1],
    frames: [{ at: 0 }, { at: 0.5, scaleX: 1.04, scaleY: 0.97 }, { at: 1 }],
  },
  shouts: {
    duration: 320,
    repeat: 'alternate',
    easing: [0.42, 0, 0.58, 1],
    frames: [{ at: 0 }, { at: 1, scaleX: 1.07, scaleY: 1.07, rotate: -3 }],
  },
  happy: {
    duration: 800,
    repeat: 'loop',
    easing: ease,
    frames: [{ at: 0 }, { at: 0.4, y: -12, rotate: -4 }, { at: 1 }],
  },
  celebrates: {
    duration: 550,
    repeat: 'loop',
    easing: ease,
    frames: [{ at: 0 }, { at: 0.4, y: -12, rotate: -4 }, { at: 1 }],
  },
  surprised: {
    duration: 450,
    repeat: 'once',
    easing: ease,
    frames: [
      { at: 0, scaleX: 0.7, scaleY: 0.7 },
      { at: 0.6, scaleX: 1.15, scaleY: 1.15 },
      { at: 1 },
    ],
  },
  cringes: {
    duration: 500,
    repeat: 'once',
    easing: ease,
    frames: [{ at: 0 }, { at: 0.4, scaleX: 0.86, scaleY: 1.08 }, { at: 1, scaleX: 0.94 }],
  },
  sad: {
    duration: 3200,
    repeat: 'loop',
    easing: [0.42, 0, 0.58, 1],
    frames: [{ at: 0 }, { at: 0.5, rotate: 3 }, { at: 1 }],
  },
  hatOff: undefined,
} as const satisfies Record<
  MascotState,
  | {
      readonly duration: number;
      readonly repeat: 'loop' | 'alternate' | 'once';
      readonly easing: Easing;
      readonly frames: readonly MascotFrame[];
    }
  | undefined
>;

/**
 * How the Core poses the Mascot's parts in some states: the turn of the whole
 * figure about the Edition's pivot, in degrees, and how far the hat drops.
 */
export const mascotPose = { sadTurn: 14, hatOffTurn: 26, cringeHatDrop: 4 } as const;

/** A `#RRGGBB` colour at the given opacity; any other colour as it is. */
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (hex === null) return color;
  const [r, g, b] = hex.slice(1).map((pair) => parseInt(pair, 16));
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}

/** The scrim behind a bottom sheet, from the design: the key ink at 55% in both Themes. */
export const scrim = 'rgba(20, 12, 10, 0.55)';

/** The 4-pt spacing grid. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;

/**
 * The Word card's type sizes at each font-size step: the design's three
 * steps, the hero word and the reading text at their base size, 1.15 times it
 * and 1.3 times it (ADR 0070). S and M both take the base step.
 */
export const fontSizeSteps: Readonly<
  Record<
    FontSize,
    { readonly lemma: number; readonly definition: number; readonly example: number }
  >
> = {
  S: { lemma: 50, definition: 19, example: 17 },
  M: { lemma: 50, definition: 19, example: 17 },
  L: { lemma: 58, definition: 22, example: 20 },
  XL: { lemma: 65, definition: 25, example: 22 },
};

/** Vertical padding of a row in a list, off the 4-pt grid (the design's 14); also the space under a screen's header or over its list. */
export const rowPadding = 14;

/** The gap between the blocks of a Word card, a result or an empty state, off the 4-pt grid (the design's 18). */
export const blockGap = 18;

/** The empty state's space over its content. */
export const emptyStatePaddingTop = 80;

/** The text size scale above which a row puts its value, button or switch under its label, so no word breaks. */
export const STACK_AT_FONT_SCALE = 1.3;

/** The width of a tile of the Dashboard's Correction Types rail, so two and a part show on a phone. */
export const railTileWidth = 152;

/** The smallest side of anything the user taps. */
export const minTouchTarget = 44;

/** How much a button that takes no press is dimmed. */
export const disabledOpacity = 0.5;

/** The opacity a pressed tile fades to where its face does not sink: under Reduce Motion, or with no edge. */
export const pressedFade = 0.7;

/** The heights of a button's face: the design's 58 pt main button, and a small one as tall as a tap area. */
export const buttonHeight = { large: 58, small: 44 } as const;

/** The side of the design's square icon button, and of the icon inside it. */
export const iconButton = { side: 44, icon: 20 } as const;

/** The text on a filled option of the Game and on a destructive swipe action, white in both Themes. */
export const onFill = '#FFFFFF';

/** The colour of a shadow, black in both Themes. */
export const shadowColor = '#000000';
