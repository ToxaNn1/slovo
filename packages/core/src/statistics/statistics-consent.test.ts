import { describe, expect, it } from 'vitest';

import {
  createAnalytics,
  createSettings,
  openComposition,
  openCounterSending,
  statisticsConsentFor,
  type AnalyticsPort,
  type FeatureSwitch,
} from '../index';
import { switchedOn } from '../edition/edition';
import { createFakeBackend, createMemoryContentPort } from '../testing';
import {
  analyticsInto,
  fakeClock,
  randomOf,
  settle,
  testEdition,
  testSchedule,
  word,
} from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const content = createMemoryContentPort({
  words: Array.from({ length: 12 }, (_, index) => word(`w_${String(index)}`)),
});

const ALL_ON: readonly FeatureSwitch[] = [
  'knowledge',
  'wordOfTheDay',
  'questionnaire',
  'analytics',
  'communityCounters',
  'statisticsOffCounter',
  'statisticsConsent',
];

/** Long enough for every try of what the device sends. */
const ALL_TRIES = 10_000;

/**
 * One app run on a phone of `region` and `timeZone` over the records, so the
 * user state survives between runs: the Core composition, the settings and the
 * sending of the Community Counters, with a port and a backend that keep what
 * reached them.
 */
async function run({
  region,
  timeZone = 'Europe/Kyiv',
  records = new Map<string, string>(),
  on = ALL_ON,
}: {
  region: string | undefined;
  timeZone?: string;
  records?: Map<string, string>;
  on?: readonly FeatureSwitch[];
}) {
  const events: unknown[][] = [];
  const port: AnalyticsPort = {
    track: (event, properties) => void events.push([event, properties]),
    stop: () => undefined,
  };
  const api = createFakeBackend();
  const time = fakeClock('2026-11-27T09:00:00.000Z');
  const timers = testSchedule(time);
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  const edition = testEdition({
    isFeatureEnabled: switchedOn((feature) => on.includes(feature)),
  });
  const consent = statisticsConsentFor(edition, { region, timeZone });
  const sink = analyticsInto(port);
  const app = await openComposition({
    content,
    edition,
    userState,
    clock: time.clock,
    random: randomOf(0.25),
    analytics: sink,
    backend: api.backend,
    consent,
  });
  const settings = createSettings({
    userState,
    defaults: edition.userSettingDefaults,
    analytics: createAnalytics({ edition, userState, sink, consent }),
    statisticsOff: { edition, backend: api.backend },
    consent,
  });
  const sending = openCounterSending({
    edition,
    backend: api.backend,
    userState,
    clock: time.clock,
    schedule: timers.schedule,
    random: randomOf(0.5),
    consent,
  });
  return {
    app,
    api,
    events,
    settings,
    /** The reader does what sends statistics: a screen, an answer, a mark, a return to the app. */
    async use() {
      await app.analytics.screenViewed('feed');
      await app.knowledge.tap('w_3', 'known');
      sending.foreground();
      await timers.advance(ALL_TRIES);
      await settle();
    },
    /** Everything that left the device. */
    sent: () => ({
      events: events.map(([event]) => event),
      counters: api.counters.sent.flat().map(({ entryId }) => entryId),
      answers: api.counters.answers.map(({ answer }) => answer),
      switchOffs: api.counters.statisticsOff.length,
    }),
  };
}

const NOTHING = { events: [], counters: [], answers: [], switchOffs: 0 };

/** The step on screen, or nothing once the onboarding is finished. */
const stepOf = ({ app }: Awaited<ReturnType<typeof run>>) =>
  app.onboarding.state.status === 'open' ? app.onboarding.state.step.kind : undefined;

/** Goes through the onboarding from the welcome and gives the kinds of its steps. */
async function steps(device: Awaited<ReturnType<typeof run>>): Promise<string[]> {
  const seen: string[] = [];
  for (let kind = stepOf(device); kind !== undefined; kind = stepOf(device)) {
    seen.push(kind);
    await device.app.onboarding.next();
  }
  return seen;
}

