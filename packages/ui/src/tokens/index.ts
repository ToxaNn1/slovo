/**
 * The design tokens from `docs/design/README.md`, one file per area: `base.ts`
 * holds what every screen shares, each other file the tokens of one area
 * (docs/react-native.md says where a new token goes). This file is the one
 * seam: `@slovo/ui/tokens` and `@slovo/ui` re-export it whole.
 */

export * from './base';
export * from './chrome';
export * from './feed';
export * from './entry';
export * from './game';
export * from './profile';
export * from './onboarding';
export * from './settings';
export * from './share';
