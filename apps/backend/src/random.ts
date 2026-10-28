import { randomInt } from 'node:crypto';

import type { Random } from '@slovo/server-core';

/** The system's cryptographic randomness, which the backend draws ids from. */
export const systemRandom: Random = { int: (bound) => randomInt(bound) };
