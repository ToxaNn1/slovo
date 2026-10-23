import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  serializeWidgetSnapshot,
  type Correction,
  WidgetSnapshotSchema,
  type WidgetSnapshot,
} from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Clock,
  type Random,
} from '@slovo/core';

import { buildLanguagePack, openLanguagePack, type NodeLanguagePack } from './index';
import { ukrainian, ukrainianFolder } from './test-support';

// The Widget Snapshot contract (spec #259, seam 2): the snapshot the Core
// builds over the real Ukrainian Language Pack, and the example the widget's
// gallery shows. It lives here because only this package can build and read
// a pack in Node.

/** The combining acute accent a stress trap writes its Stress with. */
const STRESS_MARK = '\u0301';

let workDir: string;
let pack: NodeLanguagePack;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-widget-'));
  const outFile = join(workDir, 'language-pack.db');
  if (!buildLanguagePack({ editionDir: ukrainianFolder.dir, outFile }).ok) {
    throw new Error('The Ukrainian Language Pack does not build');
  }
  pack = openLanguagePack(outFile);
});

afterAll(() => {
  pack.close();
  rmSync(workDir, { recursive: true, force: true });
});

/** A seeded random port (a linear congruential generator), so every run draws the same. */
function seededRandom(seed: number): Random {
  let state = seed;
  return {
    next() {
      state = (state * 1_664_525 + 1_013_904_223) % 2 ** 32;
      return state / 2 ** 32;
    },
  };
}

/** A clock the test moves by hand. */
function fakeClock(start: string) {
  let now = new Date(start).getTime();
  const clock: Clock = { now: () => new Date(now), timeZone: () => 'Europe/Kyiv' };
  return {
    clock,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

/** Every id each Widget Mode shows. */
const modeIdsOf = (snapshot: WidgetSnapshot) => [
  ...snapshot.allEntries,
  ...snapshot.favorites,
  ...snapshot.collections.flatMap(({ entryIds }) => entryIds),
];

describe('The Widget Snapshot of the Ukrainian Edition', () => {
  it('serializes and parses, with every id in every mode among its Entries', async () => {
    const { clock, advance } = fakeClock('2026-10-16T09:00:00+03:00');
    const app = await openComposition({
      content: pack,
      edition: ukrainian,
      userState: await openUserState({ port: createMemoryUserStatePort() }),
      clock,
      random: seededRandom(7),
    });
    const [first, second, third] = await pack.listWordIds();
    const [correctionId] = await pack.listCorrectionIds();
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('The pack has fewer than three Words');
    }
    if (correctionId === undefined) throw new Error('The pack has no Correction');
    for (const id of [first, second, correctionId]) {
      await app.favorites.add(id);
      advance(60_000);
    }
    const letters = await app.collections.create('Для листів', third);
    if (!letters.ok) throw new Error('The Collection was not created');
    await app.collections.add(letters.collection.id, second);
    await app.hide({ kind: 'entry', entryId: second });

    const snapshot = await app.widget.snapshot();
    if (snapshot === undefined) throw new Error('No Widget Snapshot was built');
    const parsed = WidgetSnapshotSchema.parse(JSON.parse(serializeWidgetSnapshot(snapshot)));

    expect(parsed).toEqual(snapshot);
    expect(parsed.editionId).toBe('uk');
    expect(parsed.favorites).toEqual([correctionId, first]);
    expect(parsed.collections).toEqual([
      { id: letters.collection.id, name: 'Для листів', entryIds: [third] },
    ]);
    const entryIds = new Set(parsed.entries.map(({ id }) => id));
    expect(modeIdsOf(parsed).filter((id) => !entryIds.has(id))).toEqual([]);
    expect([...entryIds, ...modeIdsOf(parsed)]).not.toContain(second);
  });

  it('keeps the Stress marks of a stress trap on screen and reads it to VoiceOver without them', async () => {
    const app = await openComposition({
      content: pack,
      edition: ukrainian,
      userState: await openUserState({ port: createMemoryUserStatePort() }),
      clock: fakeClock('2026-10-16T09:00:00+03:00').clock,
      random: seededRandom(7),
    });
    const stressTraps = (await pack.getEntries(await pack.listCorrectionIds())).filter(
      (entry): entry is Correction =>
        entry.kind === 'correction' && entry.correctionType === 'wrongStress',
    );
    expect(stressTraps).not.toEqual([]);

    const snapshot = await app.widget.snapshot();
    if (snapshot === undefined) throw new Error('No Widget Snapshot was built');
    for (const { id, standardEquivalents, nonStandardForm } of stressTraps) {
      const [headline, secondLine] = [standardEquivalents[0] ?? '', nonStandardForm];
      expect(headline).toContain(STRESS_MARK);
      expect(secondLine).toContain(STRESS_MARK);
      const unmarked = (text: string) => text.replaceAll(STRESS_MARK, '');
      expect(snapshot.entries.find((entry) => entry.id === id)).toEqual({
        kind: 'correction',
        id,
        headline,
        secondLine,
        voiceOver: `${unmarked(headline)}, ${unmarked(secondLine)}`,
      });
    }
  });

  it('shows an Idiom in each Widget Mode with its expression and primary Definition', async () => {
    const { clock, advance } = fakeClock('2026-10-16T09:00:00+03:00');
    const app = await openComposition({
      content: pack,
      edition: ukrainian,
      userState: await openUserState({ port: createMemoryUserStatePort() }),
      clock,
      random: seededRandom(7),
    });
    const [idiom] = await pack.getEntries(await pack.listIdiomIds());
    if (idiom?.kind !== 'idiom') throw new Error('The pack has no Idiom');
    await app.favorites.add(idiom.id);
    advance(60_000);
    const sayings = await app.collections.create('Приказки', idiom.id);
    if (!sayings.ok) throw new Error('The Collection was not created');

    const snapshot = await app.widget.snapshot();
    if (snapshot === undefined) throw new Error('No Widget Snapshot was built');

    expect(snapshot.entries.find(({ id }) => id === idiom.id)).toEqual({
      kind: 'idiom',
      id: idiom.id,
      headline: idiom.expression,
      secondLine: idiom.primaryDefinition,
      voiceOver: `${idiom.expression}, ${idiom.primaryDefinition}`,
    });
    expect(snapshot.allEntries).toContain(idiom.id);
    expect(snapshot.favorites).toEqual([idiom.id]);
    expect(snapshot.collections).toEqual([
      { id: sayings.collection.id, name: 'Приказки', entryIds: [idiom.id] },
    ]);
  });

  it('opens an Idiom from the widget on its card and marks it Seen', async () => {
    const app = await openComposition({
      content: pack,
      edition: ukrainian,
      userState: await openUserState({ port: createMemoryUserStatePort() }),
      clock: fakeClock('2026-10-16T09:00:00+03:00').clock,
      random: seededRandom(7),
    });
    const [idiomId] = await pack.listIdiomIds();
    if (idiomId === undefined) throw new Error('The pack has no Idiom');

    const card = await app.widget.opened(idiomId);

    expect(card?.kind).toBe('idiom');
    expect(card?.entryId).toBe(idiomId);
    expect(app.history.list.map(({ entryId }) => entryId)).toContain(idiomId);
  });

  it('has a checked-in example that parses, for the widget gallery', () => {
    expect(() => ukrainianFolder.read('widgetSnapshotExample')).not.toThrow();
  });
});
