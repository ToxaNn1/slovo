import type { SharedFile } from '../shell-value';

/** What sharing a text file needs from the device: the cache, and the share sheet. */
export interface ShareFilePorts {
  /** Writes `text` to a cache file named `name` and gives its URL. */
  writeToCache(name: string, text: string): Promise<string>;
  openShareSheet(url: string, title: string): Promise<'shared' | 'cancelled'>;
  deleteFromCache(url: string): void;
}

/**
 * Writes a file to the cache and hands it to the share sheet, then deletes it
 * once the sheet closes, shared, cancelled or failed: the Data export holds the
 * reader's data in plain text, so no copy stays behind on the device.
 */
export async function shareTextFile(
  ports: ShareFilePorts,
  { name, text, title }: SharedFile,
): Promise<'shared' | 'cancelled'> {
  const url = await ports.writeToCache(name, text);
  try {
    return await ports.openShareSheet(url, title);
  } finally {
    ports.deleteFromCache(url);
  }
}
