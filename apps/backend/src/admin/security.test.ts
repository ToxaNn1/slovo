import { randomUUID } from 'node:crypto';

import { systemClock } from '@slovo/server-core';
import { describe, expect, it } from 'vitest';

import { createEditions } from '../edition/editions';
import { runSwitchesCommand } from '../edition/switches-command';
import {
  adminHeaders,
  passTime,
  signedInAdmin,
  signInAdmin,
  testApp,
  testEditions,
} from '../test-support';
import { createAdminStore } from './admin-store';

const newEmail = () => `person-${randomUUID()}@example.com`;
const newName = () => `agent-${randomUUID().slice(0, 8)}`;
const bearer = (token: string) => ({ ...adminHeaders(), authorization: `Bearer ${token}` });

/** A backend whose admin is on, with a signed-in Власник. */
async function ownerOn(...editionIds: string[]) {
  const folder = testEditions(editionIds);
  const app = testApp({ editions: folder.read() });
  const owner = await signedInAdmin(app, 'owner');
  const editions = createEditions({
    database: app.database,
    clock: systemClock,
    editions: folder.read(),
    alerts: app.alerts,
  });
  return { ...app, owner, editions, store: createAdminStore(app.database) };
}

describe('people and access', () => {
  it('lets a Власник invite an Адмін, who signs in and is refused on Безпека', async () => {
    const backend = await ownerOn();
    const email = newEmail();

    await backend.owner.client.admin.invite({ email, role: 'admin', reason: 'a new editor' });

    expect(backend.mailer.sent.some((mail) => mail.to === email)).toBe(true);
    const { people } = await backend.owner.client.admin.people();
    expect(people).toContainEqual({ email, role: 'admin', signedInYet: false });

    const invitee = await signInAdmin(backend, email);
    await expect(invitee.client.admin.me()).resolves.toEqual({ email, role: 'admin' });
    await expect(invitee.client.admin.people()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(invitee.client.admin.actions({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      invitee.client.admin.issueAgentToken({ name: newName(), reason: 'try' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await backend.owner.client.admin.people()).people).toContainEqual({
      email,
      role: 'admin',
      signedInYet: true,
    });
  });

  it('ends the access of a removed person, and logs each write with before and after', async () => {
    const backend = await ownerOn();
    const email = newEmail();
    await backend.owner.client.admin.invite({ email, role: 'admin', reason: 'help' });
    const invitee = await signInAdmin(backend, email);

    await backend.owner.client.admin.setRole({ email, role: 'owner', reason: 'trusted' });
    await backend.owner.client.admin.removePerson({ email, reason: 'left the team' });

    await expect(invitee.client.admin.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    const sent = backend.mailer.sent.length;
    await backend.clientWith(adminHeaders()).admin.requestCode({ email });
    expect(backend.mailer.sent).toHaveLength(sent);
    expect((await backend.owner.client.admin.people()).people.map((p) => p.email)).not.toContain(
      email,
    );

    const { actions } = await backend.owner.client.admin.actions({});
    const mine = actions.filter(
      (row) =>
        JSON.stringify(row.before).includes(email) || JSON.stringify(row.after).includes(email),
    );
    const who = { kind: 'admin-user', email: backend.owner.email };
    expect(mine).toMatchObject([
      {
        who,
        what: 'admin.user.remove',
        before: { email, role: 'owner' },
        after: null,
        reason: 'left the team',
      },
      {
        who,
        what: 'admin.user.role',
        before: { email, role: 'admin' },
        after: { email, role: 'owner' },
        reason: 'trusted',
      },
      {
        who,
        what: 'admin.user.invite',
        before: null,
        after: { email, role: 'admin' },
        reason: 'help',
      },
    ]);
  });

  it('lets a removed person be invited again, to enrol afresh', async () => {
    const backend = await ownerOn();
    const email = newEmail();
    await backend.owner.client.admin.invite({ email, role: 'admin', reason: 'help' });
    await signInAdmin(backend, email);
    await backend.owner.client.admin.removePerson({ email, reason: 'left' });

    await backend.owner.client.admin.invite({ email, role: 'owner', reason: 'back' });

    const again = await signInAdmin(backend, email);
    await expect(again.client.admin.me()).resolves.toEqual({ email, role: 'owner' });
  });

  it('refuses an active email, and the Власник removing or demoting themself', async () => {
    const backend = await ownerOn();
    const { email } = backend.owner;
    const { admin } = backend.owner.client;

    await expect(admin.invite({ email, role: 'admin', reason: 'x' })).rejects.toMatchObject({
      code: 'CONFLICT',
      data: { refusal: 'taken' },
    });
    await expect(admin.setRole({ email, role: 'admin', reason: 'x' })).rejects.toMatchObject({
      code: 'CONFLICT',
      data: { refusal: 'self' },
    });
    await expect(admin.removePerson({ email, reason: 'x' })).rejects.toMatchObject({
      code: 'CONFLICT',
      data: { refusal: 'self' },
    });
    await expect(admin.removePerson({ email: newEmail(), reason: 'x' })).rejects.toMatchObject({
      code: 'CONFLICT',
      data: { refusal: 'unknown' },
    });
  });

  it('sends one invitation for two invites of the same email at once', async () => {
    const backend = await ownerOn();
    const email = newEmail();

    const results = await Promise.allSettled([
      backend.owner.client.admin.invite({ email, role: 'admin', reason: 'help' }),
      backend.owner.client.admin.invite({ email, role: 'owner', reason: 'help' }),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(backend.mailer.sent.filter((mail) => mail.to === email)).toHaveLength(1);
  });

  it('grants no access when the invitation email is not sent, so the invite can be repeated', async () => {
    const backend = await ownerOn();
    const email = newEmail();
    backend.mailer.failNext();

    await expect(
      backend.owner.client.admin.invite({ email, role: 'admin', reason: 'help' }),
    ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect((await backend.owner.client.admin.people()).people).not.toContainEqual(
      expect.objectContaining({ email }),
    );

    await backend.owner.client.admin.invite({ email, role: 'admin', reason: 'help' });
    expect(backend.mailer.sent.filter((mail) => mail.to === email)).toHaveLength(1);
  });

  it('takes a write only with a reason and the admin header', async () => {
    const backend = await ownerOn();
    await expect(
      backend.owner.client.admin.invite({ email: newEmail(), role: 'admin', reason: ' ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      backend.owner.client.admin.invite({ email: 'not an email', role: 'admin', reason: 'help' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    const response = await backend.request('/v1/admin/people', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: backend.owner.cookie },
      body: JSON.stringify({ email: newEmail(), role: 'admin', reason: 'help' }),
    });
    expect(response.status).toBe(403);
  });
});

describe('Агент tokens', () => {
  it('answers a token once, lists it by name, and is refused once revoked', async () => {
    const backend = await ownerOn();
    const { admin } = backend.owner.client;
    const name = newName();
    const other = newName();

    const issued = await admin.issueAgentToken({ name, reason: 'content batches' });
    const kept = await admin.issueAgentToken({ name: other, reason: 'another' });

    expect(issued).toEqual({ name, token: expect.stringMatching(/^slovo_agent_/) as unknown });
    const listed = (await admin.agentTokens()).tokens.find((token) => token.name === name);
    expect(listed).toEqual({ name, createdAt: expect.any(String) as unknown, revokedAt: null });
    expect(JSON.stringify(await admin.agentTokens())).not.toContain(issued.token);
    // Known, so refused for its role on the switches.
    const switches = await backend.request('/v1/admin/editions/uk/switches', {
      headers: bearer(issued.token),
    });
    expect(switches.status).toBe(403);

    passTime(1000);
    await admin.revokeAgentToken({ name, reason: 'leaked' });

    expect(
      (await backend.request('/v1/admin/status', { headers: bearer(issued.token) })).status,
    ).toBe(401);
    expect(
      (await backend.request('/v1/admin/status', { headers: bearer(kept.token) })).status,
    ).toBe(403);
    expect((await admin.agentTokens()).tokens.find((token) => token.name === name)).toEqual({
      name,
      createdAt: listed?.createdAt,
      revokedAt: expect.any(String) as unknown,
    });
    const { actions } = await admin.actions({});
    expect(actions.slice(0, 3)).toMatchObject([
      { what: 'admin.agent.revoke', before: { name }, reason: 'leaked' },
      { what: 'admin.agent.add', after: { name: other } },
      { what: 'admin.agent.add', after: { name }, reason: 'content batches' },
    ]);
    expect(JSON.stringify(actions)).not.toContain(issued.token);
  });

  it('refuses a name issued before, and a revoke of none', async () => {
    const backend = await ownerOn();
    const { admin } = backend.owner.client;
    const name = newName();
    await admin.issueAgentToken({ name, reason: 'first' });

    await expect(admin.issueAgentToken({ name, reason: 'again' })).rejects.toMatchObject({
      code: 'CONFLICT',
      data: { refusal: 'name-taken' },
    });
    await expect(admin.revokeAgentToken({ name: newName(), reason: 'x' })).rejects.toMatchObject({
      code: 'CONFLICT',
      data: { refusal: 'unknown' },
    });
  });
});

describe('the Action log', () => {
  it('answers newest first, only the rows of the filtered Edition, naming who wrote them', async () => {
    const backend = await ownerOn('logged', 'elsewhere');
    const output = { out: () => undefined, err: () => undefined };
    await backend.owner.client.admin.setRules({
      editionId: 'elsewhere',
      feature: 'game',
      rules: [{ id: 'off', verdict: 'off', targets: {} }],
      reason: 'not here',
    });
    passTime(1000);
    await runSwitchesCommand(
      ['off', 'logged', 'game', '--reason', 'the Game loses scores'],
      backend.editions,
      output,
    );
    passTime(1000);
    await backend.store.appendAction({
      who: { kind: 'agent', name: 'claude-content' },
      what: 'content.entry.edit',
      before: { gloss: 'old' },
      after: { gloss: 'new' },
      reason: 'a typo',
      editionId: 'logged',
      batchId: null,
      at: new Date(),
    });

    const { actions } = await backend.owner.client.admin.actions({ editionId: 'logged' });

    expect(actions).toMatchObject([
      {
        who: { kind: 'agent', name: 'claude-content' },
        what: 'content.entry.edit',
        before: { gloss: 'old' },
        after: { gloss: 'new' },
        editionId: 'logged',
      },
      {
        who: { kind: 'command', command: 'switches off' },
        what: 'switches.kill',
        reason: 'the Game loses scores',
        editionId: 'logged',
      },
    ]);
  });
});
