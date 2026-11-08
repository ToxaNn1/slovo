import type { Refusal } from '@slovo/content-rules';

/** One problem that stops the build, located as precisely as possible. */
export interface BuildError {
  /** The file at fault, relative to the Edition folder. */
  readonly file: string;
  readonly entryId?: string;
  /** The dotted path of the field at fault. */
  readonly field?: string;
  readonly message: string;
}

export function formatBuildError({ file, entryId, field, message }: BuildError): string {
  const location = [file, entryId === undefined ? undefined : `Entry ${entryId}`, field]
    .filter((part) => part !== undefined)
    .join(' › ');
  return `${location}: ${message}`;
}

/** The refusals of the content rules as build errors: the build names the record, not the rule. */
export function buildErrorsOf(refusals: readonly Refusal[]): BuildError[] {
  return refusals.map(({ file, entryId, field, message }) => ({
    file,
    ...(entryId === undefined ? {} : { entryId }),
    ...(field === undefined ? {} : { field }),
    message,
  }));
}
