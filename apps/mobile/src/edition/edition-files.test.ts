import { existsSync, readFileSync } from 'node:fs';

import {
  EditionDecorSchema,
  EditionStringsSchema,
  EditionTokensSchema,
  PluralLabelSchema,
  PluralSchema,
  SplashDecorSchema,
  type ColorTokens,
} from '@slovo/contracts';
import {
  EDITIONS_DIR,
  listEditions,
  openEdition,
  type EditionJsonFile,
} from '@slovo/language-pack/edition';
import { coreTokens } from '@slovo/ui/tokens';
import { describe, expect, it } from 'vitest';

const editions = listEditions(EDITIONS_DIR);
const pathOf = (edition: string, file: EditionJsonFile) =>
  openEdition(EDITIONS_DIR, edition).path(file);

/** A JSON file of an Edition, parsed and not yet checked. */
function readJson(edition: string, file: EditionJsonFile): unknown {
  return JSON.parse(readFileSync(pathOf(edition, file), 'utf8'));
}

/** Whether an Edition brings a file it may leave out. */
const has = (edition: string, file: EditionJsonFile) => existsSync(pathOf(edition, file));

// The Language Pack build reads neither the UI strings nor the design tokens,
// so the shell checks them here.
describe('Edition UI strings', () => {
  it.each(editions)('the %s Edition has every UI string the shell needs', (edition) => {
    expect(EditionStringsSchema.safeParse(readJson(edition, 'strings')).error).toBeUndefined();
  });
});

describe('the 0.4 UI strings groups', () => {
  const groups = ['stats', 'onboarding', 'notifications', 'notificationBody'] as const;
  const strings = readJson('uk', 'strings') as Record<string, unknown>;

  it.each(groups)('the Ukrainian Edition needs the %s group', (group) => {
    const without = Object.fromEntries(Object.entries(strings).filter(([key]) => key !== group));

    const result = EditionStringsSchema.safeParse(without);

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(group);
  });

  it('gives every count the plural forms Ukrainian has', () => {
    const categories = new Intl.PluralRules('uk-UA').resolvedOptions().pluralCategories;
    const counts = [
      ...pluralsOf(strings['stats']),
      ...pluralsOf(strings['onboarding']),
      ...pluralsOf(strings['notifications']),
    ];

    expect(counts.length).toBeGreaterThan(0);
    for (const forms of counts) expect(Object.keys(forms).sort()).toEqual([...categories].sort());
  });
});

describe('the 0.5 UI strings group', () => {
  const strings = readJson('uk', 'strings') as Record<string, unknown>;

  it('the Ukrainian Edition needs the game group', () => {
    const without = Object.fromEntries(Object.entries(strings).filter(([key]) => key !== 'game'));

    const result = EditionStringsSchema.safeParse(without);

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('game');
  });

  /** The strings group without the key. */
  const without = (group: unknown, key: string) =>
    Object.fromEntries(
      Object.entries(group as Record<string, unknown>).filter(([name]) => name !== key),
    );
  const game = strings['game'] as Record<string, unknown>;

  it.each([
    ['game.best', { ...strings, game: without(game, 'best') }],
    [
      'game.result.best',
      { ...strings, game: { ...game, result: without(game['result'], 'best') } },
    ],
    ['stats.gameBest', { ...strings, stats: without(strings['stats'], 'gameBest') }],
    ['stats.gameBestLabel', { ...strings, stats: without(strings['stats'], 'gameBestLabel') }],
  ])('the Ukrainian Edition needs %s, the best result', (path, stringsWithout) => {
    const result = EditionStringsSchema.safeParse(stringsWithout);

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(path);
  });

  it('needs the Rounds of a Game in every form of the best result on the mode screen', () => {
    const best = { ...(game['best'] as object), few: 'Найкраще — {count}.' };

    const result = EditionStringsSchema.safeParse({ ...strings, game: { ...game, best } });

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['game.best.few']);
  });

  it('gives every count and label of the Game the plural forms Ukrainian has', () => {
    const categories = new Intl.PluralRules('uk-UA').resolvedOptions().pluralCategories;
    const counts = [...pluralsOf(strings['game']), ...pluralsOf(strings['stats'])];

    expect(counts.length).toBeGreaterThan(0);
    for (const forms of counts) expect(Object.keys(forms).sort()).toEqual([...categories].sort());
  });
});

