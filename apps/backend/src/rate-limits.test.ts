import { lte } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { rateLimits } from './database/schema';
import { newIp, passTime, testApp } from './test-support';

const MINUTE = 60 * 1000;

let emails = 0;
/** An email no other request of this file uses. */
const newEmail = () => `reader-${String((emails += 1))}@example.com`;

describe('the ended windows of the rate limits', () => {
  it('stay while a counted request comes within the hour, and go with the first one after it', async () => {
    const backend = testApp();
    const requestCode = () =>
      backend.clientFrom(newIp()).account.requestCode({ email: newEmail(), editionId: 'uk' });
    const ended = async () =>
      (
        await backend.database.db
          .select({ key: rateLimits.key })
          .from(rateLimits)
          .where(lte(rateLimits.windowEnds, new Date()))
      ).length;
    await requestCode();

    // The first request's window of its IP address, 10 minutes long, has ended.
    passTime(11 * MINUTE);
    await requestCode();
    expect(await ended()).toBe(1);

    // An hour since the first request: its hour's window and the second
    // request's IP window have ended too, and this request removes them all.
    passTime(50 * MINUTE);
    await requestCode();
    expect(await ended()).toBe(0);
  });
});
