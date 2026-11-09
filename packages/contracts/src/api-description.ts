import type { AnyContractRouter } from '@orpc/contract';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';

import { apiContract } from './api';

/**
 * Where the description of `/v1` the API has promised is committed, beside
 * the contract; `pnpm describe:api` rewrites it (ADR 0031).
 */
export const COMMITTED_DESCRIPTION = new URL('./api/v1.openapi.json', import.meta.url);

type JsonSchemaPart = Record<string, unknown>;

const isJsonSchemaPart = (value: unknown): value is JsonSchemaPart =>
  typeof value === 'object' && value !== null;

/**
 * A tuple with a rest (`[main, ...more]`) promises at least its fixed items;
 * the Zod converter leaves `minItems` out of such an array, so it is added
 * here, wherever a schema has `prefixItems`.
 */
function addTupleMinItems(schema: unknown): void {
  if (Array.isArray(schema)) {
    schema.forEach(addTupleMinItems);
  } else if (isJsonSchemaPart(schema)) {
    Object.values(schema).forEach(addTupleMinItems);
    const prefixItems = schema['prefixItems'];
    if (Array.isArray(prefixItems) && schema['minItems'] === undefined) {
      schema['minItems'] = prefixItems.length;
    }
  }
}

class TupleAwareConverter extends ZodToJsonSchemaConverter {
  override convert(
    ...args: Parameters<ZodToJsonSchemaConverter['convert']>
  ): ReturnType<ZodToJsonSchemaConverter['convert']> {
    const converted = super.convert(...args);
    addTupleMinItems(converted[1]);
    return converted;
  }
}

/**
 * How the contract is described in OpenAPI. The backend serves its `/docs`
 * with the same options, so `/docs/openapi.json` is the description
 * `describeApi` gives, plus the server it is read from.
 */
export const apiDescriptionOptions = {
  schemaConverters: [new TupleAwareConverter()],
  specGenerateOptions: { info: { title: 'SLOVO API', version: '1' } },
};

/**
 * The OpenAPI description of the contract, `apiContract` unless another is
 * given: built from the contract alone, with no backend and no database. The
 * description of `/v1` is committed beside the contract, and a change of the
 * contract may only add to it (ADR 0031).
 */
export async function describeApi(contract: AnyContractRouter = apiContract): Promise<object> {
  const { schemaConverters, specGenerateOptions } = apiDescriptionOptions;
  const description = await new OpenAPIGenerator({ schemaConverters }).generate(
    contract,
    specGenerateOptions,
  );
  // The description as it is served and committed: JSON, with no undefined field.
  return JSON.parse(JSON.stringify(description)) as object;
}