describe('the 0.6 widget strings group', () => {
  const strings = readJson('uk', 'strings') as Record<string, unknown>;
  const widget = strings['widget'] as { guide: Record<string, unknown> };

  it('the Ukrainian Edition needs the widget group', () => {
    const without = Object.fromEntries(Object.entries(strings).filter(([key]) => key !== 'widget'));

    const result = EditionStringsSchema.safeParse(without);

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('widget');
  });

  it.each([
    'galleryName',
    'galleryDescription',
    'allEntries',
    'favorites',
    'collection',
    'modeTitle',
    'modeFavorites',
    'modeCollection',
    'modeAllEntries',
    'collectionTitle',
    'openApp',
    'noFavorites',
    'emptyCollection',
    'deletedCollection',
    'noCollection',
    'guide',
  ])('the Ukrainian Edition needs widget.%s', (key) => {
    const changed = Object.fromEntries(Object.entries(widget).filter(([name]) => name !== key));

    const result = EditionStringsSchema.safeParse({ ...strings, widget: changed });

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual([`widget.${key}`]);
  });

  it("needs the Collection's name in the overline of a Collection", () => {
    const result = EditionStringsSchema.safeParse({
      ...strings,
      widget: { ...widget, collection: 'КОЛЕКЦІЯ' },
    });

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual([
      'widget.collection',
    ]);
  });

  it('needs the three steps of the widget guide, each with its hint', () => {
    const steps = widget.guide['steps'] as { title: string; hint: string }[];
    const withTwoSteps = {
      ...strings,
      widget: { guide: { ...widget.guide, steps: steps.slice(0, 2) } },
    };

    const result = EditionStringsSchema.safeParse(withTwoSteps);

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(
      'widget.guide.steps',
    );
  });
});

describe('the 0.8 Sync strings', () => {
  const strings = readJson('uk', 'strings') as Record<string, unknown>;
  const account = strings['account'] as Record<string, unknown>;
  const sync = account['sync'] as Record<string, unknown>;
  const onboarding = strings['onboarding'] as Record<string, unknown>;
  const onboardingAccount = onboarding['account'] as Record<string, unknown>;
  /** The strings schema's issues as paths. */
  const issuesOf = (changed: unknown) =>
    EditionStringsSchema.safeParse(changed).error?.issues.map((issue) => issue.path.join('.'));
  /** The group without the key. */
  const without = (group: Record<string, unknown>, key: string) =>
    Object.fromEntries(Object.entries(group).filter(([name]) => name !== key));

  it('the Ukrainian Edition needs the sync group of the SLOVO ID screen', () => {
    expect(issuesOf({ ...strings, account: without(account, 'sync') })).toEqual(['account.sync']);
  });

  it.each(['syncing', 'waitingForNetwork', 'syncedToday', 'syncedOn', 'syncedOnInYear', 'months'])(
    'the Ukrainian Edition needs account.sync.%s',
    (key) => {
      const changed = { ...strings, account: { ...account, sync: without(sync, key) } };

      expect(issuesOf(changed)).toEqual([`account.sync.${key}`]);
    },
  );

  it.each([
    ['syncedToday', '{time}'],
    ['syncedOn', '{day}'],
    ['syncedOn', '{month}'],
    ['syncedOnInYear', '{year}'],
  ])('needs %s to say where %s goes', (key, placeholder) => {
    const text = (sync[key] as string).replace(placeholder, '');
    const changed = { ...strings, account: { ...account, sync: { ...sync, [key]: text } } };

    expect(issuesOf(changed)).toEqual([`account.sync.${key}`]);
  });

  it('needs the twelve month names of the status line', () => {
    const months = (sync['months'] as string[]).slice(0, 11);
    const changed = { ...strings, account: { ...account, sync: { ...sync, months } } };

    expect(issuesOf(changed)).toEqual(['account.sync.months']);
  });

  it("the Ukrainian Edition needs the onboarding's SLOVO ID step", () => {
    const changed = { ...strings, onboarding: without(onboarding, 'account') };

    expect(issuesOf(changed)).toEqual(['onboarding.account']);
  });

  it.each(['title', 'subtitle', 'signIn', 'continueWithout'])(
    'the Ukrainian Edition needs onboarding.account.%s',
    (key) => {
      const changed = {
        ...strings,
        onboarding: { ...onboarding, account: without(onboardingAccount, key) },
      };

      expect(issuesOf(changed)).toEqual([`onboarding.account.${key}`]);
    },
  );

  it.each(['subtitle', 'signIn'])('needs onboarding.account.%s to name the Account', (key) => {
    const text = (onboardingAccount[key] as string).replace('{name}', 'SLOVO ID');
    const changed = {
      ...strings,
      onboarding: { ...onboarding, account: { ...onboardingAccount, [key]: text } },
    };

    expect(issuesOf(changed)).toEqual([`onboarding.account.${key}`]);
  });
});

