import { describe, expect, it } from 'vitest';

import { FeatureSwitchesSchema, type FeatureSwitch, type FeatureSwitchState } from './edition';
import { readSwitches, rulesOf, type ReadableRule } from './feature-switch-reader';

/** The Edition's states: every Feature Switch on but those given. */
const statesWith = (states: Partial<Record<FeatureSwitch, FeatureSwitchState>> = {}) =>
  FeatureSwitchesSchema.parse(
    Object.fromEntries(
      FeatureSwitchesSchema.keyof().options.map((feature) => [feature, states[feature] ?? 'on']),
    ),
  );

const now = new Date('2026-11-08T12:00:00Z');
const over = { until: '2026-11-08T11:59:59Z' };
const running = { from: '2026-11-08T12:00:00Z', until: '2026-11-09T00:00:00Z' };

const rule = (
  changes: Partial<ReadableRule> & Pick<ReadableRule, 'feature'>,
): ReadableRule & { readonly order: number } => ({
  id: `${changes.feature}-rule`,
  order: 0,
  verdict: 'off',
  targets: {},
  ...changes,
});

const read = (
  rules: readonly ReadableRule[],
  states: Partial<Record<FeatureSwitch, FeatureSwitchState>> = {},
) => readSwitches({ states: statesWith(states), rules, now });

/** The three answers of one feature: for any reader, for the rest, and for a reader every Rule targets. */
const answers = (
  rules: readonly ReadableRule[],
  feature: FeatureSwitch,
  states: Partial<Record<FeatureSwitch, FeatureSwitchState>> = {},
) => {
  const switches = read(rules, states);
  return {
    anyone: switches.onForAnyone(feature),
    rest: switches.forTheRest(feature).on,
    targeted: switches.forReader(() => true)(feature).on,
  };
};

// ADR 0089: the backend holds a feature on while it is on for anyone, the
// admin shows what the readers no Rule singles out get, and the device what
// its reader gets. One table, so the three cannot disagree on the same Rules.
describe('the Rules of a Feature Switch, read for anyone, for the rest and for one reader', () => {
  it.each<
    [
      string,
      {
        rules: readonly ReadableRule[];
        states?: Partial<Record<FeatureSwitch, FeatureSwitchState>>;
        feature: FeatureSwitch;
        anyone: boolean;
        rest: boolean;
        targeted: boolean;
      },
    ]
  >([
    [
      'no Rule: the Edition’s state, on',
      { rules: [], feature: 'game', anyone: true, rest: true, targeted: true },
    ],
    [
      'no Rule: the Edition’s state, off',
      {
        rules: [],
        states: { game: 'off' },
        feature: 'game',
        anyone: false,
        rest: false,
        targeted: false,
      },
    ],
    [
      'an unavailable feature is never on, whatever its Rules say',
      {
        rules: [rule({ feature: 'game', verdict: 'on' })],
        states: { game: 'unavailable' },
        feature: 'game',
        anyone: false,
        rest: false,
        targeted: false,
      },
    ],
    [
      'a Rule off for every reader',
      {
        rules: [rule({ feature: 'game' })],
        feature: 'game',
        anyone: false,
        rest: false,
        targeted: false,
      },
    ],
    [
      'a Rule off with a share of 100 is off for every reader',
      {
        rules: [rule({ feature: 'game', targets: { share: 100 } })],
        feature: 'game',
        anyone: false,
        rest: false,
        targeted: false,
      },
    ],
    [
      'a Rule on with a share of 100 is on for every reader',
      {
        rules: [rule({ feature: 'game', verdict: 'on', targets: { share: 100 } })],
        states: { game: 'off' },
        feature: 'game',
        anyone: true,
        rest: true,
        targeted: true,
      },
    ],
    [
      'a Rule off for some readers leaves the rest at the Edition’s state',
      {
        rules: [rule({ feature: 'game', targets: { platform: 'ios' } })],
        feature: 'game',
        anyone: true,
        rest: true,
        targeted: false,
      },
    ],
    [
      'a Rule on for some readers of a feature the Edition has off',
      {
        rules: [rule({ feature: 'game', verdict: 'on', targets: { share: 30 } })],
        states: { game: 'off' },
        feature: 'game',
        anyone: true,
        rest: false,
        targeted: true,
      },
    ],
    [
      'a Rule with a share of 0 matches nobody',
      {
        rules: [rule({ feature: 'game', verdict: 'on', targets: { share: 0 } })],
        states: { game: 'off' },
        feature: 'game',
        anyone: false,
        rest: false,
        targeted: false,
      },
    ],
    [
      'a Rule whose schedule is over matches nobody',
      {
        rules: [rule({ feature: 'game', targets: { schedule: over } })],
        feature: 'game',
        anyone: true,
        rest: true,
        targeted: true,
      },
    ],
    [
      'a Rule whose schedule holds, both ends included, and names no other target is for every reader',
      {
        rules: [rule({ feature: 'game', targets: { schedule: running } })],
        feature: 'game',
        anyone: false,
        rest: false,
        targeted: false,
      },
    ],
    [
      'the first Rule by order decides, however the Rules arrive',
      {
        rules: [
          rule({ id: 'second', feature: 'game', order: 1, verdict: 'on' }),
          rule({ id: 'first', feature: 'game', order: 0 }),
        ],
        feature: 'game',
        anyone: false,
        rest: false,
        targeted: false,
      },
    ],
    [
      'a Rule after one for every reader is never tried',
      {
        rules: [
          rule({ id: 'everyone', feature: 'game', order: 0 }),
          rule({ id: 'late', feature: 'game', order: 1, verdict: 'on', targets: { share: 50 } }),
        ],
        feature: 'game',
        anyone: false,
        rest: false,
        targeted: false,
      },
    ],
    [
      'a Rule of another feature decides nothing',
      {
        rules: [rule({ feature: 'mixTab' })],
        feature: 'game',
        anyone: true,
        rest: true,
        targeted: true,
      },
    ],
    [
      'a feature whose dependency is off for every reader is off, with no Rule of its own',
      {
        rules: [rule({ feature: 'xpLog' })],
        feature: 'progressShareCards',
        anyone: false,
        rest: false,
        targeted: false,
      },
    ],
    [
      'the Streak freeze card is off while the Streak freezes are (ADR 0199)',
      {
        rules: [rule({ feature: 'streakFreezes' })],
        feature: 'streakFreezeCard',
        anyone: false,
        rest: false,
        targeted: false,
      },
    ],
    [
      'a feature whose dependency is off by a share of 100 is off too',
      {
        rules: [rule({ feature: 'xpLog', targets: { share: 100 } })],
        feature: 'progressShareCards',
        anyone: false,
        rest: false,
        targeted: false,
      },
    ],
    [
      'a feature whose dependency is on for some readers only is off for the rest',
      {
        rules: [rule({ feature: 'xpLog', verdict: 'on', targets: { share: 30 } })],
        states: { xpLog: 'off' },
        feature: 'progressShareCards',
        anyone: true,
        rest: false,
        targeted: true,
      },
    ],
  ])('%s', (_name, { rules, states, feature, anyone, rest, targeted }) => {
    expect(answers(rules, feature, states)).toEqual({ anyone, rest, targeted });
  });

  it('is never on for the rest of a feature that is on for nobody, and on for anyone it is on for the rest of', () => {
    const cases = [
      [rule({ feature: 'xpLog', targets: { share: 100 } })],
      [rule({ feature: 'xpLog', verdict: 'on', targets: { share: 30 } })],
      [rule({ feature: 'shareCards', targets: { platform: 'android' } })],
      [rule({ feature: 'progressShareCards', targets: { schedule: running } })],
    ];

    for (const rules of cases) {
      const switches = read(rules);
      for (const feature of FeatureSwitchesSchema.keyof().options) {
        const rest = switches.forTheRest(feature).on;
        expect(rest && !switches.onForAnyone(feature)).toBe(false);
      }
    }
  });
});

