/**
 * The parts VoiceOver reads, one sentence each: a part ending in its own full
 * stop takes no other.
 */
export function sentences(parts: (string | undefined)[]): string {
  return parts
    .filter((part) => part !== undefined)
    .reduce(
      (label, part) =>
        label === '' ? part : `${label}${/[.!?…]$/.test(label) ? ' ' : '. '}${part}`,
      '',
    );
}