describe('the strings of each Game Mode', () => {
  const strings = readJson('uk', 'strings') as Record<string, unknown>;
  const game = strings['game'] as Record<string, unknown>;
  const modes = game['modes'] as Record<string, Record<string, unknown>>;
  /** The strings with the Game's mode texts changed. */
  const withModes = (changed: Record<string, unknown>) => ({
    ...strings,
    game: { ...game, modes: { ...modes, ...changed } },
  });
  /** The issues the strings schema finds, as paths. */
  const issuesOf = (changed: unknown) =>
    EditionStringsSchema.safeParse(changed).error?.issues.map((issue) => issue.path.join('.'));

  it('the Ukrainian Edition holds one entry per Core Game Mode, under its id', () => {
    expect(Object.keys(modes)).toEqual(['guess-word', 'correction']);
  });

  it.each(['guess-word', 'correction'])(
    'needs the %s mode to say what its card says with too few eligible Entries',
    (modeId) => {
      const mode = modes[modeId] ?? {};
      const refusals = Object.fromEntries(
        Object.entries(mode['refusals'] as object).filter(([key]) => key !== 'too-few-entries'),
      );

      expect(issuesOf(withModes({ [modeId]: { ...mode, refusals } }))).toEqual([
        `game.modes.${modeId}.refusals.too-few-entries`,
      ]);
    },
  );

  it.each(['overline', 'title', 'description', 'sample', 'roundLabel', 'refusals'])(
    'needs every mode alike to have its %s',
    (key) => {
      const changed = Object.fromEntries(
        Object.entries(modes).map(([modeId, mode]) => [
          modeId,
          Object.fromEntries(Object.entries(mode).filter(([name]) => name !== key)),
        ]),
      );

      expect(issuesOf(withModes(changed))).toEqual(
        Object.keys(modes).map((modeId) => `game.modes.${modeId}.${key}`),
      );
    },
  );

  it('takes a mode an Edition adds under its own id, in the same shape', () => {
    expect(issuesOf(withModes({ 'test-lemma': modes['guess-word'] }))).toBeUndefined();
  });

  it('rejects a text for a refusal the Core never gives', () => {
    const mode = modes['guess-word'] ?? {};
    const refusals = { ...(mode['refusals'] as object), 'too-hard': 'Заважко.' };

    expect(issuesOf(withModes({ 'guess-word': { ...mode, refusals } }))).toEqual([
      'game.modes.guess-word.refusals',
    ]);
  });

  it('rejects a mode text outside the modes', () => {
    expect(issuesOf({ ...strings, game: { ...game, tooFewEntries: 'Замало слів.' } })).toEqual([
      'game',
    ]);
  });
});

