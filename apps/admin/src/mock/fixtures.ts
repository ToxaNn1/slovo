import type { AdminApiOutputs } from '@slovo/contracts/admin-api';

const SWITCHES = { rules: [], minimums: {} } satisfies AdminApiOutputs['switches'];

/** What `pnpm dev:admin --mock` and the screen tests answer, one per procedure. */
/** An open Owner check, the base of the fixtures. */
const OPEN_CHECK = {
  id: 1,
  version: '0.9',
  text: 'Пошук знаходить слово.',
  addedBy: 'pnpm admin check add',
  addedAt: '2026-11-01T10:00:00.000Z',
  ticked: null,
};

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
  ownerChecks: {
    checks: [
      { ...OPEN_CHECK, id: 1, version: '0.9', text: 'Пошук знаходить слово.' },
      {
        ...OPEN_CHECK,
        id: 2,
        version: '0.9',
        text: 'Пейвол зʼявляється один раз.',
        ticked: { at: '2026-11-07T10:00:00.000Z', by: 'owner@example.com' },
      },
      { ...OPEN_CHECK, id: 3, version: '1.0', text: 'Вхід через Apple.' },
    ],
    open: { '0.9': 1, '1.0': 1 },
  },
  tickOwnerCheck: {
    check: { ...OPEN_CHECK, ticked: { at: '2026-11-08T10:00:00.000Z', by: 'owner@example.com' } },
  },
  addOwnerCheck: { check: OPEN_CHECK },
};
