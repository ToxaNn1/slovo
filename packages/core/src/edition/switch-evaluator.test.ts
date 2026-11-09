import { FeatureSwitchesSchema, type FeatureSwitchState } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { evaluateSwitches, type RemoteRule, type SwitchFacts } from '../index';

/** The Edition's states: every Feature Switch on but those given. */
const statesWith = (states: Partial<Record<string, FeatureSwitchState>> = {}) =>
  FeatureSwitchesSchema.parse(
    Object.fromEntries(
      FeatureSwitchesSchema.keyof().options.map((feature) => [feature, states[feature] ?? 'on']),
    ),
  );

const fixedClock = (iso: string) => ({ now: () => new Date(iso), timeZone: () => 'Europe/Kyiv' });

const facts = (changes: Partial<SwitchFacts> = {}): SwitchFacts => ({
  appVersion: '1.2.0',
  platform: 'ios',
  region: 'UA',
  signedIn: false,
  installId: 'install-1',
  clock: fixedClock('2026-11-08T12:00:00Z'),
  clockOffsetMs: 0,
  ...changes,
});

const rule = (changes: Partial<RemoteRule> & Pick<RemoteRule, 'feature'>): RemoteRule => ({
  id: `${changes.feature}-rule`,
  verdict: 'off',
  targets: {},
  ...changes,
});

const evaluate = (
  rules: readonly RemoteRule[],
  states = statesWith(),
  theFacts: SwitchFacts = facts(),
) => evaluateSwitches({ rules, states, facts: theFacts });

describe('the switch evaluator', () => {
  it('gives the Edition’s state when no Rule matches', () => {
    const verdicts = evaluate(
      [rule({ feature: 'game', targets: { platform: 'android' } })],
      statesWith({ corrections: 'off' }),
    );

    expect(verdicts.game).toEqual({ on: true });
    expect(verdicts.corrections).toEqual({ on: false });
  });

  it('lets the first matching Rule decide', () => {
    const verdicts = evaluate([
      rule({ id: 'a', feature: 'game', verdict: 'off', targets: { platform: 'android' } }),
      rule({ id: 'b', feature: 'game', verdict: 'on', targets: { platform: 'ios' } }),
      rule({ id: 'c', feature: 'game', verdict: 'off' }),
    ]);

    expect(verdicts.game).toEqual({ on: true });
  });

  it('never turns an unavailable feature on', () => {
    const verdicts = evaluate(
      [rule({ feature: 'widget', verdict: 'on' })],
      statesWith({ widget: 'unavailable' }),
    );

    expect(verdicts.widget).toEqual({ on: false });
  });

  it('keeps a feature off while one it depends on is off', () => {
    const verdicts = evaluate([
      rule({ feature: 'game', verdict: 'off' }),
      rule({ feature: 'gameTimed', verdict: { variants: ['a', 'b'] } }),
    ]);

    expect(verdicts.game).toEqual({ on: false });
    expect(verdicts.gameTimed).toEqual({ on: false });
  });

  it('matches every target named, and matches everyone with none', () => {
    const rules = [
      rule({
        feature: 'tips',
        verdict: 'off',
        targets: {
          appVersion: { from: '1.0.0', until: '1.2.0' },
          platform: 'ios',
          region: ['UA', 'PL'],
          signedIn: true,
        },
      }),
      rule({ feature: 'search', verdict: 'off' }),
    ];

    expect(evaluate(rules, statesWith(), facts({ signedIn: true })).tips).toEqual({ on: false });
    expect(
      evaluate(rules, statesWith(), facts({ signedIn: true, appVersion: '1.2.1' })).tips,
    ).toEqual({ on: true });
    expect(evaluate(rules, statesWith(), facts({ signedIn: true, region: 'DE' })).tips).toEqual({
      on: true,
    });
    expect(
      evaluate(rules, statesWith(), facts({ signedIn: true, region: undefined })).tips,
    ).toEqual({ on: true });
    expect(evaluate(rules).tips).toEqual({ on: true });
    expect(evaluate(rules).search).toEqual({ on: false });
  });

  it('compares app versions by number, not by text', () => {
    const rules = [rule({ feature: 'tips', targets: { appVersion: { from: '1.10.0' } } })];

    expect(evaluate(rules, statesWith(), facts({ appVersion: '1.9.0' })).tips).toEqual({
      on: true,
    });
    expect(evaluate(rules, statesWith(), facts({ appVersion: '1.10.0' })).tips).toEqual({
      on: false,
    });
  });

  it('gives one Install id the same share verdict at 10 % and at 30 %', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `install-${String(i)}`);
    const at = (share: number, installId: string) =>
      evaluate(
        [rule({ id: 'rollout', feature: 'tips', verdict: 'off', targets: { share } })],
        statesWith(),
        facts({ installId }),
      ).tips.on;

    const inAt10 = ids.filter((id) => !at(10, id));
    const inAt30 = ids.filter((id) => !at(30, id));

    expect(inAt10.length).toBeGreaterThan(0);
    expect(inAt30.length).toBeGreaterThan(inAt10.length);
    expect(inAt10.every((id) => inAt30.includes(id))).toBe(true);
    expect(ids.filter((id) => !at(0, id))).toEqual([]);
    expect(ids.filter((id) => at(100, id))).toEqual([]);
  });

  it('holds on the device’s clock corrected by the backend’s', () => {
    const rules = [
      rule({
        feature: 'tips',
        targets: { schedule: { from: '2026-11-08T13:00:00Z', until: '2026-11-08T14:00:00Z' } },
      }),
    ];

    expect(evaluate(rules).tips).toEqual({ on: true });
    expect(evaluate(rules, statesWith(), facts({ clockOffsetMs: 60 * 60 * 1000 })).tips).toEqual({
      on: false,
    });
    expect(
      evaluate(rules, statesWith(), facts({ clock: fixedClock('2026-11-08T14:00:01Z') })).tips,
    ).toEqual({ on: true });
  });

  it('skips only the Rule with a target, verdict or feature it doesn’t know', () => {
    const verdicts = evaluate([
      rule({ id: 'a', feature: 'tips', verdict: 'off', targets: { browser: 'safari' } }),
      rule({ id: 'b', feature: 'tips', verdict: 'off', targets: { share: 'half' } }),
      rule({ id: 'c', feature: 'tips', verdict: 'dimmed' }),
      rule({ id: 'd', feature: 'teleport', verdict: 'off' }),
      rule({ id: 'e', feature: 'search', verdict: 'off' }),
    ]);

    expect(verdicts.tips).toEqual({ on: true });
    expect(verdicts.search).toEqual({ on: false });
  });

  it('gives one Install id the same Variant each time, and spreads the Variants', () => {
    const rules = [rule({ id: 'test', feature: 'tips', verdict: { variants: ['a', 'b', 'c'] } })];
    const variantOf = (installId: string) =>
      evaluate(rules, statesWith(), facts({ installId })).tips;
    const variants = Array.from({ length: 60 }, (_, i) => variantOf(`install-${String(i)}`));

    expect(variantOf('install-7')).toEqual(variantOf('install-7'));
    expect(variantOf('install-7').on).toBe(true);
    expect(new Set(variants.map((verdict) => (verdict.on ? verdict.variant : undefined)))).toEqual(
      new Set(['a', 'b', 'c']),
    );
  });
});
