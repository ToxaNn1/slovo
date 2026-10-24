import { createOutsideLinks } from '../entries/entry-link';
import { deviceWidgetLinkKey } from '../widget/device-widget';

/** Each link from outside the app, as `createOutsideLinks` lets it open. */
export const redirectSystemPath = createOutsideLinks(deviceWidgetLinkKey);
