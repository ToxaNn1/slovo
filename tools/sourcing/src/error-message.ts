/** The message of a thrown value, whatever it is. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
