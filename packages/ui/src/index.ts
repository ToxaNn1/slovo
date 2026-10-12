/**
 * The UI: Edition-neutral components that read every text, design token and
 * Decor from the Edition.
 */
export {
  CorrectionCard,
  type CorrectionCardProps,
  type CorrectionCardStrings,
} from './CorrectionCard';
export { FeedError, FeedLoading, SwipeHint } from './FeedStates';
export { FontSizePreview } from './FontSizePreview';
export {
  FontSizeProvider,
  useWordTextSizes,
  wordTextSizes,
  type TextSize,
  type WordTextSizes,
} from './FontSizeProvider';
export { DecorProvider, useDecor } from './DecorProvider';
export { EndOfCycleCard, type EndOfCycleCardProps } from './EndOfCycleCard';
export {
  CardCorners,
  DecorBackground,
  EmptyStateIllustration,
  OrnamentDivider,
} from './DecorSlots';
export { ScreenTitle, SectionLabel } from './headings';
export { Placeholder } from './Placeholder';
export {
  PronunciationButton,
  type PronunciationButtonProps,
  type PronunciationButtonState,
} from './PronunciationButton';
export { SegmentedControl, type Segment } from './SegmentedControl';
export { SplashOverlay, type SplashOverlayProps } from './SplashOverlay';
export {
  coreTokens,
  designTokens,
  fontSizeSteps,
  minTouchTarget,
  space,
  typeSize,
  type ColorScheme,
  type DesignTokens,
} from './tokens';
export { TokensProvider, useTokens, type Tokens } from './TokensProvider';
export {
  PagerScrollView,
  usePageTurnActions,
  VerticalPager,
  type VerticalPagerHandle,
  type VerticalPagerProps,
} from './VerticalPager';
export { useReduceMotion } from './useReduceMotion';
export { WordCard, type WordCardProps, type WordCardStrings } from './WordCard';
export { WordOfTheDayBadge } from './WordOfTheDayBadge';
