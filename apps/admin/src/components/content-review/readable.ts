/**
 * A field's value as plain text to read on the review card: a list one item
 * after another, an object its values; none for an empty value.
 */
export function readable(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const items = value.map(readable).filter((item) => item !== undefined);
    return items.length === 0 ? undefined : items.join('; ');
  }
  if (typeof value === 'object') {
    const parts = Object.values(value)
      .map(readable)
      .filter((part) => part !== undefined);
    return parts.length === 0 ? undefined : parts.join(' — ');
  }
  return undefined;
}
