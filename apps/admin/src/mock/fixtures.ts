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

const BATCH_ID = '00000000-0000-4000-8000-000000000000';
const WRITTEN = {
  id: 'w_a1',
  recordVersion: 2,
  contentVersion: 2,
  batchId: BATCH_ID,
} satisfies AdminApiOutputs['content']['create'];

const FETCHED_AT = '2026-11-08T10:00:00.000Z';

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
