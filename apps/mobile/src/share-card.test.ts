import type { Clock, WordFeedCard } from '@slovo/core';
import { describe, expect, it, vi } from 'vitest';

import {
  isTodaysWordOfTheDay,
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
  it('makes a 1080×1920 PNG, keeps it in the cache and opens the share sheet with its file URL', async () => {
    const ports = fakePorts();

    const outcome = await shareCardImage(ports, 'w_00g2ap');

    expect(ports.capture).toHaveBeenCalledWith({ width: 1080, height: 1920 });
    expect(ports.keepInCache).toHaveBeenCalledWith(
      '/tmp/ReactNative/capture.png',
      'share-card-w_00g2ap.png',
    );
    expect(ports.openShareSheet).toHaveBeenCalledWith('file:///caches/share-card-w_00g2ap.png');
    expect(outcome).toBe('closed');
  });

  it('takes a cancelled share sheet for no failure', async () => {
    const ports = fakePorts({
      openShareSheet: vi.fn(() => Promise.resolve<ShareSheetResult>('cancelled')),
    });

    expect(await shareCardImage(ports, 'w_00g2ap')).toBe('closed');
  });

  it('fails without a share sheet when the image cannot be made', async () => {
    const ports = fakePorts({
      capture: vi.fn(() => Promise.reject(new Error('The view cannot be captured'))),
    });

    expect(await shareCardImage(ports, 'w_00g2ap')).toBe('failed');
    expect(ports.openShareSheet).not.toHaveBeenCalled();
  });

  it('fails without a share sheet when the image cannot be kept in the cache', async () => {
    const ports = fakePorts({
      keepInCache: vi.fn(() => Promise.reject(new Error('No space left on device'))),
    });

    expect(await shareCardImage(ports, 'w_00g2ap')).toBe('failed');
    expect(ports.openShareSheet).not.toHaveBeenCalled();
  });

  it('fails when the share sheet cannot open', async () => {
    const ports = fakePorts({
      openShareSheet: vi.fn(() => Promise.reject(new Error('Another share sheet is open'))),
    });

    expect(await shareCardImage(ports, 'w_00g2ap')).toBe('failed');
  });
});

describe("today's Word of the Day on a Share Card", () => {
  /** 16 October 2026, 00:30 in Kyiv: still the 15th in UTC. */
  const clock: Clock = {
    now: () => new Date('2026-10-15T21:30:00Z'),
    timeZone: () => 'Europe/Kyiv',
  };
  const card = (wordOfTheDay?: WordFeedCard['wordOfTheDay']) =>
    ({
      kind: 'word',
      wordCard: {} as WordFeedCard['wordCard'],
      ...(wordOfTheDay === undefined ? {} : { wordOfTheDay }),
    }) satisfies WordFeedCard;

  it("is the card of the Word of the Day of the reader's local day", () => {
    expect(isTodaysWordOfTheDay(card({ year: 2026, month: 10, day: 16 }), clock)).toBe(true);
  });

  it('is not the card of an earlier day’s Word of the Day, still in the Feed after midnight', () => {
    expect(isTodaysWordOfTheDay(card({ year: 2026, month: 10, day: 15 }), clock)).toBe(false);
  });

  it('is not the card of any other Word', () => {
    expect(isTodaysWordOfTheDay(card(), clock)).toBe(false);
  });
});
