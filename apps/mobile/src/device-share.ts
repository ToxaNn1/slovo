import { PixelRatio, Share, type View } from 'react-native';

import { nativeModules } from './device-native-modules';
import { shareCardImage, type ShareOutcome } from './share-card';

/**
 * `react-native-view-shot` and `expo-file-system`, or undefined when the
 * installed binary can't capture a view (a dev client built before the 0.6
 * batch). They are required here and nowhere else: a static import would stop
 * the app at start.
 */
const modules = nativeModules.load('shareCapture', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  viewShot: require('react-native-view-shot') as typeof import('react-native-view-shot'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  fileSystem: require('expo-file-system') as typeof import('expo-file-system'),
}));

/** A path as a `file://` URL. */
const fileUrl = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);

/**
 * Shares the Share Card of an Entry drawn in `view` through the iOS share
 * sheet, or undefined when the binary can't capture a view, so the share
 * button stays out of the action row.
 */
export const shareCardOnDevice:
  ((view: View, entryId: string) => Promise<ShareOutcome>) | undefined =
  modules === undefined
    ? undefined
    : (view, entryId) => {
        const { viewShot, fileSystem } = modules;
        return shareCardImage(
          {
            // The capture takes its size in points and draws at the screen's scale.
            capture: ({ width, height }) =>
              viewShot.captureRef(view, {
                format: 'png',
                result: 'tmpfile',
                width: width / PixelRatio.get(),
                height: height / PixelRatio.get(),
              }),
            async keepInCache(file, name) {
              const kept = new fileSystem.File(fileSystem.Paths.cache, name);
              await new fileSystem.File(fileUrl(file)).move(kept, { overwrite: true });
              return kept.uri;
            },
            async openShareSheet(url) {
              const { action } = await Share.share({ url });
              return action === Share.sharedAction ? 'shared' : 'cancelled';
            },
          },
          entryId,
        );
      };
