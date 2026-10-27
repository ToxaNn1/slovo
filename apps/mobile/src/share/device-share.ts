import type { ShareCardFormat, ShareSheetOutcome } from '@slovo/ui';
import { PixelRatio, Share, type View } from 'react-native';

import { nativeModules } from '../device/device-native-modules';
import { shareCardImage } from './share-card';

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
 * Shares a Share Card, drawn in `view` in a format and named by what it shows
 * (an Entry's id, or `weekly-recap`), through the iOS share sheet, or
 * undefined when the binary can't capture a view, so no share button shows.
 */
export const shareCardOnDevice:
  | ((view: View, cardId: string, format: ShareCardFormat) => Promise<ShareSheetOutcome>)
  | undefined =
  modules === undefined
    ? undefined
    : (view, cardId, format) => {
        const { viewShot, fileSystem } = modules;
        return shareCardImage(
          {
            // The capture takes its size in points and draws at the screen's scale; the
            // share sheet lays the card out at exactly this size, so nothing is stretched.
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
          cardId,
          format,
        );
      };
