import { readFileSync } from 'node:fs';

import { oc, type AnyContractRouter } from '@orpc/contract';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { COMMITTED_DESCRIPTION, describeApi } from '../api-description';
import { breakingChanges } from './breaking-changes';
import { procedure } from './procedure';

/** What a change of the contract from `before` to `after` breaks for an app in the field. */
async function changesFrom(before: AnyContractRouter, after: AnyContractRouter) {
  return breakingChanges(await describeApi(before), await describeApi(after));
}

/** A contract of one procedure, `POST /v1/things`, built from its parts. */
function thingContract({
  input = z.strictObject({ name: z.string() }),
  output = z.object({ id: z.string(), size: z.number() }),
  errors = { NOT_FOUND: { message: 'Not found' } },
  path = '/things',
}: {
  input?: z.ZodType;
  output?: z.ZodType;
  errors?: Record<string, { message: string; status?: number; data?: z.ZodType }>;
  path?: `/${string}`;
} = {}) {
  return oc.prefix('/v1').router({
    thing: procedure.route({ method: 'POST', path }).errors(errors).input(input).output(output),
  });
}

describe('a change of the contract', () => {
  it('breaks nothing when the description stays the same', async () => {
    expect(await changesFrom(thingContract(), thingContract())).toEqual([]);
  });

  it('breaks nothing when it only adds', async () => {
    const after = oc.prefix('/v1').router({
      thing: procedure
        .route({ method: 'POST', path: '/things', summary: 'A thing, now described' })
        .errors({
          NOT_FOUND: { message: 'Not found' },
          CONFLICT: { message: 'Taken' },
        })
        .input(z.strictObject({ name: z.string(), colour: z.string().optional() }))
        .output(z.object({ id: z.string(), size: z.number(), colour: z.string() })),
      other: procedure.route({ method: 'GET', path: '/others' }).output(z.object({})),
    });

    expect(await changesFrom(thingContract(), after)).toEqual([]);
  });

  it('breaks a removed procedure', async () => {
    const after = oc.prefix('/v1').router({});

    expect(await changesFrom(thingContract(), after)).toEqual(['POST /v1/things is gone']);
  });

  it('breaks a procedure moved to another path', async () => {
    expect(await changesFrom(thingContract(), thingContract({ path: '/items' }))).toEqual([
      'POST /v1/things is gone',
    ]);
  });

  it('breaks a removed output field', async () => {
    const after = thingContract({ output: z.object({ id: z.string() }) });

    expect(await changesFrom(thingContract(), after)).toEqual([
      'POST /v1/things: 200 body.size is gone',
    ]);
  });

  it('breaks a renamed output field', async () => {
    const after = thingContract({ output: z.object({ id: z.string(), length: z.number() }) });

    expect(await changesFrom(thingContract(), after)).toEqual([
      'POST /v1/things: 200 body.size is gone',
    ]);
  });

  it('breaks an output field that may now be missing or null', async () => {
    const after = thingContract({
      output: z.object({ id: z.string().optional(), size: z.number().nullable() }),
    });

    expect(await changesFrom(thingContract(), after)).toEqual([
      'POST /v1/things: 200 body.size may now be null',
      'POST /v1/things: 200 body.id may now be missing',
    ]);
  });

  it('breaks a new required input field, or an optional one that becomes required', async () => {
    const before = thingContract({
      input: z.strictObject({ name: z.string(), colour: z.string().optional() }),
    });
    const after = thingContract({
      input: z.strictObject({ name: z.string(), colour: z.string(), size: z.number() }),
    });

    expect(await changesFrom(before, after)).toEqual([
      'POST /v1/things: request body.colour is now required',
      'POST /v1/things: request body.size is now required',
    ]);
  });

  it('breaks an input field that is no longer accepted', async () => {
    const after = thingContract({ input: z.strictObject({}) });

    expect(await changesFrom(thingContract(), after)).toEqual([
      'POST /v1/things: request body.name is no longer accepted',
    ]);
  });

  it('breaks a type that narrows', async () => {
    const after = thingContract({ input: z.strictObject({ name: z.string().max(10) }) });

    expect(await changesFrom(thingContract(), after)).toEqual([
      'POST /v1/things: request body.name changes its maxLength from none to 10',
    ]);
  });

  it('breaks nothing when an input widens or an output narrows', async () => {
    const before = thingContract({
      input: z.strictObject({ name: z.string().max(10), kind: z.enum(['word']) }),
      output: z.object({ id: z.string(), size: z.number() }),
    });
    const after = thingContract({
      input: z.strictObject({ name: z.string().max(20), kind: z.enum(['word', 'phrase']) }),
      output: z.object({ id: z.string().min(1), size: z.number().max(100) }),
    });

    expect(await changesFrom(before, after)).toEqual([]);
  });

  it('breaks an input enum that loses a value, or an output one that gains a value', async () => {
    const before = thingContract({
      input: z.strictObject({ kind: z.enum(['word', 'phrase']) }),
      output: z.object({ kind: z.enum(['word']) }),
    });
    const after = thingContract({
      input: z.strictObject({ kind: z.enum(['word']) }),
      output: z.object({ kind: z.enum(['word', 'phrase']) }),
    });

    expect(await changesFrom(before, after)).toEqual([
      'POST /v1/things: request body.kind changes its enum from ["word","phrase"] to ["word"]',
      'POST /v1/things: 200 body.kind changes its enum from ["word"] to ["word","phrase"]',
    ]);
  });

  it('tells apart the variants of an output union by their constant fields', async () => {
    const variant = (kind: string, fields: z.ZodRawShape = {}) =>
      z.object({ kind: z.literal(kind), ...fields });
    const before = thingContract({
      output: z.discriminatedUnion('kind', [variant('word'), variant('phrase')]),
    });
    const grown = thingContract({
      output: z.discriminatedUnion('kind', [
        variant('word', { size: z.number() }),
        variant('phrase'),
      ]),
    });
    const wider = thingContract({
      output: z.discriminatedUnion('kind', [variant('word'), variant('phrase'), variant('idiom')]),
    });

    expect(await changesFrom(before, grown)).toEqual([]);
    expect(await changesFrom(before, wider)).toEqual([
      'POST /v1/things: 200 body may now be object with kind="idiom"',
    ]);
  });

  it('breaks a removed error code', async () => {
    const after = thingContract({ errors: {} });

    expect(await changesFrom(thingContract(), after)).toEqual([
      'POST /v1/things: no longer answers NOT_FOUND',
    ]);
  });

  it('breaks an error code that changes its status or loses a field of its data', async () => {
    const before = thingContract({
      errors: {
        NOT_FOUND: { message: 'Not found' },
        WRONG: { status: 400, message: 'Wrong', data: z.object({ triesLeft: z.number() }) },
      },
    });
    const after = thingContract({
      errors: {
        NOT_FOUND: { status: 410, message: 'Not found' },
        WRONG: { status: 400, message: 'Wrong', data: z.object({}) },
      },
    });

    expect(await changesFrom(before, after)).toEqual([
      'POST /v1/things: WRONG.data.triesLeft is gone',
      'POST /v1/things: NOT_FOUND.status changes its const from 404 to 410',
    ]);
  });
});

describe('the committed description of /v1', () => {
  const committed = JSON.parse(readFileSync(COMMITTED_DESCRIPTION, 'utf8')) as object;

  it('is broken by no change of the contract', async () => {
    expect(breakingChanges(committed, await describeApi())).toEqual([]);
  });

  it('is the description of the contract; `pnpm describe:api` records an addition', async () => {
    expect(await describeApi()).toEqual(committed);
  });
});
