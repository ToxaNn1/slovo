import type { AdminApiOutputs } from '@slovo/contracts/admin-api';

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
  development: {
    github: {
      state: 'ok',
      fetchedAt: '2026-11-08T09:30:00.000Z',
      pullRequests: [
        {
          number: 1750,
          title: 'feat(admin): Розробка',
          author: 'anton',
          url: 'https://github.com/ToxaNn1/slovo/pull/1750',
          draft: false,
          updatedAt: '2026-11-08T09:00:00.000Z',
        },
      ],
      mainCi: {
        state: 'success',
        url: 'https://github.com/ToxaNn1/slovo/actions/runs/1',
        finishedAt: '2026-11-08T08:00:00.000Z',
      },
      milestones: [
        { title: '0.9', open: 4, closed: 12, dueOn: '2026-12-01T00:00:00Z' },
        { title: '1.0', open: 30, closed: 0, dueOn: null },
      ],
      releases: [
        {
          tag: 'v0.8.0',
          name: '0.8',
          publishedAt: '2026-10-20T10:00:00.000Z',
          url: 'https://github.com/ToxaNn1/slovo/releases/tag/v0.8.0',
        },
      ],
    },
    eas: {
      state: 'ok',
      fetchedAt: '2026-11-08T09:30:00.000Z',
      builds: [
        {
          id: 'build-1',
          platform: 'ios',
          profile: 'production',
          status: 'finished',
          appVersion: '0.8.0',
          buildNumber: '42',
          createdAt: '2026-11-07T18:00:00.000Z',
          url: 'https://expo.dev/accounts/anton_de/projects/slovo/builds/build-1',
        },
      ],
    },
  },
};
