import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { AdminAccess } from '@slovo/server-core';

import type { ContentWrites, WriteRefusal } from '../content/content-writes';

/** The bearer token of the request's `Authorization` header, if it carries one. */
function bearerOf(headers: Headers): string | undefined {
  const match = /^Bearer\s+(\S+)$/i.exec(headers.get('authorization') ?? '');
  return match?.[1];
}

/** Who calls an admin procedure: no one known yet (the sign-in ticket adds the Admin user), or an Агент. */
export type AdminCaller =
  { readonly kind: 'anonymous' } | { readonly kind: 'agent'; readonly name: string };

/**
 * The admin API (ADR 0088). Every procedure answers 404 while no Власник
 * exists. A procedure declares whether it writes content: only those take
 * an Агент token; every other one refuses it.
 */
export function adminProcedures(admin: AdminAccess, contentWrites: ContentWrites) {
  const os = implement(apiContract.admin).$context<{ headers: Headers }>();

  /** Admits the caller to a procedure, or throws the refusal the contract lists. */
  async function admit(
    headers: Headers,
    errors: { NOT_FOUND: () => Error; UNAUTHORIZED: () => Error; FORBIDDEN: () => Error },
    { writesContent }: { writesContent: boolean },
  ): Promise<AdminCaller> {
    if (!(await admin.isOn())) throw errors.NOT_FOUND();
    const token = bearerOf(headers);
    if (token === undefined) return { kind: 'anonymous' };
    const name = await admin.agentOf(token);
    if (name === undefined) throw errors.UNAUTHORIZED();
    if (!writesContent) throw errors.FORBIDDEN();
    return { kind: 'agent', name };
  }

  /** The Агент a content procedure is called by; until admin sessions exist, no one else writes content. */
  async function writerOf(
    headers: Headers,
    errors: { NOT_FOUND: () => Error; UNAUTHORIZED: () => Error },
  ) {
    if (!(await admin.isOn())) throw errors.NOT_FOUND();
    const token = bearerOf(headers);
    const name = token === undefined ? undefined : await admin.agentOf(token);
    if (name === undefined) throw errors.UNAUTHORIZED();
    return { name };
  }

  /** The refusal the contract lists for what the content store refused. */
  function refusalOf(
    refusal: WriteRefusal,
    errors: {
      NOT_FOUND: () => Error;
      NOT_IMPORTED: () => Error;
      REFUSED?: (options: {
        data: { refusals: { rule: string; message: string; entryId?: string; field?: string }[] };
      }) => Error;
      STALE?: (options: { data: { currentVersion: number } }) => Error;
    },
  ): Error {
    switch (refusal.reason) {
      case 'not-found':
        return errors.NOT_FOUND();
      case 'not-imported':
        return errors.NOT_IMPORTED();
      case 'refused': {
        const refusals = refusal.refusals.map(({ rule, entryId, field, message }) => ({
          rule,
          message,
          ...(entryId === undefined ? {} : { entryId }),
          ...(field === undefined ? {} : { field }),
        }));
        if (errors.REFUSED === undefined) throw new Error('a flag is never refused by a rule');
        return errors.REFUSED({ data: { refusals } });
      }
      case 'stale':
        if (errors.STALE === undefined) throw new Error('a flag is never stale');
        return errors.STALE({ data: { currentVersion: refusal.currentVersion } });
    }
  }

  const content = os.content;
  return os.router({
    status: os.status.handler(async ({ context, errors }) => {
      await admit(context.headers, errors, { writesContent: false });
      return { on: true as const };
    }),
    content: {
      openBatch: content.openBatch.handler(async ({ context, input, errors }) => {
        const writer = await writerOf(context.headers, errors);
        const opened = await contentWrites.openBatch(writer, input.editionId);
        if (!opened.ok) throw refusalOf(opened, errors);
        return { batchId: opened.batchId };
      }),
      create: content.create.handler(async ({ context, input, errors }) => {
        const writer = await writerOf(context.headers, errors);
        const { fields, ...write } = input;
        const written = await contentWrites.write(writer, {
          ...write,
          change: { op: 'create', fields },
        });
        if (!written.ok) throw refusalOf(written, errors);
        return written.written;
      }),
      edit: content.edit.handler(async ({ context, input, errors }) => {
        const writer = await writerOf(context.headers, errors);
        const { id, recordVersion, fields, ...write } = input;
        const written = await contentWrites.write(writer, {
          ...write,
          change: { op: 'edit', id, recordVersion, fields },
        });
        if (!written.ok) throw refusalOf(written, errors);
        return written.written;
      }),
      retire: content.retire.handler(async ({ context, input, errors }) => {
        const writer = await writerOf(context.headers, errors);
        const { id, recordVersion, ...write } = input;
        const written = await contentWrites.write(writer, {
          ...write,
          change: { op: 'retire', id, recordVersion },
        });
        if (!written.ok) throw refusalOf(written, errors);
        return written.written;
      }),
      flag: content.flag.handler(async ({ context, input, errors }) => {
        const writer = await writerOf(context.headers, errors);
        const flagged = await contentWrites.flag(writer, input);
        if (!flagged.ok) throw refusalOf(flagged, errors);
        return { id: input.id, batchId: input.batchId };
      }),
      report: content.report.handler(async ({ context, input, errors }) => {
        await writerOf(context.headers, errors);
        const reported = await contentWrites.report(input.editionId);
        if (!reported.ok) throw refusalOf(reported, errors);
        const { ok: _ok, ...report } = reported;
        return report;
      }),
    },
  });
}