describe('the 0.6 share strings group', () => {
  const strings = readJson('uk', 'strings') as Record<string, unknown>;
  const share = strings['share'] as Record<string, unknown>;
  /** The issues the strings schema finds, as paths. */
  const issuesOf = (changed: unknown) =>
    EditionStringsSchema.safeParse(changed).error?.issues.map((issue) => issue.path.join('.'));

  it('the Ukrainian Edition needs the share group', () => {
    const without = Object.fromEntries(Object.entries(strings).filter(([key]) => key !== 'share'));

    expect(issuesOf(without)).toContain('share');
  });

  it.each([
    'button',
    'title',
    'format',
    'story',
    'square',
    'share',
    'wordOfTheDay',
    'nonStandard',
    'standard',
    'captureFailed',
  ])('the Ukrainian Edition needs share.%s', (key) => {
    const shareWithout = Object.fromEntries(Object.entries(share).filter(([name]) => name !== key));

    expect(issuesOf({ ...strings, share: shareWithout })).toEqual([`share.${key}`]);
  });
});

describe('the 0.7 account and email strings groups', () => {
  const strings = readJson('uk', 'strings') as Record<string, unknown>;
  const account = strings['account'] as Record<string, unknown>;
  const email = strings['email'] as Record<string, unknown>;
  /** The issues the strings schema finds, as paths. */
  const issuesOf = (changed: unknown) =>
    EditionStringsSchema.safeParse(changed).error?.issues.map((issue) => issue.path.join('.'));
  /** The group without the key. */
  const without = (group: unknown, key: string) =>
    Object.fromEntries(
      Object.entries(group as Record<string, unknown>).filter(([name]) => name !== key),
    );

  it.each(['account', 'email'])('the Ukrainian Edition needs the %s group', (group) => {
    expect(issuesOf(without(strings, group))).toEqual([group]);
  });

  it.each([
    'signedOut',
    'emailLabel',
    'sendCode',
    'codeLabel',
    'resend',
    'resendIn',
    'changeEmail',
    'signedInAs',
    'signOut',
    'signOutEverywhere',
    'delete',
    'problems',
  ])('the Ukrainian Edition needs account.%s', (key) => {
    expect(issuesOf({ ...strings, account: without(account, key) })).toEqual([`account.${key}`]);
  });

  it.each(['button', 'title', 'message', 'confirm', 'cancel'])(
    'needs account.delete.%s, the confirmation of deleting the Account',
    (key) => {
      const deletion = account['delete'];

      expect(
        issuesOf({ ...strings, account: { ...account, delete: without(deletion, key) } }),
      ).toEqual([`account.delete.${key}`]);
    },
  );

  it.each([
    'offline',
    'invalid-email',
    'wrong-code',
    'code-expired',
    'too-many-requests',
    'unexpected',
  ])('needs a line for the problem %s', (problem) => {
    const problems = without(account['problems'], problem);

    expect(issuesOf({ ...strings, account: { ...account, problems } })).toEqual([
      `account.problems.${problem}`,
    ]);
  });

  it('rejects a line for a problem the Core never gives', () => {
    const problems = { ...(account['problems'] as object), 'too-hard': 'Заважко.' };

    expect(issuesOf({ ...strings, account: { ...account, problems } })).toEqual([
      'account.problems',
    ]);
  });

  it('needs the tries left in every form of the wrong-code line', () => {
    const problems = {
      ...(account['problems'] as object),
      'wrong-code': { one: 'Невірний код.', other: 'Невірний код. Спроб: {count}.' },
    };

    expect(issuesOf({ ...strings, account: { ...account, problems } })).toEqual([
      'account.problems.wrong-code.one',
    ]);
  });

  it('needs the name SLOVO ID, which every Edition shares, in the words to delete it', () => {
    const deletion = { ...(account['delete'] as object), button: 'Видалити акаунт' };

    expect(issuesOf({ ...strings, account: { ...account, delete: deletion } })).toEqual([
      'account.delete.button',
    ]);
  });

  it.each(['subject', 'body'])('needs email.%s, with the {code} placeholder', (key) => {
    expect(issuesOf({ ...strings, email: without(email, key) })).toEqual([`email.${key}`]);
    expect(issuesOf({ ...strings, email: { ...email, [key]: 'Ваш код' } })).toEqual([
      `email.${key}`,
    ]);
  });

  it('needs the subject of the email to be one line, since it becomes a mail header', () => {
    expect(issuesOf({ ...strings, email: { ...email, subject: 'Код {code}\nBcc: x@y' } })).toEqual([
      'email.subject',
    ]);
  });

  it('rejects a text that neither group has', () => {
    expect(issuesOf({ ...strings, email: { ...email, footer: 'Дякуємо.' } })).toEqual(['email']);
  });

  it('gives every count of the Account the plural forms Ukrainian has', () => {
    const categories = new Intl.PluralRules('uk-UA').resolvedOptions().pluralCategories;
    const counts = pluralsOf(account);

    expect(counts.length).toBeGreaterThan(0);
    for (const forms of counts) expect(Object.keys(forms).sort()).toEqual([...categories].sort());
  });
});

