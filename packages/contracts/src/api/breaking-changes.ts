/** A part of an OpenAPI description, read loosely: the rule reads only what it knows. */
type Part = Record<string, unknown>;

/**
 * Which way a schema is read. An app sends `input`, so it may only widen: a
 * request the old schema took is still taken. The backend answers `output`,
 * so it may only narrow: an answer the old schema allowed is all an app may get.
 */
type Direction = 'input' | 'output';

/** Words for the reader of the description that change nothing on the wire. */
const NOTES = ['description', 'summary', 'title', 'examples', 'deprecated'];

/** The keys of a schema that hold other schemas; the rule walks them itself. */
const NESTED = ['properties', 'required', 'additionalProperties', 'items', 'anyOf', 'oneOf'];

function part(value: unknown): Part {
  return typeof value === 'object' && value !== null ? (value as Part) : {};
}

function names(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((name) => typeof name === 'string') : [];
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Bounds a value stays under, and bounds it stays over. */
const UPPER_BOUNDS = ['maximum', 'exclusiveMaximum', 'maxLength', 'maxItems', 'maxProperties'];
const LOWER_BOUNDS = ['minimum', 'exclusiveMinimum', 'minLength', 'minItems', 'minProperties'];

/** Whether a constraint that goes from `before` to `after` only widens: takes every value it took. */
function widens(key: string, before: unknown, after: unknown): boolean {
  // A default fills a missing input, so a new one changes what a request means.
  if (key === 'default') return false;
  if (after === undefined) return true;
  if (typeof before === 'number' && typeof after === 'number') {
    if (UPPER_BOUNDS.includes(key)) return after >= before;
    if (LOWER_BOUNDS.includes(key)) return after <= before;
  }
  if (key === 'enum' && Array.isArray(before) && Array.isArray(after)) {
    return before.every((value) => after.some((other) => same(value, other)));
  }
  return false;
}

function shown(value: unknown): string {
  return value === undefined ? 'none' : JSON.stringify(value);
}

/** The keys of a schema that constrain a value, beyond those the rule walks. */
function constraints(schema: Part, direction: Direction): string[] {
  // A default only fills a missing input; in an answer it is a note.
  const ignored = direction === 'output' ? [...NOTES, 'default'] : NOTES;
  return Object.keys(schema).filter((key) => !ignored.includes(key) && !NESTED.includes(key));
}

/** A schema that takes any value: `{}`, or one with only notes. */
function takesAnything(schema: Part): boolean {
  return constraints(schema, 'output').length === 0 && NESTED.every((key) => !(key in schema));
}

/** The values a schema allows, one schema per kind: its union, or itself. */
function variants(schema: Part): Part[] {
  const union = schema['anyOf'] ?? schema['oneOf'];
  return Array.isArray(union) ? union.map(part) : [schema];
}

/**
 * What tells one variant of a union from another: its constant, or its type
 * and the constant fields that tell it apart, such as `object with status=200`.
 */
function kind(schema: Part): string {
  if ('const' in schema) return JSON.stringify(schema['const']);
  const type = typeof schema['type'] === 'string' ? schema['type'] : JSON.stringify(schema);
  const constants = Object.entries(part(schema['properties']))
    .filter(([, field]) => 'const' in part(field))
    .map(([name, field]) => `${name}=${JSON.stringify(part(field)['const'])}`);
  return constants.length > 0 ? `${type} with ${constants.join(', ')}` : type;
}

/** Whether a schema's `additionalProperties` takes any unknown field. */
function takesOthers(others: unknown): boolean {
  return (
    others === undefined ||
    others === true ||
    (typeof others === 'object' && takesAnything(part(others)))
  );
}

/** Every way the `described` schema breaks the `promised` one, read in `direction`. */
function schemaChanges(
  promised: Part,
  described: Part,
  direction: Direction,
  at: string,
): string[] {
  if (direction === 'output' && takesAnything(promised)) return [];
  if (direction === 'input' && takesAnything(described)) return [];

  const before = variants(promised);
  const after = variants(described);
  if (before.length > 1 || after.length > 1) {
    return unionChanges(before, after, direction, at);
  }

  const changes: string[] = [];
  const keys = new Set([...constraints(promised, direction), ...constraints(described, direction)]);
  for (const key of keys) {
    const before = promised[key];
    const after = described[key];
    if (same(before, after)) continue;
    const holds = direction === 'input' ? widens(key, before, after) : widens(key, after, before);
    if (!holds) changes.push(`${at} changes its ${key} from ${shown(before)} to ${shown(after)}`);
  }

  const promisedFields = part(promised['properties']);
  const describedFields = part(described['properties']);
  for (const [name, schema] of Object.entries(promisedFields)) {
    if (!(name in describedFields)) {
      // An input field may go only where any field is taken.
      if (direction === 'output') changes.push(`${at}.${name} is gone`);
      else if (described['additionalProperties'] === false) {
        changes.push(`${at}.${name} is no longer accepted`);
      }
      continue;
    }
    changes.push(
      ...schemaChanges(part(schema), part(describedFields[name]), direction, `${at}.${name}`),
    );
  }

  const promisedRequired = names(promised['required']);
  const describedRequired = names(described['required']);
  if (direction === 'output') {
    for (const name of promisedRequired) {
      if (name in describedFields && !describedRequired.includes(name)) {
        changes.push(`${at}.${name} may now be missing`);
      }
    }
  } else {
    for (const name of describedRequired) {
      if (!promisedRequired.includes(name)) changes.push(`${at}.${name} is now required`);
    }
  }

  const promisedOthers = promised['additionalProperties'];
  const describedOthers = described['additionalProperties'];
  if (typeof promisedOthers === 'object' && typeof describedOthers === 'object') {
    changes.push(
      ...schemaChanges(part(promisedOthers), part(describedOthers), direction, `${at}.*`),
    );
  } else if (direction === 'input' && promisedOthers !== false && !takesOthers(describedOthers)) {
    changes.push(`${at} no longer accepts unknown fields`);
  }

  if ('items' in promised || 'items' in described) {
    changes.push(
      ...schemaChanges(part(promised['items']), part(described['items']), direction, `${at}[]`),
    );
  }
  return changes;
}

/**
 * The changes of a union, its variants matched by kind: an input may gain
 * kinds, an output may lose them.
 */
function unionChanges(before: Part[], after: Part[], direction: Direction, at: string): string[] {
  const beforeKinds = new Map(before.map((schema) => [kind(schema), schema]));
  const afterKinds = new Map(after.map((schema) => [kind(schema), schema]));
  // Variants of one kind can't be told apart: the union holds as it is, or breaks.
  if (beforeKinds.size < before.length || afterKinds.size < after.length) {
    return same(before, after) ? [] : [`${at} changes its variants`];
  }
  const changes: string[] = [];
  for (const [name, schema] of beforeKinds) {
    const match = afterKinds.get(name);
    if (match) changes.push(...schemaChanges(schema, match, direction, at));
    else if (direction === 'input') changes.push(`${at} may no longer be ${name}`);
  }
  if (direction === 'output') {
    for (const name of afterKinds.keys()) {
      if (!beforeKinds.has(name)) changes.push(`${at} may now be ${name}`);
    }
  }
  return changes;
}

/** The parameters of an operation, by where they travel and their name, such as `query packFormat`. */
function parameters(operation: Part): Map<string, Part> {
  const list = Array.isArray(operation['parameters']) ? operation['parameters'].map(part) : [];
  return new Map(
    list.map((parameter) => [`${String(parameter['in'])} ${String(parameter['name'])}`, parameter]),
  );
}

/** Every way an operation's request breaks what an app sends. */
function requestChanges(promised: Part, described: Part): string[] {
  const changes: string[] = [];
  const before = parameters(promised);
  const after = parameters(described);
  for (const [name, parameter] of before) {
    const match = after.get(name);
    if (!match) {
      changes.push(`${name} is no longer accepted`);
      continue;
    }
    const { schema, required: _required, ...rest } = parameter;
    const { schema: matchSchema, required: _matchRequired, ...matchRest } = match;
    for (const key of new Set([...Object.keys(rest), ...Object.keys(matchRest)])) {
      if (!NOTES.includes(key) && !same(rest[key], matchRest[key])) {
        changes.push(
          `${name} changes its ${key} from ${shown(rest[key])} to ${shown(matchRest[key])}`,
        );
      }
    }
    changes.push(...schemaChanges(part(schema), part(matchSchema), 'input', name));
  }
  for (const [name, parameter] of after) {
    if (parameter['required'] === true && before.get(name)?.['required'] !== true) {
      changes.push(`${name} is now required`);
    }
  }

  const body = part(promised['requestBody']);
  const describedBody = part(described['requestBody']);
  if (describedBody['required'] === true && body['required'] !== true) {
    changes.push('request body is now required');
  }
  const describedContent = part(describedBody['content']);
  for (const [type, content] of Object.entries(part(body['content']))) {
    const match = describedContent[type];
    if (!match) changes.push(`request body is no longer accepted as ${type}`);
    else {
      changes.push(
        ...schemaChanges(
          part(part(content)['schema']),
          part(part(match)['schema']),
          'input',
          'request body',
        ),
      );
    }
  }
  return changes;
}

/** Whether a response status is an error, which answers a contract code. */
function isError(status: string): boolean {
  return Number(status) >= 400;
}

/** Every way a successful answer, `200` or `304`, breaks what an app reads. */
function answerChanges(status: string, promised: Part, described: Part): string[] {
  const changes: string[] = [];
  const describedHeaders = part(described['headers']);
  for (const [name, header] of Object.entries(part(promised['headers']))) {
    const match = part(describedHeaders[name]);
    if (!(name in describedHeaders)) changes.push(`${status} header ${name} is gone`);
    else {
      if (part(header)['required'] === true && match['required'] !== true) {
        changes.push(`${status} header ${name} may now be missing`);
      }
      changes.push(
        ...schemaChanges(
          part(part(header)['schema']),
          part(match['schema']),
          'output',
          `${status} header ${name}`,
        ),
      );
    }
  }
  const promisedContent = part(promised['content']);
  const describedContent = part(described['content']);
  for (const [type, content] of Object.entries(promisedContent)) {
    const match = describedContent[type];
    if (!match) changes.push(`${status} no longer answers ${type}`);
    else {
      changes.push(
        ...schemaChanges(
          part(part(content)['schema']),
          part(part(match)['schema']),
          'output',
          `${status} body`,
        ),
      );
    }
  }
  for (const type of Object.keys(describedContent)) {
    if (!(type in promisedContent)) changes.push(`${status} may now answer ${type}`);
  }
  return changes;
}

/** The error codes an operation answers, each with the schema of its body, whatever its status. */
function errorCodes(responses: Part): Map<string, Part> {
  const codes = new Map<string, Part>();
  for (const [status, response] of Object.entries(responses)) {
    if (!isError(status)) continue;
    for (const content of Object.values(part(part(response)['content']))) {
      for (const variant of variants(part(part(content)['schema']))) {
        const fields = part(variant['properties']);
        // The contract's codes are `defined`; the other variant is any error at all.
        if (part(fields['defined'])['const'] !== true) continue;
        const code = part(fields['code'])['const'];
        if (typeof code === 'string') codes.set(code, variant);
      }
    }
  }
  return codes;
}

/** Every way an operation's answers break what an app reads. */
function responseChanges(promised: Part, described: Part): string[] {
  const changes: string[] = [];
  const before = part(promised['responses']);
  const after = part(described['responses']);
  for (const [status, response] of Object.entries(before)) {
    if (isError(status)) continue;
    if (!(status in after)) changes.push(`no longer answers ${status}`);
    else changes.push(...answerChanges(status, part(response), part(after[status])));
  }
  for (const status of Object.keys(after)) {
    if (!isError(status) && !(status in before)) changes.push(`may now answer ${status}`);
  }
  const describedCodes = errorCodes(after);
  for (const [code, schema] of errorCodes(before)) {
    const match = describedCodes.get(code);
    if (!match) changes.push(`no longer answers ${code}`);
    else changes.push(...schemaChanges(schema, match, 'output', code));
  }
  return changes;
}

/**
 * Every way the `described` API breaks the `promised` one for an app in the
 * field, as lines such as `GET /v1/account/me: 200 body.email is gone`; none
 * when it only adds. A procedure, an output field, an input an app sent, a
 * successful answer and an error code stay, nothing optional becomes
 * required, and no type or constraint changes, save an input bound or enum
 * that widens and an output one that narrows (ADR 0031).
 */
export function breakingChanges(promised: object, described: object): string[] {
  const changes: string[] = [];
  const describedPaths = part(part(described)['paths']);
  for (const [path, operations] of Object.entries(part(part(promised)['paths']))) {
    for (const [method, operation] of Object.entries(part(operations))) {
      const name = `${method.toUpperCase()} ${path}`;
      const match = part(describedPaths[path])[method];
      if (!match) {
        changes.push(`${name} is gone`);
        continue;
      }
      const located = [
        ...requestChanges(part(operation), part(match)),
        ...responseChanges(part(operation), part(match)),
      ];
      changes.push(...located.map((change) => `${name}: ${change}`));
    }
  }
  return changes;
}
