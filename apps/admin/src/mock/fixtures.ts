import type { AdminApiOutputs } from '@slovo/contracts/admin-api';

const FETCHED_AT = '2026-11-08T10:00:00.000Z';

const SWITCHES = { rules: [], minimums: {} } satisfies AdminApiOutputs['switches'];

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
  quality: {
    capped: false,
    from: '2026-11-01T10:00:00.000Z',
    to: FETCHED_AT,
    kpis: {
      crashFree: { state: 'ok', value: 99.6, yesterday: 99.4, fetchedAt: FETCHED_AT },
      crashes: { state: 'ok', value: 3, yesterday: 5, fetchedAt: FETCHED_AT },
      errors: { state: 'ok', value: 42, yesterday: 40, fetchedAt: FETCHED_AT },
      newIssues: { state: 'ok', value: 0, yesterday: 2, fetchedAt: FETCHED_AT },
      backendP95: { state: 'ok', value: null, yesterday: null, fetchedAt: FETCHED_AT },
      appStart: { state: 'ok', value: null, yesterday: null, fetchedAt: FETCHED_AT },
    },
  },
  ciHistory: {
    runs: [
      {
        runId: 101,
        at: '2026-11-07T09:00:00.000Z',
        sha: 'a63299a',
        tests: 812,
        failedTests: ['sync › retries a lost write'],
        flakyTests: ['sync › retries a lost write'],
        coverage: [{ package: 'core', lines: 91.2, branches: 84 }],
        jobs: [{ name: 'test', seconds: 240 }],
      },
      {
        runId: 102,
        at: '2026-11-08T09:00:00.000Z',
        sha: 'c6f01b8',
        tests: 815,
        failedTests: [],
        flakyTests: [],
        coverage: [
          { package: 'core', lines: 92.5, branches: 85.1 },
          { package: 'backend', lines: 78, branches: 70.4 },
        ],
        jobs: [
          { name: 'test', seconds: 250 },
          { name: 'lint', seconds: 60 },
        ],
      },
    ],
  },
  pushCiRun: { kept: true },
};
