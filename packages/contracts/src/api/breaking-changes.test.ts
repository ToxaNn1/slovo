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

  it('breaks a field added to a strict output, which an app would refuse', async () => {
    const before = thingContract({ output: z.strictObject({ id: z.string() }) });
    const after = thingContract({ output: z.strictObject({ id: z.string(), size: z.number() }) });

    expect(await changesFrom(before, after)).toEqual([
      'POST /v1/things: 200 body.size is new in a strict object',
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

  it('breaks nothing when an admin input narrows, but still breaks an admin output', async () => {
    const before = thingContract({
      path: '/admin/things',
      input: z.object({ name: z.string(), reason: z.string() }),
    });
    const after = thingContract({
      path: '/admin/things',
      input: z.strictObject({ name: z.string().max(10), reason: z.string().max(500) }),
      output: z.object({ id: z.string() }),
    });

    expect(await changesFrom(before, after)).toEqual([
      'POST /v1/admin/things: 200 body.size is gone',
    ]);
  });

  it('breaks nothing when an admin strict output grows, but breaks an app one that grows', async () => {
    const output = (path: `/${string}`, shape: z.ZodRawShape) =>
      thingContract({ path, output: z.strictObject(shape) });

    expect(
      await changesFrom(
        output('/admin/things', { id: z.string() }),
        output('/admin/things', { id: z.string(), size: z.number() }),
      ),
    ).toEqual([]);
    expect(
      await changesFrom(
        output('/things', { id: z.string() }),
        output('/things', { id: z.string(), size: z.number() }),
      ),
    ).toEqual(['POST /v1/things: 200 body.size is new in a strict object']);
  });

  it('breaks nothing when a retired Feature Switch leaves an admin `states`, but breaks an app one', async () => {
    const output = (path: `/${string}`, shape: z.ZodRawShape) =>
      thingContract({ path, output: z.object({ states: z.object(shape), size: z.number() }) });
    const before = { feed: z.string(), tracedCrossword: z.string() };
    const after = { feed: z.string() };

    expect(
      await changesFrom(output('/admin/things', before), output('/admin/things', after)),
    ).toEqual([]);
    expect(await changesFrom(output('/things', before), output('/things', after))).toEqual([
      'POST /v1/things: 200 body.states.tracedCrossword is gone',
    ]);
  });

  it('breaks nothing when an admin procedure goes, but breaks an app one that goes', async () => {
    const empty = oc.prefix('/v1').router({});

    expect(await changesFrom(thingContract({ path: '/admin/things' }), empty)).toEqual([]);
    expect(await changesFrom(thingContract(), empty)).toEqual(['POST /v1/things is gone']);
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

/** A description of one operation, `POST /v1/things`. */
function describing(operation: object) {
  return { paths: { '/v1/things': { post: operation } } };
}

/** An operation that answers `schema` as its 200 JSON body. */
function answering(schema: object) {
  return describing({ responses: { 200: { content: { 'application/json': { schema } } } } });
}

/** An operation that takes `schema` as its JSON request body. */
function taking(schema: object) {
  return describing({ requestBody: { content: { 'application/json': { schema } } } });
}

/** An operation that takes the parameters. */
function withParameters(...parameters: object[]) {
  return describing({ parameters });
}

/** The query parameter `q`, a string. */
function query(extra: object = {}) {
  return { in: 'query', name: 'q', schema: { type: 'string' }, ...extra };
}

/** An operation that answers 304 with the header `etag`. */
function answeringEtag(header: object) {
  return describing({ responses: { 304: { headers: { etag: header } } } });
}

const AT = 'POST /v1/things: ';
const STRING = { type: 'string' };
const NUMBER = { type: 'number' };
const objectOf = (properties: object) => ({ type: 'object', properties });

describe('a change of the description', () => {
  it('lets an input bound widen, but breaks one that narrows or is new', () => {
    const before = taking({ ...STRING, minLength: 2, maxLength: 10 });

    expect(breakingChanges(before, taking({ ...STRING, minLength: 1, maxLength: 20 }))).toEqual([]);
    expect(breakingChanges(before, taking(STRING))).toEqual([]);
    expect(breakingChanges(before, taking({ ...STRING, minLength: 3, maxLength: 5 }))).toEqual([
      `${AT}request body changes its minLength from 2 to 3`,
      `${AT}request body changes its maxLength from 10 to 5`,
    ]);
    expect(breakingChanges(taking(STRING), taking({ ...STRING, maxLength: 10 }))).toEqual([
      `${AT}request body changes its maxLength from none to 10`,
    ]);
  });

  it('lets an output bound narrow, but breaks one that widens', () => {
    const before = answering({ ...STRING, minLength: 2, maxLength: 10 });

    expect(breakingChanges(before, answering({ ...STRING, minLength: 3, maxLength: 5 }))).toEqual(
      [],
    );
    expect(breakingChanges(before, answering({ ...STRING, minLength: 1, maxLength: 20 }))).toEqual([
      `${AT}200 body changes its minLength from 2 to 1`,
      `${AT}200 body changes its maxLength from 10 to 20`,
    ]);
  });

  it('breaks a new input default, but not a changed output one', () => {
    expect(breakingChanges(taking(STRING), taking({ ...STRING, default: 'a' }))).toEqual([
      `${AT}request body changes its default from none to "a"`,
    ]);
    expect(
      breakingChanges(
        answering({ ...STRING, default: 'a' }),
        answering({ ...STRING, default: 'b' }),
      ),
    ).toEqual([]);
  });

  it('breaks a list of types that grows, which only an enum may', () => {
    expect(
      breakingChanges(
        taking({ type: ['string', 'null'] }),
        taking({ type: ['string', 'null', 'number'] }),
      ),
    ).toEqual([
      `${AT}request body changes its type from ["string","null"] to ["string","null","number"]`,
    ]);
  });

  it('breaks nothing when an output was any value, or an input becomes any value', () => {
    const union = { anyOf: [STRING, NUMBER] };

    expect(breakingChanges(answering({}), answering(union))).toEqual([]);
    expect(breakingChanges(answering({ description: 'Anything' }), answering(union))).toEqual([]);
    expect(breakingChanges(taking(union), taking({}))).toEqual([]);
  });

  it('breaks an input union that becomes one of its variants, but not one that gains a kind', () => {
    expect(breakingChanges(taking({ anyOf: [STRING, NUMBER] }), taking(STRING))).toEqual([
      `${AT}request body may no longer be number`,
    ]);
    expect(
      breakingChanges(
        taking({ anyOf: [STRING, NUMBER] }),
        taking({ anyOf: [STRING, NUMBER, { type: 'boolean' }] }),
      ),
    ).toEqual([]);
    expect(
      breakingChanges(taking({ anyOf: [{ const: 'a' }, { const: 'b' }] }), taking({ const: 'a' })),
    ).toEqual([`${AT}request body may no longer be "b"`]);
  });

  it('reads the variants of a union that match by kind as schemas of their own', () => {
    expect(
      breakingChanges(
        answering({ anyOf: [{ ...STRING, maxLength: 5 }, NUMBER] }),
        answering({ anyOf: [{ ...STRING, maxLength: 10 }, NUMBER] }),
      ),
    ).toEqual([`${AT}200 body changes its maxLength from 5 to 10`]);
  });

  it('breaks a union whose variants of one kind change, which can not be told apart', () => {
    const twins = { anyOf: [objectOf({ a: STRING }), objectOf({ b: STRING })] };
    const others = { anyOf: [objectOf({ a: STRING }), objectOf({ c: STRING })] };
    const distinct = { anyOf: [STRING, NUMBER] };

    expect(breakingChanges(answering(twins), answering(twins))).toEqual([]);
    expect(breakingChanges(answering(twins), answering(others))).toEqual([
      `${AT}200 body changes its variants`,
    ]);
    expect(breakingChanges(answering(distinct), answering(twins))).toEqual([
      `${AT}200 body changes its variants`,
    ]);
    expect(breakingChanges(answering(twins), answering(distinct))).toEqual([
      `${AT}200 body changes its variants`,
    ]);
  });

  it('lets an input field go from an object that takes unknown fields', () => {
    expect(breakingChanges(taking(objectOf({ a: STRING })), taking(objectOf({})))).toEqual([]);
  });

  it('breaks an input object that becomes strict, but not an output one', () => {
    const strict = { ...objectOf({ a: STRING }), additionalProperties: false };

    expect(breakingChanges(taking(objectOf({ a: STRING })), taking(strict))).toEqual([
      `${AT}request body no longer accepts unknown fields`,
    ]);
    expect(breakingChanges(answering(objectOf({ a: STRING })), answering(strict))).toEqual([]);
  });

  it('reads the values of a record and the items of a list as schemas of their own', () => {
    const record = (values: object) => ({ type: 'object', additionalProperties: values });
    const list = (items?: object) => ({ type: 'array', ...(items === undefined ? {} : { items }) });

    expect(breakingChanges(answering(record(STRING)), answering(record(NUMBER)))).toEqual([
      `${AT}200 body.* changes its type from "string" to "number"`,
    ]);
    expect(breakingChanges(answering(list(STRING)), answering(list(NUMBER)))).toEqual([
      `${AT}200 body[] changes its type from "string" to "number"`,
    ]);
    expect(breakingChanges(answering(list(STRING)), answering(list()))).toEqual([
      `${AT}200 body[] changes its type from "string" to none`,
    ]);
  });

  it('breaks a parameter that goes, changes how it travels or narrows', () => {
    const before = withParameters(query({ style: 'form', schema: { ...STRING, maxLength: 10 } }));

    expect(breakingChanges(before, withParameters())).toEqual([
      `${AT}query q is no longer accepted`,
    ]);
    expect(
      breakingChanges(
        before,
        withParameters(query({ style: 'deepObject', schema: { ...STRING, maxLength: 5 } })),
      ),
    ).toEqual([
      `${AT}query q changes its style from "form" to "deepObject"`,
      `${AT}query q changes its maxLength from 10 to 5`,
    ]);
    expect(
      breakingChanges(
        before,
        withParameters(query({ style: 'form', description: 'A query', schema: { ...STRING } })),
      ),
    ).toEqual([]);
  });

  it('breaks a parameter that becomes required, but not one that stays or stops being required', () => {
    const required = withParameters(query({ required: true }));

    expect(breakingChanges(withParameters(), withParameters(query()))).toEqual([]);
    expect(breakingChanges(withParameters(), required)).toEqual([`${AT}query q is now required`]);
    expect(breakingChanges(withParameters(query()), required)).toEqual([
      `${AT}query q is now required`,
    ]);
    expect(breakingChanges(required, required)).toEqual([]);
    expect(breakingChanges(required, withParameters(query()))).toEqual([]);
  });

  it('breaks a request body that becomes required or is no longer taken as JSON', () => {
    const body = (requestBody: object) => describing({ requestBody });
    const json = { 'application/json': { schema: {} } };

    expect(
      breakingChanges(body({ content: json }), body({ required: true, content: json })),
    ).toEqual([`${AT}request body is now required`]);
    expect(
      breakingChanges(
        body({ required: true, content: json }),
        body({ required: true, content: json }),
      ),
    ).toEqual([]);
    expect(breakingChanges(body({ content: json }), body({ content: {} }))).toEqual([
      `${AT}request body is no longer accepted as application/json`,
    ]);
  });

  it('breaks an answer header that goes, may now be missing or changes', () => {
    const etag = answeringEtag({ required: true, schema: STRING });

    expect(breakingChanges(etag, etag)).toEqual([]);
    expect(breakingChanges(etag, describing({ responses: { 304: {} } }))).toEqual([
      `${AT}304 header etag is gone`,
    ]);
    expect(breakingChanges(etag, answeringEtag({ schema: STRING }))).toEqual([
      `${AT}304 header etag may now be missing`,
    ]);
    expect(breakingChanges(etag, answeringEtag({ required: true, schema: NUMBER }))).toEqual([
      `${AT}304 header etag changes its type from "string" to "number"`,
    ]);
  });

  it('breaks an answer that changes its media types or its successful statuses', () => {
    const answers = (responses: object) => describing({ responses });

    expect(breakingChanges(answering(STRING), answers({ 200: { content: {} } }))).toEqual([
      `${AT}200 no longer answers application/json`,
    ]);
    expect(
      breakingChanges(
        answering(STRING),
        answers({ 200: { content: { 'application/json': { schema: STRING }, 'text/plain': {} } } }),
      ),
    ).toEqual([`${AT}200 may now answer text/plain`]);
    expect(breakingChanges(answers({ 200: {}, 304: {} }), answers({ 200: {} }))).toEqual([
      `${AT}no longer answers 304`,
    ]);
    expect(breakingChanges(answers({ 200: {} }), answers({ 200: {}, 304: {} }))).toEqual([
      `${AT}may now answer 304`,
    ]);
    expect(breakingChanges(answers({ 200: {} }), answers({ 200: {}, 404: {} }))).toEqual([]);
  });

  it('breaks an input default that goes, which changes what a request without the field means', () => {
    expect(breakingChanges(taking({ ...STRING, default: 'a' }), taking(STRING))).toEqual([
      `${AT}request body changes its default from "a" to none`,
    ]);
  });

  it('breaks an input that took any value and now takes a type', () => {
    expect(breakingChanges(taking({}), taking(STRING))).toEqual([
      `${AT}request body changes its type from none to "string"`,
    ]);
  });

  it('reads an output schema with only a default as any value', () => {
    expect(
      breakingChanges(answering({ default: 'a' }), answering({ anyOf: [STRING, NUMBER] })),
    ).toEqual([]);
  });

  it('lets an output union lose a kind', () => {
    expect(breakingChanges(answering({ anyOf: [STRING, NUMBER] }), answering(STRING))).toEqual([]);
  });

  it('lets an input object take unknown fields of any value, but breaks one that narrows them', () => {
    const before = taking(objectOf({ a: STRING }));
    const others = (additionalProperties: unknown) =>
      taking({ ...objectOf({ a: STRING }), additionalProperties });

    expect(breakingChanges(before, others(true))).toEqual([]);
    expect(breakingChanges(before, others({}))).toEqual([]);
    expect(breakingChanges(before, others(STRING))).toEqual([
      `${AT}request body no longer accepts unknown fields`,
    ]);
  });

  it('breaks the values of an output record that may now be any value', () => {
    const record = (additionalProperties?: unknown) =>
      answering({
        type: 'object',
        ...(additionalProperties === undefined ? {} : { additionalProperties }),
      });
    const change = `${AT}200 body.* changes its type from "string" to none`;

    expect(breakingChanges(record(STRING), record())).toEqual([change]);
    expect(breakingChanges(record(STRING), record(true))).toEqual([change]);
    expect(breakingChanges(record(STRING), record(false))).toEqual([]);
    expect(
      breakingChanges(
        taking({ type: 'object', additionalProperties: STRING }),
        taking({ type: 'object' }),
      ),
    ).toEqual([]);
  });

  it('reads an answer header as an output: an optional one may stay so, and its schema may narrow', () => {
    const header = (extra: object) => answeringEtag({ schema: { ...STRING, ...extra } });

    expect(breakingChanges(header({}), header({}))).toEqual([]);
    expect(breakingChanges(header({ maxLength: 10 }), header({ maxLength: 5 }))).toEqual([]);
  });
});