describe('the Rule that decides', () => {
  it('names the Rule a reader got the feature on by, and none by the Edition’s state', () => {
    const variants = rule({
      feature: 'game',
      verdict: { variants: ['a', 'b'] },
      targets: { platform: 'ios' },
    });
    const switches = read([variants]);

    expect(switches.forReader(() => true)('game')).toEqual({ on: true, by: variants });
    expect(switches.forTheRest('game')).toEqual({ on: true, by: undefined });
    expect(switches.forTheRest('mixTab')).toEqual({ on: true, by: undefined });
  });

  it('asks the reader only of the Rules that single some readers out', () => {
    const asked: string[] = [];
    const switches = read([
      rule({ id: 'none', feature: 'game', order: 0, targets: { share: 0 } }),
      rule({ id: 'over', feature: 'game', order: 1, targets: { schedule: over } }),
      rule({ id: 'some', feature: 'game', order: 2, targets: { signedIn: true } }),
      rule({ id: 'everyone', feature: 'game', order: 3, targets: { share: 100 } }),
      rule({ id: 'late', feature: 'game', order: 4, targets: { platform: 'ios' } }),
    ]);

    switches.forReader(({ id }) => {
      asked.push(id);
      return false;
    })('game');

    expect(asked).toEqual(['some']);
  });

  it('names the first Rule in force for every reader, the one a switch for everyone replaces', () => {
    const switches = read([
      rule({ id: 'some', feature: 'game', order: 0, targets: { region: ['UA'] } }),
      rule({ id: 'over', feature: 'game', order: 1, targets: { schedule: over } }),
      rule({ id: 'everyone', feature: 'game', order: 2, targets: { share: 100 } }),
      rule({ id: 'late', feature: 'game', order: 3 }),
    ]);

    expect(switches.everyoneRule('game')?.id).toBe('everyone');
    expect(switches.everyoneRule('mixTab')).toBeUndefined();
  });
});

describe('the order Rules are tried in', () => {
  it('is their `order`, and the order they came in where they carry none', () => {
    const { order: _order, ...unordered } = rule({ id: 'b', feature: 'game' });

    expect(
      rulesOf(
        [
          rule({ id: 'third', feature: 'game', order: 2 }),
          rule({ id: 'other', feature: 'mixTab', order: 0 }),
          rule({ id: 'first', feature: 'game', order: 0 }),
          rule({ id: 'second', feature: 'game', order: 1 }),
        ],
        'game',
      ).map(({ id }) => id),
    ).toEqual(['first', 'second', 'third']);
    expect(
      rulesOf(
        [
          { ...unordered, id: 'b' },
          { ...unordered, id: 'a' },
        ],
        'game',
      ).map(({ id }) => id),
    ).toEqual(['b', 'a']);
  });
});
