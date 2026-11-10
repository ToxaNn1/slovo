import { describe, expect, it } from 'vitest';

import { FeatureSwitchesSchema } from './edition';
import { RuleSchema } from './feature-switch-rules';

const rule = {
  id: 'r_1',
  editionId: 'uk',
  feature: 'game',
  order: 0,
  verdict: 'on',
  targets: {},
};

// ADR 0089: a Rule says on, off or a Variant for the readers it targets.
describe('a Rule', () => {
  it('reads every target: app version range, platform, region, share, signed-in state and schedule', () => {
    const parsed = RuleSchema.parse({
      ...rule,
      verdict: { variants: ['a', 'b', 'c'] },
      targets: {
        appVersion: { from: '1.2.0', until: '1.4.0' },
        platform: 'ios',
        region: ['UA', 'PL'],
        share: 30,
        signedIn: false,
        schedule: { from: '2026-11-10T09:00:00.000Z', until: '2026-12-01T00:00:00.000Z' },
      },
    });

    expect(parsed.verdict).toEqual({ variants: ['a', 'b', 'c'] });
    expect(parsed.targets.share).toBe(30);
  });

  it.each([
    ['one Variant', { verdict: { variants: ['a'] } }],
    ['four Variants', { verdict: { variants: ['a', 'b', 'c', 'd'] } }],
    ['the same Variant twice', { verdict: { variants: ['a', 'a'] } }],
    ['a verdict that is no state', { verdict: 'maybe' }],
    ['a share over 100', { targets: { share: 101 } }],
    ['a share of a part of a reader', { targets: { share: 12.5 } }],
    ['a platform the app has no build for', { targets: { platform: 'web' } }],
    ['a region that is no country code', { targets: { region: ['Ukraine'] } }],
    ['an app version that is no version', { targets: { appVersion: { from: 'latest' } } }],
    ['a schedule that is no moment', { targets: { schedule: { from: 'tomorrow' } } }],
    ['a target it does not know', { targets: { weather: 'sunny' } }],
    ['an order below zero', { order: -1 }],
  ])('refuses %s', (_name, change) => {
    expect(RuleSchema.safeParse({ ...rule, ...change }).success).toBe(false);
  });
});

// ADR 0089: the Edition declares each feature on, off or unavailable.
describe('the Feature Switches of an Edition', () => {
  const every = Object.fromEntries(Object.keys(FeatureSwitchesSchema.shape).map((f) => [f, 'on']));

  it('reads the three states', () => {
    const parsed = FeatureSwitchesSchema.parse({
      ...every,
      game: 'off',
      narratorVoice: 'unavailable',
    });

    expect(parsed.game).toBe('off');
    expect(parsed.narratorVoice).toBe('unavailable');
    expect(parsed.corrections).toBe('on');
  });

  it.each([
    ['a boolean, the shape before ADR 0089', { game: true }],
    ['a state it does not know', { game: 'maybe' }],
    ['a feature it does not know', { teleport: 'on' }],
  ])('refuses %s', (_name, change) => {
    expect(FeatureSwitchesSchema.safeParse({ ...every, ...change }).success).toBe(false);
  });
});
