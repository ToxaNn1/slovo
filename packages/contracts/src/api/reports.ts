import { z } from 'zod';

import { MistakeReportSchema } from '../mistake-report';
import { procedure } from './procedure';

/** The Mistake Report procedures. They need no Account and send no Session. */
export const reportsContract = {
  send: procedure
    .route({
      method: 'POST',
      path: '/reports',
      successStatus: 202,
      summary: 'Report a mistake in an Entry',
      description:
        "The backend checks the report's shape, not whether its Entry is in a pack, and keeps it with its time of arrival only: no Account, no device id, no IP address (ADR 0056). A comment has at most 500 characters once trimmed and is empty when there is none; type other needs one.",
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
