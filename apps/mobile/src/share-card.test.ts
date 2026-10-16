import { describe, expect, it, vi } from 'vitest';

import {
  createShareFormatMemory,
  shareCardImage,
  type ShareImagePorts,
  type ShareSheetResult,
} from './share-card';

/** Ports that make the image, keep it in the cache and open the share sheet, recording each call. */
function fakePorts(overrides: Partial<ShareImagePorts> = {}) {
  return {
    capture: vi.fn(() => Promise.resolve('/tmp/ReactNative/capture.png')),
    keepInCache: vi.fn((_file: string, name: string) => Promise.resolve(`file:///caches/${name}`)),
    openShareSheet: vi.fn(() => Promise.resolve<ShareSheetResult>('shared')),
    ...overrides,
  } satisfies ShareImagePorts;
}

describe('sharing a Share Card as an image', () => {
  it('makes a 1080×1920 PNG of a Story, keeps it in the cache and opens the share sheet with its file URL', async () => {
    const ports = fakePorts();

    const outcome = await shareCardImage(ports, 'w_00g2ap', 'story');

    expect(ports.capture).toHaveBeenCalledWith({ width: 1080, height: 1920 });
    expect(ports.keepInCache).toHaveBeenCalledWith(
      '/tmp/ReactNative/capture.png',
      'share-card-w_00g2ap.png',
    );
    expect(ports.openShareSheet).toHaveBeenCalledWith('file:///caches/share-card-w_00g2ap.png');
    expect(outcome).toBe('closed');
  });

  it('makes a 1080×1080 PNG of a Square', async () => {
    const ports = fakePorts();

    expect(await shareCardImage(ports, 'c_0003kq', 'square')).toBe('closed');
    expect(ports.capture).toHaveBeenCalledWith({ width: 1080, height: 1080 });
    expect(ports.openShareSheet).toHaveBeenCalledWith('file:///caches/share-card-c_0003kq.png');
  });

  it('takes a cancelled share sheet for no failure', async () => {
    const ports = fakePorts({
      openShareSheet: vi.fn(() => Promise.resolve<ShareSheetResult>('cancelled')),
    });

    expect(await shareCardImage(ports, 'w_00g2ap', 'story')).toBe('closed');
  });

  it('fails without a share sheet when the image cannot be made', async () => {
    const ports = fakePorts({
      capture: vi.fn(() => Promise.reject(new Error('The view cannot be captured'))),
    });

    expect(await shareCardImage(ports, 'w_00g2ap', 'story')).toBe('failed');
    expect(ports.openShareSheet).not.toHaveBeenCalled();
  });

  it('fails without a share sheet when the image cannot be kept in the cache', async () => {
    const ports = fakePorts({
      keepInCache: vi.fn(() => Promise.reject(new Error('No space left on device'))),
    });

    expect(await shareCardImage(ports, 'w_00g2ap', 'story')).toBe('failed');
    expect(ports.openShareSheet).not.toHaveBeenCalled();
  });

  it('fails when the share sheet cannot open', async () => {
    const ports = fakePorts({
      openShareSheet: vi.fn(() => Promise.reject(new Error('Another share sheet is open'))),
    });

    expect(await shareCardImage(ports, 'w_00g2ap', 'story')).toBe('failed');
  });
});

describe('the Share Card format of a session', () => {
  it('is Story at first', () => {
    expect(createShareFormatMemory().format).toBe('story');
  });

  it('is the format the reader chose last', () => {
    const memory = createShareFormatMemory();

    memory.choose('square');
    expect(memory.format).toBe('square');

    memory.choose('story');
    expect(memory.format).toBe('story');
  });
});
