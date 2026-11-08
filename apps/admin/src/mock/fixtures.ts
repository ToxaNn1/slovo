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
  actions: {
    actions: [
      {
        at: '2026-11-08T09:30:00.000Z',
        who: { kind: 'command', command: 'switches off' },
        what: 'switches.kill',
        before: null,
        after: { feature: 'game', verdict: 'off' },
        reason: 'the Game loses scores',
        editionId: 'uk',
      },
    ],
  },
  people: {
    people: [
      { email: 'owner@example.com', role: 'owner', signedInYet: true },
      { email: 'editor@example.com', role: 'admin', signedInYet: false },
    ],
  },
  invite: { invited: true },
  setRole: { changed: true },
  removePerson: { removed: true },
  agentTokens: {
    tokens: [{ name: 'claude-content', createdAt: '2026-11-01T09:00:00.000Z', revokedAt: null }],
  },
  issueAgentToken: {
    name: 'claude-batches',
    token: 'slovo_agent_4fJk9QmZr2Lw8xPaT7eYb3NcVd6HsUoG1iKqMnBy',
  },
  revokeAgentToken: { revoked: true },
  status: { on: true },
  switches: SWITCHES,
  setRules: SWITCHES,
  setMinimum: SWITCHES,
  kill: { editionIds: ['uk'] },
  editions: { editions: [{ id: 'uk', displayName: 'Рідкісні слова' }] },
};
