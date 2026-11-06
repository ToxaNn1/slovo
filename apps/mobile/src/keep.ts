import { logError } from './diagnostics/log';

/**
 * Waits for a change of what the user keeps (`subject`, such as Favorites),
 * the one way a hook fires a Core change. One that could not be kept is logged
 * and resolves to `unchanged`, or to nothing when not given, as the subject
 * stays as it was. It never rejects.
 */
export function keep<T>(subject: string, change: Promise<T>): Promise<T | undefined>;
export function keep<T>(subject: string, change: Promise<T>, unchanged: T): Promise<T>;
export async function keep<T>(
  subject: string,
  change: Promise<T>,
  unchanged?: T,
): Promise<T | undefined> {
  try {
    return await change;
  } catch (error) {
    logError(`Could not keep the change of ${subject}`, error);
    return unchanged;
  }
}
