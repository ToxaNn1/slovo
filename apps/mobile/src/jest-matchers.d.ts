// Expo Router 58's testing library augments `expect`'s Matchers directly, and
// that hides the Testing Library matchers, which augment them through
// `@jest/expect`. Adding them to `expect` as well brings them back.
import type { JestNativeMatchers } from '@testing-library/react-native/dist/matchers/types';

declare module 'expect' {
  // Module augmentation merges only through an interface, which here adds no members of its own.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<R extends void | Promise<void>> extends JestNativeMatchers<R> {}
}
