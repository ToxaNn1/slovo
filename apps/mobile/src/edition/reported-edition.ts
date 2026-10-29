import Constants from 'expo-constants';

/** The Edition in the app's Expo config (see app.config.ts), as the build reports it. */
const reported: unknown = Constants.expoConfig?.extra?.['edition'];

/** A text field of the reported Edition, if the build reports one. */
function reportedText(field: string): string | undefined {
  if (typeof reported !== 'object' || reported === null) return undefined;
  const value: unknown = Object.entries(reported).find(([key]) => key === field)?.[1];
  return typeof value === 'string' ? value : undefined;
}

/** The id of the Edition the build was made for, if it reports one. */
export const reportedEditionId = reportedText('id');

/**
 * The family of the calligraphic font the build embeds for the Lemma on the
 * Word of the Day card (ADR 0006), if it reports one.
 */
export const wordOfTheDayFontFamily = reportedText('wordOfTheDayFontFamily');