// Ticket #2082; ADR 0210: an EEA reader is asked before anything is sent.
describe('Statistics consent', () => {
  // ADR 0212: the phone's time zone counts as well as its region.
  it('asks a reader whose time zone is in the EEA though the region is outside, and sends nothing before they choose', async () => {
    const reader = await run({ region: 'UA', timeZone: 'Europe/Berlin' });

    await reader.use();
    expect(reader.sent()).toEqual(NOTHING);
    expect((await reader.settings.read()).shareCounters).toBe(false);
    expect(await steps(reader)).toContain('statisticsConsent');
  });

  it('asks by the time zone of every EEA state and of the parts of an EU state far from it', () => {
    const edition = testEdition({ isFeatureEnabled: switchedOn(() => true) });
    for (const timeZone of [
      'Europe/Berlin',
      'Europe/Paris',
      'Europe/Busingen',
      'Europe/Mariehamn',
      'Atlantic/Canary',
      'Africa/Ceuta',
      'Atlantic/Azores',
      'Atlantic/Madeira',
      'Asia/Nicosia',
      'Atlantic/Reykjavik',
      'Europe/Vaduz',
      'Europe/Oslo',
      'America/Cayenne',
      'Indian/Reunion',
    ]) {
      expect(statisticsConsentFor(edition, { region: 'UA', timeZone }).asks(), timeZone).toBe(true);
    }
  });

  it('does not ask by a time zone outside the EEA', () => {
    const edition = testEdition({ isFeatureEnabled: switchedOn(() => true) });
    for (const timeZone of [
      'Europe/Kyiv',
      'Europe/London',
      'Europe/Zurich',
      'Europe/Monaco',
      'Europe/Istanbul',
      'America/New_York',
      'UTC',
    ]) {
      expect(statisticsConsentFor(edition, { region: 'UA', timeZone }).asks(), timeZone).toBe(
        false,
      );
    }
  });

  it('sends nothing of an EEA reader before they choose, and shows the switch off', async () => {
    const reader = await run({ region: 'DE' });

    await reader.app.onboarding.next();
    expect(stepOf(reader)).toBe('statisticsConsent');
    await reader.use();

    expect(reader.sent()).toEqual(NOTHING);
    expect((await reader.settings.read()).shareCounters).toBe(false);
  });

  it('asks the reader of every EEA region, and of the regions of an EU state with a code of their own', async () => {
    for (const region of ['IS', 'LI', 'NO', 'GR', 'IE', 'RE', 'AX']) {
      const reader = await run({ region });
      expect(await steps(reader), region).toContain('statisticsConsent');
    }
  });

  it('treats an unknown region as the EEA', async () => {
    const reader = await run({ region: undefined });

    await reader.app.onboarding.next();
    expect(stepOf(reader)).toBe('statisticsConsent');
    await reader.use();

    expect(reader.sent()).toEqual(NOTHING);
  });

  it('treats a region that is no country code as unknown, so as the EEA (ADR 0210)', async () => {
    for (const region of ['150', '001', '419', '', 'EUR']) {
      const reader = await run({ region });
      expect(await steps(reader), region).toContain('statisticsConsent');
    }
    const outside = await run({ region: 'us' });
    expect(await steps(outside)).not.toContain('statisticsConsent');
  });

  it('turns the switch on when the reader allows, and sends from then on', async () => {
    const reader = await run({ region: 'DE' });
    await reader.app.onboarding.next();

    await reader.app.onboarding.chooseStatistics(true);

    expect(stepOf(reader)).toBe('firstWord');
    expect((await reader.settings.read()).shareCounters).toBe(true);
    await reader.use();
    const { events, counters } = reader.sent();
    expect(events).toContain('screenViewed');
    expect(counters).toEqual(['w_3']);
  });

  it('turns the switch off when the reader does not allow, and sends nothing, the switch-off unit neither', async () => {
    const records = new Map<string, string>();
    const reader = await run({ region: 'DE', records });
    await reader.app.onboarding.next();

    await reader.app.onboarding.chooseStatistics(false);

    expect(stepOf(reader)).toBe('firstWord');
    await reader.use();
    expect(reader.sent()).toEqual(NOTHING);
    expect((await reader.settings.read()).shareCounters).toBe(false);
    // The choice is the switch of «Конфіденційність»: turning it on there sends again.
    await reader.settings.update({ shareCounters: true });
    await reader.use();
    expect(reader.sent().events).toContain('screenViewed');
  });

  it('does not ask a reader who chose again, whichever way they chose', async () => {
    for (const share of [true, false]) {
      const records = new Map<string, string>();
      const first = await run({ region: 'DE', records });
      await first.app.onboarding.next();
      await first.app.onboarding.chooseStatistics(share);

      const again = await run({ region: 'DE', records });

      expect(await steps(again)).not.toContain('statisticsConsent');
      expect((await again.settings.read()).shareCounters).toBe(share);
    }
  });

  it('does not ask a reader who set the switch on «Конфіденційність» before', async () => {
    const records = new Map<string, string>();
    const before = await run({ region: 'DE', records, on: ['knowledge', 'analytics'] });
    await before.settings.update({ shareCounters: false });
    await before.settings.update({ shareCounters: true });

    const updated = await run({ region: 'DE', records });

    expect(await steps(updated)).not.toContain('statisticsConsent');
    await updated.use();
    expect(updated.sent().events).toContain('screenViewed');
  });

  it('keeps the switch off for an EEA reader who left the step without a choice', async () => {
    const records = new Map<string, string>();
    const reader = await run({ region: 'DE', records });
    await reader.app.onboarding.next();
    await reader.app.onboarding.finish();

    const later = await run({ region: 'DE', records });
    await later.use();

    expect(later.sent()).toEqual(NOTHING);
    expect((await later.settings.read()).shareCounters).toBe(false);
  });

  it('keeps the switch off for a reader who left without a choice, when the switch or the region change later', async () => {
    const leaves = {
      'skips on the welcome': async (device: Awaited<ReturnType<typeof run>>) => {
        await device.app.onboarding.finish();
      },
      'skips on the step': async (device: Awaited<ReturnType<typeof run>>) => {
        await device.app.onboarding.next();
        await device.app.onboarding.finish();
      },
      'goes on from the step': async (device: Awaited<ReturnType<typeof run>>) => {
        await device.app.onboarding.next();
        await device.app.onboarding.next();
        await device.app.onboarding.finish();
      },
    };
    for (const [how, leave] of Object.entries(leaves)) {
      const records = new Map<string, string>();
      await leave(await run({ region: 'DE', records }));

      const switchedOff = await run({
        region: 'DE',
        records,
        on: ALL_ON.filter((feature) => feature !== 'statisticsConsent'),
      });
      await switchedOff.use();
      const moved = await run({ region: 'UA', records });
      await moved.use();

      expect(switchedOff.sent(), how).toEqual(NOTHING);
      expect(moved.sent(), how).toEqual(NOTHING);
      expect((await moved.settings.read()).shareCounters, how).toBe(false);
    }
  });

  it('does not ask a reader outside the EEA: the switch is on and the device sends from the start', async () => {
    const reader = await run({ region: 'UA' });

    expect((await reader.settings.read()).shareCounters).toBe(true);
    await reader.use();
    expect(reader.sent().events).toEqual(
      expect.arrayContaining(['onboardingStepViewed', 'screenViewed']),
    );
    expect(reader.sent().counters).toEqual(['w_3']);
    expect(await steps(reader)).not.toContain('statisticsConsent');
  });

  it('refuses a choice on another step', async () => {
    const reader = await run({ region: 'UA' });

    await reader.app.onboarding.chooseStatistics(false);

    expect(stepOf(reader)).toBe('welcome');
    expect((await reader.settings.read()).shareCounters).toBe(true);
  });

  it('asks no one while the Feature Switch is off: the switch is on until turned off', async () => {
    const reader = await run({
      region: 'DE',
      on: ALL_ON.filter((feature) => feature !== 'statisticsConsent'),
    });

    expect((await reader.settings.read()).shareCounters).toBe(true);
    await reader.use();
    expect(reader.sent().events).toContain('screenViewed');
    expect(await steps(reader)).not.toContain('statisticsConsent');
  });

  it('counts no questionnaire answer of an EEA reader who has not chosen', async () => {
    const reader = await run({ region: 'DE' });
    await reader.app.onboarding.next();
    await reader.app.onboarding.next();
    for (let kind = stepOf(reader); kind !== 'level'; kind = stepOf(reader)) {
      await reader.app.onboarding.next();
    }

    await reader.app.onboarding.answer('starting');
    await settle();

    expect(reader.sent()).toEqual(NOTHING);
  });

  /** Whether the welcome says the anonymous statistics are on, or the onboarding is not on it. */
  const statisticsLine = ({ app }: Awaited<ReturnType<typeof run>>) =>
    app.onboarding.state.status === 'open' && app.onboarding.state.step.kind === 'welcome'
      ? app.onboarding.state.step.statisticsLine
      : undefined;

  it('tells a reader outside the EEA on the welcome that the statistics are on', async () => {
    expect(statisticsLine(await run({ region: 'UA' }))).toBe(true);
  });

  it('says nothing of the statistics on the welcome of a reader it asks', async () => {
    expect(statisticsLine(await run({ region: 'DE' }))).toBe(false);
    expect(statisticsLine(await run({ region: undefined }))).toBe(false);
  });

  it('says nothing of the statistics on the welcome of a reader who turned them off', async () => {
    const records = new Map<string, string>();
    await (await run({ region: 'UA', records })).settings.update({ shareCounters: false });

    expect(statisticsLine(await run({ region: 'UA', records }))).toBe(false);
  });

  it('says nothing of the statistics on the welcome while the Feature Switch is off', async () => {
    const reader = await run({
      region: 'UA',
      on: ALL_ON.filter((feature) => feature !== 'statisticsConsent'),
    });

    expect(statisticsLine(reader)).toBe(false);
  });

  it('says nothing of the statistics on the welcome while nothing it governs is on', async () => {
    const reader = await run({
      region: 'UA',
      on: ALL_ON.filter((feature) => feature !== 'analytics' && feature !== 'communityCounters'),
    });

    expect(statisticsLine(reader)).toBe(false);
  });

  it.each(['analytics', 'communityCounters'] as const)(
    'keeps the line on the welcome while only %s of what it governs is on',
    async (kept) => {
      const gone = kept === 'analytics' ? 'communityCounters' : 'analytics';
      const reader = await run({ region: 'UA', on: ALL_ON.filter((feature) => feature !== gone) });

      expect(statisticsLine(reader)).toBe(true);
    },
  );
  it('does not ask an EEA reader while nothing it governs is on', async () => {
    const nothingGoverned = ALL_ON.filter(
      (feature) => feature !== 'analytics' && feature !== 'communityCounters',
    );

    expect(await steps(await run({ region: 'DE', on: nothingGoverned }))).not.toContain(
      'statisticsConsent',
    );
    expect(await steps(await run({ region: 'DE' }))).toContain('statisticsConsent');
  });
});

