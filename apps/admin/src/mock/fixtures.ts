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
