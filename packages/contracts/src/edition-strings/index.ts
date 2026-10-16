import { z } from 'zod';

import { appStringsShape } from './app';
import { CollectionsStringsSchema } from './collections';
import { CorrectionCardStringsSchema } from './correction-card';
import { FavoritesStringsSchema } from './favorites';
import { feedStringsShape } from './feed';
import { GameStringsSchema } from './game';
import { HiddenStringsSchema } from './hidden';
import { HidingStringsSchema } from './hiding';
import { HistoryStringsSchema } from './history';
import { MixStringsSchema } from './mix';
import { NotificationBodyStringsSchema } from './notification-body';
import { NotificationsStringsSchema } from './notifications';
import { OnboardingStringsSchema } from './onboarding';
import { SettingsStringsSchema } from './settings';
import { SplashStringsSchema } from './splash';
import { StatsStringsSchema } from './stats';
import { TabsStringsSchema } from './tabs';
import { WidgetStringsSchema } from './widget';
import { WordCardStringsSchema } from './word-card';

/**
 * The UI text of an Edition, in its language: `editions/<edition>/strings.json`.
 * Core screens read every text from here, never from code. Each area keeps its
 * strings in its own file, so a feature edits only the area it touches. An
 * area with several keys at the root (the app's and the Feed's) is a `Shape`
 * spread into the root, which keeps `strings.json` flat.
 */
export const EditionStringsSchema = z.strictObject({
  tabs: TabsStringsSchema,
  ...appStringsShape,
  ...feedStringsShape,
  splash: SplashStringsSchema,
  settings: SettingsStringsSchema,
  wordCard: WordCardStringsSchema,
  correctionCard: CorrectionCardStringsSchema,
  favorites: FavoritesStringsSchema,
  collections: CollectionsStringsSchema,
  history: HistoryStringsSchema,
  hiding: HidingStringsSchema,
  mix: MixStringsSchema,
  hidden: HiddenStringsSchema,
  stats: StatsStringsSchema,
  onboarding: OnboardingStringsSchema,
  notifications: NotificationsStringsSchema,
  notificationBody: NotificationBodyStringsSchema,
  game: GameStringsSchema,
  widget: WidgetStringsSchema,
});

export type EditionStrings = z.infer<typeof EditionStringsSchema>;

export { fill, PluralLabelSchema, PluralSchema, type Plural, type PluralLabel } from './shared';