/** The user state of a reader who finished the onboarding before ADR 0210, at schema version 9. */
const finishedBefore0210 = (choice?: boolean) =>
  new Map<string, string>([
    ['schema.version', '9'],
    ['onboarding.finished', '"2026-11-01T08:00:00.000Z"'],
    ...(choice === undefined ? [] : ([['settings.shareCounters', String(choice)]] as const)),
  ]);

// ADR 0212: a one-time migration for a reader who finished the onboarding before ADR 0210.
describe('the Statistics consent migration', () => {
  it('keeps the switch off for a reader with no choice who would be asked, by region, time zone or an unknown region', async () => {
    for (const phone of [
      { region: 'DE', timeZone: 'Europe/Berlin' },
      { region: 'UA', timeZone: 'Europe/Berlin' },
      { region: undefined, timeZone: 'Europe/Kyiv' },
    ]) {
      const records = finishedBefore0210();
      const reader = await run({ ...phone, records });
      await reader.use();
      expect(reader.sent(), JSON.stringify(phone)).toEqual(NOTHING);
      expect(records.get('settings.shareCounters'), JSON.stringify(phone)).toBe('false');

      // Off for good: back home, the switch stays off until the reader turns it on.
      const home = await run({ region: 'UA', timeZone: 'Europe/Kyiv', records });
      await home.use();
      expect(home.sent(), JSON.stringify(phone)).toEqual(NOTHING);
      expect(await steps(home), JSON.stringify(phone)).toEqual([]);
    }
  });

  it('leaves a reader outside the EEA as before, and runs once: a later trip keeps nothing', async () => {
    const records = finishedBefore0210();
    const reader = await run({ region: 'UA', timeZone: 'Europe/Kyiv', records });
    await reader.use();
    expect(reader.sent().counters).toEqual(['w_3']);
    expect(records.has('settings.shareCounters')).toBe(false);

    await run({ region: 'UA', timeZone: 'Europe/Berlin', records });
    const home = await run({ region: 'UA', timeZone: 'Europe/Kyiv', records });
    await home.use();
    expect(records.has('settings.shareCounters')).toBe(false);
    expect(home.sent().counters).toEqual(['w_3']);
  });

  it('keeps the choice of a reader who made one', async () => {
    for (const choice of [true, false]) {
      const records = finishedBefore0210(choice);
      const reader = await run({ region: 'DE', timeZone: 'Europe/Berlin', records });
      expect((await reader.settings.read()).shareCounters).toBe(choice);
      expect(records.get('settings.shareCounters')).toBe(String(choice));
    }
  });
});
