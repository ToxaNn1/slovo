import type { CollectionLink } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { newIp, testApp } from '../test-support';

/** A valid Collection of the Ukrainian Edition, as «Поділитися посиланням» sends it. */
const link = (name: string): CollectionLink => ({
  edition: 'uk',
  name,
  entryIds: ['w_a1', 'c_a1'],
});

/** The backend with the links of the names shared, each from an IP address of its own so no limit is met; answers their ids. */
async function sharing(...names: string[]) {
  const app = testApp();
  const ids: string[] = [];
  for (const name of names) {
    const { id } = await app.clientFrom(newIp()).collectionLinks.create(link(name));
    ids.push(id);
  }
  return { ...app, ids };
}

describe('the collection-links delete command', () => {
  it('deletes the link, so reading it answers NOT_FOUND, and keeps the others', async () => {
    const { client, deleteCollectionLink, ids } = await sharing('Образливе', 'Осінь');
    const [abusive = '', kept = ''] = ids;

    await expect(deleteCollectionLink(abusive)).resolves.toEqual({
      exitCode: 0,
      line: `Deleted Collection Link ${abusive}.`,
    });

    await expect(client.collectionLinks.read({ id: abusive })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    await expect(client.collectionLinks.read({ id: kept })).resolves.toMatchObject({
      name: 'Осінь',
    });
  });

  it('says so and exits non-zero for an id it does not keep', async () => {
    const { deleteCollectionLink, ids } = await sharing('Осінь');
    const [deleted = ''] = ids;
    await deleteCollectionLink(deleted);

    await expect(deleteCollectionLink(deleted)).resolves.toEqual({
      exitCode: 1,
      line: `No Collection Link ${deleted} to delete.`,
    });
    await expect(deleteCollectionLink('not a link')).resolves.toEqual({
      exitCode: 1,
      line: 'No Collection Link not a link to delete.',
    });
  });
});
