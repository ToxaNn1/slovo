import type { AdminApiOutputs } from '@slovo/contracts/admin-api';

const SWITCHES = {
  rules: [
    {
      id: 'rule-timed',
      editionId: 'uk',
      feature: 'gameTimed',
      order: 0,
      verdict: { variants: ['a', 'b'] },
      targets: {},
    },
  ],
  minimums: {},
} satisfies AdminApiOutputs['switches'];

/** 13:58 in Kyiv. */
const FETCHED_AT = '2026-11-08T11:58:00.000Z';

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
  analytics: {
    activeByDay: [
      { key: '2026-11-06', count: 120 },
      { key: '2026-11-07', count: 135 },
    ],
    visitsByDay: [
      { key: '2026-11-06', count: 310 },
      { key: '2026-11-07', count: 342 },
    ],
    medianVisitSeconds: 245,
    devices: [
      { key: 'iPhone 15', count: 80 },
      { key: 'iPhone 13', count: 55 },
    ],
    appVersions: [{ key: '1.0.0', count: 135 }],
    fetchedAt: FETCHED_AT,
  },
  variantResults: {
    variants: [
      { key: 'a', count: 61 },
      { key: 'b', count: 59 },
    ],
    fetchedAt: FETCHED_AT,
  },
  counters: {
    known: 1200,
    unknown: 340,
    saved: 95,
    answers: [{ question: 'level', answer: 'good', count: 12 }],
  },
};