/** Every plural-forms object (one with an `other` form) in a strings group. */
function pluralsOf(value: unknown): Record<string, string>[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return 'other' in record
    ? [record as Record<string, string>]
    : Object.values(record).flatMap(pluralsOf);
}

describe('plural forms of a count', () => {
  it('takes the forms a language has, each with the count in it', () => {
    expect(
      PluralSchema.safeParse({
        one: '{count} запис',
        few: '{count} записи',
        other: '{count} записів',
      }).success,
    ).toBe(true);
  });

  it.each([
    ['a form without the count', { one: 'один запис', other: '{count} записів' }],
    ['no `other` form', { one: '{count} запис', many: '{count} записів' }],
    ['a form that is not a CLDR category', { single: '{count} запис', other: '{count} записів' }],
  ])('rejects %s', (_, forms) => {
    expect(PluralSchema.safeParse(forms).success).toBe(false);
  });
});

describe('plural forms of a label beside its number', () => {
  it('takes the forms a language has, none with the count in it', () => {
    expect(
      PluralLabelSchema.safeParse({
        one: 'день поспіль',
        few: 'дні поспіль',
        other: 'днів поспіль',
      }).success,
    ).toBe(true);
  });

  it.each([
    ['no `other` form', { one: 'день поспіль', many: 'днів поспіль' }],
    ['a form that is not a CLDR category', { single: 'день поспіль', other: 'днів поспіль' }],
    ['an empty form', { one: '', other: 'днів поспіль' }],
    ['a form with the count in it', { one: '{count} день поспіль', other: 'днів поспіль' }],
  ])('rejects %s', (_, forms) => {
    expect(PluralLabelSchema.safeParse(forms).success).toBe(false);
  });
});

describe('Edition design tokens', () => {
  it.each(editions.filter((edition) => has(edition, 'tokens')))(
    'the %s Edition supplies valid design tokens',
    (edition) => {
      expect(EditionTokensSchema.safeParse(readJson(edition, 'tokens')).error).toBeUndefined();
    },
  );

  it.each(['light', 'dark'] as const)(
    'needs the colour of a wrong answer in %s, from 0.5',
    (scheme) => {
      const tokens = EditionTokensSchema.parse(readJson('uk', 'tokens'));
      const withoutWrong = Object.fromEntries(
        Object.entries(tokens.colors?.[scheme] ?? {}).filter(([role]) => role !== 'wrong'),
      );

      const result = EditionTokensSchema.safeParse({
        ...tokens,
        colors: { ...tokens.colors, [scheme]: withoutWrong },
      });

      expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual([
        `colors.${scheme}.wrong`,
      ]);
    },
  );

  it('the Ukrainian Edition supplies its own colours, type families and radii', () => {
    const tokens = EditionTokensSchema.parse(readJson('uk', 'tokens'));

    expect(Object.keys(tokens).sort()).toEqual(['colors', 'fontFamilies', 'radii']);
  });

  it.each([
    ['a colour that is not #RRGGBB or rgba()', { colors: { light: { ink: 'red' } } }],
    ['a missing colour in a scheme', { colors: { light: {}, dark: {} } }],
    ['a negative radius', { radii: { card: -1, chip: 2, button: 4, sheet: 22 } }],
    ['an unknown token group', { shadows: {} }],
  ])('rejects %s', (_, tokens) => {
    expect(EditionTokensSchema.safeParse(tokens).success).toBe(false);
  });
});

