import { systemRandom } from '@slovo/core';

import { nativeModules } from '../device/device-native-modules';
import { appGroup } from '../edition/edition';
import { createWidgetLinkKey, type WidgetDevice } from './widget-snapshot';

/**
 * The device's side of the widget: the App Group's container through
 * `expo-file-system` and WidgetKit through the Apple targets' storage module.
 * Undefined when the installed binary lacks them (a dev client built before
 * the 0.6 batch). Both are required here and nowhere else: a static import
 * would stop the app at start.
 */
export const deviceWidget = nativeModules.load('widget', (): WidgetDevice => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  const { ExtensionStorage } =
    require('@bacons/apple-targets') as typeof import('@bacons/apple-targets');
  /* eslint-enable @typescript-eslint/no-require-imports */

  /** A file in the container; it throws when the app has no such App Group. */
  function file(name: string) {
    const container = Paths.appleSharedContainers[appGroup];
    if (container === undefined) throw new Error(`The app has no App Group ${appGroup}`);
    return new File(container, name);
  }

  return {
    container: {
      write(name, text) {
        file(name).write(text);
        return Promise.resolve();
      },
      async replace(from, to) {
        await file(from).move(file(to), { overwrite: true });
      },
      async read(name) {
        const shared = file(name);
        return shared.exists ? await shared.text() : undefined;
      },
    },
    reloadTimelines() {
      ExtensionStorage.reloadWidget();
    },
  };
});

/**
 * The key the widget's links carry, kept in the Widget Snapshot in the App
 * Group (`createWidgetLinkKey`), or none without the native modules, so no
 * link opens as the widget's there.
 */
export const deviceWidgetLinkKey: () => Promise<string | undefined> =
  deviceWidget === undefined
    ? () => Promise.resolve(undefined)
    : createWidgetLinkKey(deviceWidget.container, systemRandom);
