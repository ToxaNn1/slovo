/** What a message may quote that is personal data or a secret, and what takes its place. */
const PERSONAL_DATA: readonly (readonly [RegExp, string])[] = [
  [/[^\s@"'<>()[\]]+@[^\s@"'<>()[\]]+/g, '[email]'],
  // A Session's token, an Account's id, a Google identity token: a long run of token characters.
  [/[\w.-]{20,}/g, '[token]'],
  [/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip]'],
  [/\b[\da-f]{0,4}(?::[\da-f]{0,4}){2,7}\b/gi, '[ip]'],
  // A Sign-in code.
  [/\b\d{6}\b/g, '[code]'],
];

/**
 * The text with every email, token, IP address and Sign-in code it quotes
 * taken out. Crash reports and the app's log both pass through it.
 */
export function scrubbed(text: string): string {
  return PERSONAL_DATA.reduce((rest, [pattern, mark]) => rest.replace(pattern, mark), text);
}