describe('Edition Decor', () => {
  const withDecor = editions.filter((edition) => has(edition, 'decor'));

  it.each(withDecor)('the %s Edition supplies valid Decor', (edition) => {
    expect(EditionDecorSchema.safeParse(readJson(edition, 'decor')).error).toBeUndefined();
  });

  it('the Ukrainian Edition fills every Decor slot the Feed, the Game result, the splash and the Share Cards use', () => {
    const decor = EditionDecorSchema.parse(readJson('uk', 'decor'));

    expect(Object.keys(decor).sort()).toEqual([
      'background',
      'corners',
      'divider',
      'emptyState',
      'shareCard',
      'splash',
      'victory',
    ]);
    expect(decor.emptyState?.error).toBeDefined();
    expect(decor.splash?.band).toBeDefined();
  });

  it.each(editions.filter((edition) => has(edition, 'tokens') && has(edition, 'splash')))(
    'the %s Edition has a native splash on its own background colour in both Themes',
    (edition) => {
      const { colors } = EditionTokensSchema.parse(readJson(edition, 'tokens'));
      const splash = SplashDecorSchema.parse(readJson(edition, 'splash'));

      expect(splash.light.backgroundColor).toBe(colors?.light.background);
      expect(splash.dark.backgroundColor).toBe(colors?.dark.background);
    },
  );

  /** The text colour roles drawn straight on the screen background. */
  const textRoles = ['ink', 'muted', 'inkSecondary', 'accent'] as const;

  describe.each(withDecor.filter((edition) => has(edition, 'tokens')))(
    'the %s Edition',
    (edition) => {
      const { colors } = EditionTokensSchema.parse(readJson(edition, 'tokens'));
      const { background } = EditionDecorSchema.parse(readJson(edition, 'decor'));

      it.each(['light', 'dark'] as const)(
        'keeps text at WCAG AA contrast over its background Decor in %s',
        (scheme) => {
          if (colors === undefined || background === undefined) return;
          const screen = colors[scheme].background;
          const stitched = background.tile.layers.map((layer) => over(layer[scheme], screen));

          for (const role of textRoles) {
            const text = colors[scheme][role satisfies keyof ColorTokens];
            for (const behind of [parseColor(screen), ...stitched]) {
              expect(
                contrast(parseColor(text), behind),
                `${role} over ${String(behind)}`,
              ).toBeGreaterThanOrEqual(4.5);
            }
          }
        },
      );
    },
  );
});

/**
 * Every pair of a text colour and the colour it is drawn on in the 0.2
 * screens: the Feed, its cards and states, Settings and the tab bar.
 */
const textPairs: readonly (readonly [text: keyof ColorTokens, behind: keyof ColorTokens])[] = [
  // Screen titles, the end-of-Cycle and error states, the loading line, the tab bar.
  ['ink', 'background'],
  ['muted', 'background'],
  ['accent', 'background'],
  ['inactiveTab', 'background'],
  // The Word card and the Correction card.
  ['ink', 'surface'],
  ['muted', 'surface'],
  ['inkSecondary', 'surface'],
  ['accent', 'surface'],
  // The Category chip and the Correction's example pair.
  ['ink', 'surfaceSunken'],
  ['muted', 'surfaceSunken'],
  // The segmented control.
  ['ink', 'track'],
  // Inverted: the Word of the Day badge, the error button, the swipe hint.
  ['background', 'accent'],
  ['background', 'ink'],
  // The Pronunciation message on ink, and the speaker while it plays on accent.
  ['surface', 'ink'],
  ['surface', 'accent'],
];

