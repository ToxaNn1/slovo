import { EditionDecorSchema, type DecorMotif, type EditionDecor } from '@slovo/contracts';

/**
 * The Decor the app draws, slot by slot (`docs/design/design-system.md`). A
 * slot the Decor leaves empty shows nothing. Shapes and colours only: Decor
 * never carries text or behaviour.
 */
export interface Decor {
  /** Slot 1: the tile behind a screen's content. */
  readonly background: { readonly tile: DecorMotif } | undefined;
  /** Slot 2: the ornament divider. Every Decor has one. */
  readonly divider: { readonly band: DecorMotif; readonly centre: DecorMotif };
  /** Slot 3: the top-left corner of a card frame. */
  readonly corners: { readonly corner: DecorMotif } | undefined;
  /** Slot 4: the empty-state illustration, and one for an error state. */
  readonly emptyState:
    { readonly illustration: DecorMotif; readonly error: DecorMotif | undefined } | undefined;
  /** Slot 7 as the app draws it over the native splash. */
  readonly splash: { readonly mark: DecorMotif; readonly band: DecorMotif | undefined } | undefined;
  /** Slot 6: the illustration of a won Game on the result screen. */
  readonly victory: { readonly illustration: DecorMotif } | undefined;
  /** Slot 5: the Share Card frame, a band for the Story card and a corner for the Square card. */
  readonly shareCard: { readonly band: DecorMotif; readonly corner: DecorMotif } | undefined;
}

/**
 * The Core's neutral Decor: a thin line with a small dot in the middle for the
 * divider, and nothing in the other slots, so the screen background stays
 * plain, cards keep just their rounded corners and Share Cards stay plain.
 */
export const coreDecor: Decor = {
  background: undefined,
  divider: {
    band: {
      width: 4,
      height: 1,
      layers: [
        { path: 'M0 0h4v1H0z', light: 'rgba(0, 0, 0, 0.14)', dark: 'rgba(255, 255, 255, 0.14)' },
      ],
    },
    centre: {
      width: 5,
      height: 5,
      layers: [
        { path: 'M0 2.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0z', light: '#161616', dark: '#F2F2F0' },
      ],
    },
  },
  corners: undefined,
  emptyState: undefined,
  splash: undefined,
  victory: undefined,
  shareCard: undefined,
};

/** Thrown when an Edition's Decor doesn't match the contracts. */
export class InvalidDecorError extends Error {
  override readonly name = 'InvalidDecorError';
}

/** Validates an Edition's Decor as the contracts define it. */
export function parseDecor(decor: unknown): EditionDecor {
  const result = EditionDecorSchema.safeParse(decor ?? {});
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new InvalidDecorError(`Invalid Decor:\n${problems.join('\n')}`);
  }
  return result.data;
}

/**
 * Validates an Edition's Decor and fills every slot it leaves out with the
 * Core's neutral Decor. An Edition without Decor gets the Core's throughout.
 */
export function loadDecor(decor: unknown): Decor {
  const { background, divider, corners, emptyState, splash, victory, shareCard } =
    parseDecor(decor);
  return {
    background: background ?? coreDecor.background,
    divider: divider ?? coreDecor.divider,
    corners: corners ?? coreDecor.corners,
    emptyState:
      emptyState === undefined
        ? coreDecor.emptyState
        : { illustration: emptyState.illustration, error: emptyState.error },
    splash: splash === undefined ? coreDecor.splash : { mark: splash.mark, band: splash.band },
    victory: victory ?? coreDecor.victory,
    shareCard: shareCard ?? coreDecor.shareCard,
  };
}
