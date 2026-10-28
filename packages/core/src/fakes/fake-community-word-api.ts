import type { CommunityWordAnswer, CommunityWordApi, RequestFailure } from '../ports';

/** A Community Word API for tests: the test sets the answer and makes requests fail. */
export interface FakeCommunityWordApi extends CommunityWordApi {
  /** How many requests were made, failed ones included. */
  readonly asked: number;
  /** Answers this Community Word from now on; `undefined`, none, as when nobody added anything. */
  answer(communityWord: CommunityWordAnswer | undefined): void;
  /** Fails the next requests, one per reason, in order. */
  fail(...reasons: readonly RequestFailure['reason'][]): void;
}

/** A Community Word API held in memory, for tests; it answers like the backend's `communityWord` procedure. */
export function createFakeCommunityWordApi(): FakeCommunityWordApi {
  let communityWord: CommunityWordAnswer | undefined;
  const failures: RequestFailure['reason'][] = [];
  let asked = 0;
  return {
    get asked() {
      return asked;
    },
    answer(next) {
      communityWord = next;
    },
    fail(...reasons) {
      failures.push(...reasons);
    },
    communityWord() {
      asked += 1;
      const reason = failures.shift();
      return Promise.resolve(
        reason === undefined ? { ok: true, communityWord } : { ok: false, reason },
      );
    },
  };
}
