/**
 * The content write API as the CLI calls it: the backend at
 * `$SLOVO_API_URL` (its `/v1` base), with the Агент token of
 * `$SLOVO_AGENT_TOKEN` (ADR 0090). A run without a token still calls the
 * API, so it prints the API's own UNAUTHORIZED answer.
 */
import { ContentRefusalsSchema, StaleWriteSchema } from '@slovo/contracts/admin-api';
import { createApiClient, ORPCError, type ApiClient } from '@slovo/contracts/api';

/** The kinds of record the write API writes, as the commands name them. */
export const RECORD_KINDS = [
  'word',
  'correction',
  'idiom',
  'synonymRow',
  'tip',
  'curatedCollection',
] as const;

export type RecordKind = (typeof RECORD_KINDS)[number];

/** The kind a command names; undefined for any other name. */
export function recordKind(name: string | undefined): RecordKind | undefined {
  return RECORD_KINDS.find((kind) => kind === name);
}

/** The API client of the environment; undefined, with the problem printed, when no API is named. */
export function apiFromEnv(problem: (line: string) => void): ApiClient | undefined {
  const url = process.env['SLOVO_API_URL'];
  if (url === undefined || url === '') {
    problem('SLOVO_API_URL is not set: the backend URL ending in /v1');
    return undefined;
  }
  const token = process.env['SLOVO_AGENT_TOKEN'];
  return createApiClient({
    // The contract's routes carry the /v1 prefix themselves.
    url: url.replace(/\/v1\/?$/, ''),
    headers: token === undefined || token === '' ? {} : { authorization: `Bearer ${token}` },
  });
}

/** A refusal of the API as the lines it prints, each led by what it is about. */
export function refusalLines(about: string, error: unknown): string[] {
  if (!(error instanceof ORPCError)) {
    return [`${about}: ${error instanceof Error ? error.message : String(error)}`];
  }
  const code = String(error.code);
  const stale = StaleWriteSchema.safeParse(error.data).data;
  if (code === 'STALE' && stale !== undefined) {
    return [`${about}: STALE, the current record version is ${String(stale.currentVersion)}`];
  }
  const refused = ContentRefusalsSchema.safeParse(error.data).data;
  if (code === 'REFUSED' && refused !== undefined) {
    return refused.refusals.map((refusal) => {
      const where = [refusal.entryId, refusal.field].filter((part) => part !== undefined);
      const at = where.length === 0 ? '' : ` (${where.join(' ')})`;
      return `${about}: REFUSED ${refusal.rule}${at}: ${refusal.message}`;
    });
  }
  return [`${about}: ${code}: ${error.message}`];
}
