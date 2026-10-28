import { appIntentsOn } from '@/edition/remote-switches';
import { createOutsideLinks } from '@/entries/entry-link';
import { wordOfTheDayLanding } from '@/feed/word-of-the-day-landing';
import { deviceWidgetLinkKey } from '@/widget/device-widget';

/** Each link from outside the app, as `createOutsideLinks` lets it open. */
export const redirectSystemPath = createOutsideLinks({
  widgetLinkKey: deviceWidgetLinkKey,
  appIntents: { on: appIntentsOn, landOnWordOfTheDay: wordOfTheDayLanding.ask },
});