/** The Core's colours and those of every Edition that supplies its own. */
const tokenSets = [
  ['the Core', coreTokens.colors] as const,
  ...editions
    .filter((edition) => has(edition, 'tokens'))
    .flatMap((edition) => {
      const { colors } = EditionTokensSchema.parse(readJson(edition, 'tokens'));
      return colors === undefined ? [] : [[`the ${edition} Edition`, colors] as const];
    }),
];

/** The other colour scheme, whose colours an inverted card draws its content in. */
const otherScheme = { light: 'dark', dark: 'light' } as const;

describe('WCAG AA contrast of the 0.2 screens', () => {
  describe.each(tokenSets)('%s', (_, colors) => {
    it.each(['light', 'dark'] as const)('keeps every text at 4.5:1 or more in %s', (scheme) => {
      for (const [text, behind] of textPairs) {
        expect(
          contrast(parseColor(colors[scheme][text]), parseColor(colors[scheme][behind])),
          `${text} on ${behind}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});

describe('WCAG AA contrast of the 0.3 Favorites screens', () => {
  describe.each(tokenSets)('%s', (_, colors) => {
    it.each(['light', 'dark'] as const)(
      'keeps the Favorites card, drawn in the other scheme on the ink fill, at 4.5:1 or more in %s',
      (scheme) => {
        const fill = parseColor(colors[scheme].ink);
        for (const text of ['ink', 'muted', 'inkSecondary', 'accent'] as const) {
          expect(
            contrast(parseColor(colors[otherScheme[scheme]][text]), fill),
            `the other scheme's ${text} on ink`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      },
    );

    it.each(['light', 'dark'] as const)(
      'keeps white on the destructive action at 4.5:1 and the filled heart at 3:1 in %s',
      (scheme) => {
        const { destructive, heart, background, surface } = colors[scheme];
        expect(contrast([255, 255, 255], parseColor(destructive))).toBeGreaterThanOrEqual(4.5);
        // The heart is a graphic, which needs 3:1 against what it sits on (WCAG 1.4.11).
        for (const behind of [background, surface]) {
          expect(contrast(parseColor(heart), parseColor(behind))).toBeGreaterThanOrEqual(3);
        }
      },
    );
  });
});

describe('WCAG AA contrast of the 0.5 Game screens', () => {
  describe.each(tokenSets)('%s', (_, colors) => {
    it('keeps white on the right and the wrong option, filled in the light colours, at 4.5:1 or more', () => {
      for (const fill of [colors.light.correct, colors.light.wrong]) {
        expect(contrast([255, 255, 255], parseColor(fill)), fill).toBeGreaterThanOrEqual(4.5);
      }
    });

    it.each(['light', 'dark'] as const)(
      "keeps the answer sheet's title, drawn in the other scheme on its surface, at 4.5:1 or more in %s",
      (scheme) => {
        const { surface, correct, wrong } = colors[otherScheme[scheme]];
        for (const title of [correct, wrong]) {
          expect(contrast(parseColor(title), parseColor(surface)), title).toBeGreaterThanOrEqual(
            4.5,
          );
        }
      },
    );
  });
});

type Rgb = readonly [number, number, number];

/** `#RRGGBB` or `rgba(r, g, b, a)` as red, green, blue and alpha. */
function parseRgba(color: string): readonly [number, number, number, number] {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (hex !== null) {
    const [, r = '', g = '', b = ''] = hex;
    return [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16), 1];
  }
  const [r = 0, g = 0, b = 0, a = 1] = (/\(([^)]*)\)/.exec(color)?.[1] ?? '')
    .split(',')
    .map(Number);
  return [r, g, b, a];
}

function parseColor(color: string): Rgb {
  const [r, g, b] = parseRgba(color);
  return [r, g, b];
}

/** A colour drawn over an opaque one. */
function over(color: string, behind: string): Rgb {
  const [r, g, b, a] = parseRgba(color);
  const [br, bg, bb] = parseColor(behind);
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
}

/** The WCAG 2 contrast ratio of two opaque colours. */
function contrast(first: Rgb, second: Rgb): number {
  const luminance = (rgb: Rgb) => {
    const [r = 0, g = 0, b = 0] = rgb.map((channel) => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}
