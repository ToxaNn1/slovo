/**
 * Waits for a change of what the user keeps (`subject`, such as Favorites). One
 * that could not be kept is logged and resolves to `unchanged`, as the subject
 * stays as it was.
 */
export async function keep<T>(subject: string, change: Promise<T>, unchanged: T): Promise<T> {
  try {
    return await change;
  } catch (error) {
    console.error(`Could not keep the change of ${subject}`, error);
    return unchanged;
  }
}
