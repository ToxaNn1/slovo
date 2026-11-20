import { z } from 'zod';

import { MistakeReportSchema } from '../mistake-report';
import { procedure } from './procedure';

/**
 * The Mistake Report procedures. They need no Account; a signed-in device
 * sends its Session, and a Session that is not on makes the report anonymous.
 */
export const reportsContract = {
  send: procedure
    .route({
      method: 'POST',
      path: '/reports',
      successStatus: 202,
      summary: 'Report a mistake in an Entry',
      description:
        "The backend checks the report's shape, not whether its Entry is in a pack, and keeps it with its time of arrival and, from a signed-in device, the Account of its Session: no device id, no IP address. Without a Session, or with one that is not on, the report is anonymous and still taken. A comment has at most 500 characters once trimmed and is empty when there is none; type other needs one.",
      tags: ['reports'],
    })
    .errors({
      /** An Edition the backend doesn't serve, or one with Mistake Reports switched off. */
      NOT_FOUND: { message: 'Not found' },
      /**
       * Over the limit of 10 reports from one IP address in a day;
       * `Retry-After` says, in seconds, when to try again.
       */
      TOO_MANY_REQUESTS: { message: 'Too many requests' },
    })
    .input(MistakeReportSchema)
    .output(z.void()),
};
