import { getEntry } from 'astro:content';

import { LANDING_EDITION, type LandingEdition } from './edition';

/** The landing's Edition, as the content sync read it (see content.config.ts). */
export async function landingEdition(): Promise<LandingEdition> {
  const entry = await getEntry('edition', LANDING_EDITION);
  if (entry === undefined)
    throw new Error(`The content sync read no Edition "${LANDING_EDITION}".`);
  return entry.data;
}
