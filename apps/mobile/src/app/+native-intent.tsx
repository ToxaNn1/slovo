import { edition } from '@/edition/edition';
import { createOutsideLinks } from '@/entries/entry-link';
import { wordOfTheDayLanding } from '@/feed/word-of-the-day-landing';
import { appShell } from '@/shell/app-shell';
import { deviceWidgetLinkKey } from '@/widget/device-widget';

/** Whether the App Intents are on in effect, by the remote Feature Switches the app knows (ADR 0057). */
async function appIntentsOn(): Promise<boolean> {
  return (await appShell.remoteSwitches.opened()).edition.isFeatureEnabled('appIntents');
}

/** Each link from outside the app, as `createOutsideLinks` lets it open. */
export const redirectSystemPath = createOutsideLinks({
  linkDomain: edition.linkDomain,
  widgetLinkKey: deviceWidgetLinkKey,
  appIntents: { on: appIntentsOn, landOnWordOfTheDay: wordOfTheDayLanding.ask },
});
