/**
 * The data as JSON for a `<script type="application/ld+json">`: every `<`
 * written as `<`, which JSON reads back the same, so no text of an
 * Entry can close the script element or open a comment in it.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
