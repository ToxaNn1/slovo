import { EditionStringsSchema } from '@slovo/contracts';
import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
} from '@slovo/core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { refusalText } from './collection-refusal';

/** The Edition's one Category, the test Words' own, and its default Mix of every Category. */
const testCategories = {
  id: 'test',
  languageTraits: { distractorRule: 'same-part-of-speech' as const },
  categories: [{ id: 'test', displayName: 'Test' }],
  userSettingDefaults: { mix: { categoryIds: ['test'], corrections: true }, notificationTimes: [] },
};

const strings = EditionStringsSchema.parse(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../../editions/uk/strings.json', import.meta.url)),
      'utf8',
    ),
  ),
);

async function open(): Promise<Composition> {
  return openComposition({
    content: createMemoryContentPort(),
    edition: { ...testCategories, isFeatureEnabled: () => false },
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: { now: () => new Date('2026-10-13T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
}

describe('the name refusals of the «До колекції» sheet', () => {
  it('say each reason the Core refuses a name for, in the Edition’s own words', async () => {
    const { collections } = await open();
    await collections.create('Робота');

    const reasons = await Promise.all(
      ['   ', 'я'.repeat(41), ' робота '].map(async (name) => {
        const result = await collections.create(name);
        return result.ok ? undefined : result.reason;
      }),
    );

    expect(reasons).toEqual(['empty', 'too-long', 'duplicate']);
    const texts = reasons.map((reason) =>
      reason === undefined ? '' : refusalText(strings.collections.sheet.refusal, reason),
    );
    expect(texts.every((text) => text !== '')).toBe(true);
    expect(new Set(texts).size).toBe(3);
  });
});
