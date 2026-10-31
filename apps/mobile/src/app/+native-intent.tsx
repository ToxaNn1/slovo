import { appDomain, edition } from '@/edition/edition';
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
export const redirectSystemPath = createOutsideLinks({
  domain: appDomain,
  editionId: edition.id,
  widgetLinkKey: deviceWidgetLinkKey,
  // The App Intents (ADR 0057).
  appIntents: { on: () => on('appIntents'), landOnWordOfTheDay: wordOfTheDayLanding.ask },
  widgetEntries: { replaceOpenEntry: () => on('replaceOpenEntry'), open: widgetEntryLinks.open },
});
