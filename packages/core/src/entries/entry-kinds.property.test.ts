import type { Entry, EntryKind } from '@slovo/contracts';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { ALL_KINDS, ENTRY_KINDS, MIX_KINDS } from './entry-kinds';
import { createMemoryContentPort } from '../testing';
import { correction, idiom, synonymRow, tip, word } from '../test-support';

/** Seeded, so CI checks the same inputs on every run. */
const runs = { seed: 20261030, numRuns: 100 };

const kinds = fc.constantFrom(...ALL_KINDS);

/** An Entry of each kind with the id, live or Retired. */
const entryOf: Readonly<Record<EntryKind, (id: string, retired: boolean) => Entry>> = {
  word: (id, retired) => word(id, { retired }),
  correction: (id, retired) => correction(id, { retired }),
  idiom: (id, retired) => idiom(id, { retired }),
  synonymRow: (id, retired) => synonymRow(id, { retired }),
  tip: (id, retired) => tip(id, { retired }),
};

/** Entries of every kind, each with an id of its kind's prefix, some Retired; no two share an id. */
const packs = fc
  .uniqueArray(fc.tuple(kinds, fc.stringMatching(/^[a-z0-9]{1,6}$/), fc.boolean()), {
    selector: ([kind, stem]) => `${kind}:${stem}`,
    maxLength: 40,
  })
  .map((rows) =>
    rows.map(([kind, stem, retired]) =>
      entryOf[kind](`${ENTRY_KINDS[kind].idPrefix}${stem}`, retired),
    ),
  );

describe('the kind table', () => {
  it('states every trait of every kind, and gives each kind a prefix of its own', () => {
    fc.assert(
      fc.property(kinds, (kind) => {
        const traits = ENTRY_KINDS[kind];
        expect(traits.idPrefix).toMatch(/^[a-z]_$/);
        expect(traits.name).toMatch(/^[a-zA-Z]+s$/);
        expect(typeof traits.shown).toBe('boolean');
        if (kind === 'word') expect(traits.feedTurn).toBeUndefined();
        else expect(traits.feedTurn).toBeGreaterThan(1);
        const others = ALL_KINDS.filter((other) => other !== kind);
        expect(others.map((other) => ENTRY_KINDS[other].idPrefix)).not.toContain(traits.idPrefix);
        expect(others.map((other) => ENTRY_KINDS[other].name)).not.toContain(traits.name);
      }),
      runs,
    );
  });

  it('gives the Feed turns of the kinds in the Mix in a strictly rising order, so each turn falls on a card of its own', () => {
    const turns = MIX_KINDS.map((kind) => ENTRY_KINDS[kind].feedTurn);
    expect(turns).toEqual([...turns].sort((a, b) => a - b));
    expect(new Set(turns).size).toBe(turns.length);
  });
});

describe('listIds of the content read port', () => {
  it("lists the live ids of the kind, every one with the kind's prefix, in the order given, and no other", async () => {
    await fc.assert(
      fc.asyncProperty(packs, kinds, async (entries, kind) => {
        const content = createMemoryContentPort({
          words: entries.filter((entry) => entry.kind === 'word'),
          corrections: entries.filter((entry) => entry.kind === 'correction'),
          idioms: entries.filter((entry) => entry.kind === 'idiom'),
          synonymRows: entries.filter((entry) => entry.kind === 'synonymRow'),
          tips: entries.filter((entry) => entry.kind === 'tip'),
        });

        const ids = await content.listIds(kind);

        const { idPrefix } = ENTRY_KINDS[kind];
        expect(ids.every((id) => id.startsWith(idPrefix))).toBe(true);
        expect(ids).toEqual(
          entries.filter((entry) => entry.kind === kind && !entry.retired).map(({ id }) => id),
        );
        const listed = await content.getEntries(ids);
        expect(listed.map((entry) => entry.kind)).toEqual(ids.map(() => kind));
      }),
      runs,
    );
  });
});
