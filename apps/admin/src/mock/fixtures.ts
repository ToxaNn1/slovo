import { FeatureSwitchesSchema } from '@slovo/contracts';
import type { AdminApiOutputs } from '@slovo/contracts/admin-api';

/** Every feature on, but one off and one the Edition hasn't got. */
const STATES = FeatureSwitchesSchema.parse({
  ...Object.fromEntries(FeatureSwitchesSchema.keyof().options.map((feature) => [feature, 'on'])),
  contentUpdates: 'off',
  mistakeReports: 'unavailable',
});

const SWITCHES = {
  states: STATES,
  rules: [
    {
      id: 'android-beta',
      editionId: 'uk',
      feature: 'game',
      order: 0,
      verdict: 'off',
      targets: { platform: 'android' },
    },
  ],
  minimums: {},
} satisfies AdminApiOutputs['switches'];

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
};
