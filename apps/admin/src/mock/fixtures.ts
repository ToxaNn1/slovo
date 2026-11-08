import type { AdminApiOutputs } from '@slovo/contracts/admin-api';

const SWITCHES = { rules: [], minimums: {} } satisfies AdminApiOutputs['switches'];

const BATCH_ID = '00000000-0000-4000-8000-000000000000';
const WRITTEN = {
  id: 'w_a1',
  recordVersion: 2,
  contentVersion: 2,
  batchId: BATCH_ID,
} satisfies AdminApiOutputs['content']['create'];

/** What `pnpm dev:admin --mock` and the screen tests answer, one per procedure. */
export const FIXTURES: AdminApiOutputs = {
  requestCode: { sent: true },
  verifyCode: {
    next: 'enrol',
    secret: 'JBSWY3DPEHPK3PXP',
    otpauthUrl: 'otpauth://totp/SLOVO%20Admin:owner%40example.com?secret=JBSWY3DPEHPK3PXP',
    recoveryCodes: ['k7Qm2xPa', 'Zr4tLw9e'],
  },
  signIn: { email: 'owner@example.com', role: 'owner' },
  me: { email: 'owner@example.com', role: 'owner' },
  sessions: {
    sessions: [
      {
        createdAt: '2026-11-01T09:00:00.000Z',
        lastSeenAt: '2026-11-08T10:00:00.000Z',
        current: true,
      },
      {
        createdAt: '2026-10-20T18:30:00.000Z',
        lastSeenAt: '2026-11-02T21:15:00.000Z',
        current: false,
      },
    ],
  },
  signOut: { signedOut: true },
  signOutEverywhere: { signedOut: true },
  actions: { actions: [] },
  status: { on: true },
  switches: SWITCHES,
  setRules: SWITCHES,
  setMinimum: SWITCHES,
  kill: { editionIds: ['uk'] },
  editions: { editions: [{ id: 'uk', displayName: 'Рідкісні слова' }] },
  content: {
    openBatch: { batchId: BATCH_ID },
    create: WRITTEN,
    edit: WRITTEN,
    retire: WRITTEN,
    flag: { id: 'w_a1', batchId: BATCH_ID },
    record: { fields: {}, recordVersion: 1 },
    report: {
      contentVersion: 1,
      report: {
        words: 0,
        retiredWords: 0,
        wordsPerCategory: [],
        rarity: [],
        coverage: { examples: 0, synonyms: 0, etymology: 0, stress: 0, region: 0 },
        corrections: 0,
        retiredCorrections: 0,
        correctionsPerType: [],
        correctionsPerCategory: [],
        idioms: 0,
        retiredIdioms: 0,
        idiomsPerType: [],
      },
      targets: {},
      missed: [],
      quoteCheck: { unverified: 0, failed: 0 },
    },
  },
};
