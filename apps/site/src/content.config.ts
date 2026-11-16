import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  EDITIONS_DIR,
  listEditions,
  openEditionWithoutRecords,
} from '@slovo/language-pack/edition';
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';

import { ContentSnapshotSchema } from '@slovo/contracts/api';

import { LANDING_EDITION, LandingEditionSchema, readLandingEdition } from './edition';
import { readLiveWords, snapshotSource } from './snapshot';

/**
 * The landing's Edition (ADR 0071), one entry by its id. The files are read
 * here, at the content sync, since the built pages no longer know where the
 * editions folder lies.
 */
const edition = defineCollection({
  loader: {
    name: 'landing-edition',
    async load(context) {
      context.store.clear();
      const data = await context.parseData({ id: LANDING_EDITION, data: readLandingEdition() });
      context.store.set({ id: LANDING_EDITION, data });
    },
  },
  schema: LandingEditionSchema,
});

/**
 * Every Edition's legal pages (ADR 0049), read through the Edition folder
 * module and published at /<edition-id>/<page>. The id is `<edition-id>/<page>`.
 */
const legal = defineCollection({
  loader: {
    name: 'edition-legal-pages',
    async load(context) {
      context.store.clear();
      for (const editionId of listEditions(EDITIONS_DIR)) {
        for (const file of openEditionWithoutRecords(EDITIONS_DIR, editionId).legalPages()) {
          const id = `${editionId}/${basename(file, '.md')}`;
          const rendered = await context.renderMarkdown(readFileSync(file, 'utf8'), {
            fileURL: pathToFileURL(file),
          });
          const frontmatter = rendered.metadata?.frontmatter ?? {};
          const data = await context.parseData({ id, data: frontmatter });
          context.store.set({ id, data, rendered });
        }
      }
    },
  },
  schema: z.object({ title: z.string().min(1), lang: z.string().min(2) }),
});

/**
 * The landing's live Words (ADR 0149), by id: from the backend's content
 * snapshot when SLOVO_BACKEND_URL is set, from the seed snapshot when not.
 * The snapshot is parsed once, here; a failed read fails the build.
 */
const words = defineCollection({
  loader: {
    name: 'live-words',
    async load(context) {
      const live = await readLiveWords(snapshotSource(process.env));
      context.store.clear();
      for (const word of live) {
        const data = await context.parseData({ id: word.id, data: word });
        context.store.set({ id: word.id, data });
      }
    },
  },
  schema: ContentSnapshotSchema.shape.words.element,
});

export const collections = { edition, legal, words };
