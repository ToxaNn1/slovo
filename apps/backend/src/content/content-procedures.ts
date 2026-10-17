import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { ContentPacks } from '@slovo/server-core';

/** The content procedures of the contract, over the server Core's content packs. */
export function contentProcedures(contentPacks: ContentPacks) {
  const content = implement(apiContract.content);
  return content.router({
    latest: content.latest.handler(async ({ input, errors }) => {
      const latest = await contentPacks.latest(input.editionId, input.packFormat);
      if (!latest.ok) throw errors.NOT_FOUND();
      return { pack: latest.pack ?? null };
    }),
  });
}
