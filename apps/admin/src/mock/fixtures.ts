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
/** The Content queue's one batch. */
export const QUEUE_BATCH = {
  id: BATCH_ID,
  editionId: 'uk',
  author: 'claude-content',
  createdAt: '2026-11-08T08:00:00.000Z',
  added: 3,
  changed: 2,
} satisfies AdminApiOutputs['contentQueue']['batches']['batches'][number];

/** The Content queue's one Mistake Report. */
export const QUEUE_REPORT = {
  id: '0b9c3f0e-6a52-4c39-9f3e-2f1d7c1a5b11',
  editionId: 'uk',
  entryId: 'w_b2',
  type: 'stress',
  comment: 'Наголос на другому складі.',
  appVersion: '0.8.0',
  contentVersion: 2,
  receivedAt: '2026-11-07T20:00:00.000Z',
} satisfies AdminApiOutputs['contentQueue']['reports']['reports'][number];

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
  contentQueue: {
    batches: {
      batches: [QUEUE_BATCH],
    },
    review: { reviewed: true },
    rollback: { contentVersion: 3, retired: ['w_a1'], restored: ['w_b2'], skipped: ['w_c3'] },
    flags: {
      flags: [
        {
          id: 7,
          editionId: 'uk',
          kind: 'word',
          recordId: 'w_a1',
          author: 'claude-content',
          explanation: 'Цитату не знайдено в джерелі.',
          at: '2026-11-08T08:05:00.000Z',
        },
      ],
    },
    resolveFlag: { resolved: true },
    reports: {
      reports: [QUEUE_REPORT],
    },
    resolveReport: { resolved: true },
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
