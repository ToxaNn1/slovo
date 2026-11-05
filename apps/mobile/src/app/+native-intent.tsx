import { activeEditionId, appDomain } from '@/edition/edition';
import { createOutsideLinks } from '@/entries/entry-link';
import { widgetEntryLinks } from '@/entries/widget-entry-links';
import { wordOfTheDayLanding } from '@/feed/word-of-the-day-landing';
import { appShell } from '@/shell/app-shell';
import { deviceWidgetLinkKey } from '@/widget/device-widget';

/** Whether a Feature Switch is on in effect, by the remote Feature Switches the app knows. */
async function on(feature: 'appIntents' | 'replaceOpenEntry'): Promise<boolean> {
  return (await appShell.remoteSwitches.opened()).edition.isFeatureEnabled(feature);
}

/** Each link from outside the app, as `createOutsideLinks` lets it open. */
const outsideLinks = createOutsideLinks({
  domain: appDomain,
  editionId: activeEditionId,
  widgetLinkKey: deviceWidgetLinkKey,
  // The App Intents (ADR 0057).
  appIntents: { on: () => on('appIntents'), landOnWordOfTheDay: wordOfTheDayLanding.ask },
  widgetEntries: { replaceOpenEntry: () => on('replaceOpenEntry'), open: widgetEntryLinks.open },
});

/**
 * Each link from outside the app. In a development build a test state link
 * loads its state first (spec #1551, the list in docs/agents); a
 * production build drops that branch, the module behind it included.
 */
export async function redirectSystemPath(link: {
  path: string;
  initial: boolean;
}): Promise<string | null> {
  if (__DEV__) {
    const { openTestStateLink } = await import('@/shell/test-state-link');
    const opened = openTestStateLink(link.path);
    if (opened !== undefined) return opened;
  }
  return outsideLinks(link);
}
