import type { ShareCardFormat, ShareSheetOutcome } from '@slovo/ui';
import { shareImage } from '@slovo/ui/tokens';

/** What the system share sheet came to: the reader sent the image somewhere, or closed it. */
export type ShareSheetResult = 'shared' | 'cancelled';

/** What sharing the image of a Share Card needs from the device. */
export interface ShareImagePorts {
  /** Draws the Share Card into a PNG of `size` pixels; resolves to its temporary file. */
  capture(size: { readonly width: number; readonly height: number }): Promise<string>;
  /** Moves the file into the app's cache directory as `name`, over one of that name; resolves to its file URL. */
  keepInCache(file: string, name: string): Promise<string>;
  /** Opens the system share sheet with the file and resolves once the reader closes it. */
  openShareSheet(url: string): Promise<ShareSheetResult>;
}

/**
 * Shares the Share Card of an Entry as an image: captures it as a PNG of its
 * format (1080×1920 for a Story, 1080×1080 for a Square), keeps the file in the
 * cache directory under the Entry's name, so a new share of the same Entry
 * replaces it, and opens the system share sheet with the file. Resolves to
 * `closed` once the system share sheet closes, shared or cancelled alike, or to
 * `failed` when a step fails, so the reader can try again. Writes no user
 * state.
 */
export async function shareCardImage(
  ports: ShareImagePorts,
  entryId: string,
  format: ShareCardFormat,
): Promise<ShareSheetOutcome> {
  try {
    const file = await ports.capture(shareImage[format]);
    const url = await ports.keepInCache(file, `share-card-${entryId}.png`);
    await ports.openShareSheet(url);
    return 'closed';
  } catch {
    return 'failed';
  }
}

/** The Share Card format the share sheet opens in. */
export interface ShareFormatMemory {
  /** The format the reader chose last, Story at first. */
  readonly format: ShareCardFormat;
  /** Remembers the format the reader just chose. */
  choose(format: ShareCardFormat): void;
}

/** A memory of the Share Card format that lasts as long as itself: the app keeps one per session. */
export function createShareFormatMemory(): ShareFormatMemory {
  let format: ShareCardFormat = 'story';
  return {
    get format() {
      return format;
    },
    choose(chosen) {
      format = chosen;
    },
  };
}
