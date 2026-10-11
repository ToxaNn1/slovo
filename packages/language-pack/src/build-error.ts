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
  const location = [file, entryId === undefined ? undefined : `Word ${entryId}`, field]
    .filter((part) => part !== undefined)
    .join(' › ');
  return `${location}: ${message}`;
}
