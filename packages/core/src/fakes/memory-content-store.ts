import type { Patch } from '@slovo/contracts/api';
import type { IllustrationRow, RecordingRow } from '@slovo/contracts';

import type { ContentStore, WordMedia } from '../ports';

/** A content store in memory: the Patches it applied, in order, and whether the next one fails. */
export interface MemoryContentStore extends ContentStore {
  readonly applied: readonly Patch[];
  /** Makes each later `apply` reject, as a pack that fails half-way does, until turned off. */
  failApplying(on: boolean): void;
}

/** A content store at a content version, which checks a Patch as the device's pack does. */
export function createMemoryContentStore({
  editionId = 'uk',
  contentVersion = 1,
  etag,
  mediaBase = 'https://media.slovo.test',
  needsNewRecording = [],
  media = {},
}: {
  editionId?: string;
  contentVersion?: number;
  etag?: string;
  mediaBase?: string;
  /** The Words marked «needs new recording». */
  needsNewRecording?: readonly string[];
  /** The live media rows the pack holds from the start. */
  media?: { recordings?: readonly RecordingRow[]; illustrations?: readonly IllustrationRow[] };
} = {}): MemoryContentStore {
  let base = mediaBase;
  let version = contentVersion;
  let lastEtag = etag;
  let failing = false;
  const applied: Patch[] = [];
  const recordings = new Map<string, WordMedia['recordings'][number]>();
  const illustrations = new Map<string, WordMedia['illustrations'][number]>();
  function take(patch: {
    recordings: readonly RecordingRow[];
    illustrations: readonly IllustrationRow[];
  }) {
    for (const row of patch.recordings) {
      const key = `${row.wordId} ${row.narratorVoice} ${row.recordingKind} ${row.hash}`;
      if (row.retired) recordings.delete(key);
      else recordings.set(key, liveOf(row));
    }
    for (const row of patch.illustrations) {
      const key = `${row.wordId} ${row.hash}`;
      if (row.retired) illustrations.delete(key);
      else illustrations.set(key, liveOf(row));
    }
  }
  take({ recordings: media.recordings ?? [], illustrations: media.illustrations ?? [] });
  return {
    applied,
    contentVersion: () => version,
    etag: () => lastEtag,
    failApplying(on) {
      failing = on;
    },
    apply(patch, patchEtag) {
      if (failing) return Promise.reject(new Error('The pack failed half-way'));
      if (patch.editionId !== editionId || patch.since !== version) {
        return Promise.reject(new Error('The Patch is not for this pack'));
      }
      applied.push(patch);
      take(patch);
      base = patch.mediaBase;
      version = patch.contentVersion;
      lastEtag = patchEtag;
      return Promise.resolve();
    },
    mediaOf(wordId) {
      const ofWord = <Row extends { wordId: string }>(rows: Map<string, Row>) =>
        [...rows.entries()]
          .filter(([, row]) => row.wordId === wordId)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, row]) => row);
      return Promise.resolve({
        mediaBase: base,
        needsNewRecording: needsNewRecording.includes(wordId),
        recordings: ofWord(recordings),
        illustrations: ofWord(illustrations),
      });
    },
  };
}

/** A media row as the live set holds it, without its retired flag. */
function liveOf<Row extends { retired: boolean }>(row: Row): Omit<Row, 'retired'> {
  const { retired: _retired, ...live } = row;
  return live;
}
