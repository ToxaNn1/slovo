import { z } from 'zod';

import { AccountStringsSchema, EmailStringsSchema } from './account';
import { appStringsShape } from './app';
import { AppIntentsStringsSchema } from './app-intents';
import { CollectionsStringsSchema } from './collections';
import { CorrectionCardStringsSchema } from './correction-card';
import { FavoritesStringsSchema } from './favorites';
import { feedStringsShape } from './feed';
import { FeedNoticesStringsSchema } from './feed-notices';
import { GameStringsSchema } from './game';
import { HiddenStringsSchema } from './hidden';
import { HidingStringsSchema } from './hiding';
import { HistoryStringsSchema } from './history';
import { IdiomCardStringsSchema } from './idiom-card';
import { KnowledgeStringsSchema } from './knowledge';
import { LearningStringsSchema } from './learning';
import { MistakeReportStringsSchema } from './mistake-report';
import { MixStringsSchema } from './mix';
import { MoodStringsSchema } from './mood';
import { NotificationBodyStringsSchema } from './notification-body';
import { NotificationTemplatesStringsSchema } from './notification-templates';
import { NotificationsStringsSchema } from './notifications';
import { OnboardingStringsSchema } from './onboarding';
import { RarityTestStringsSchema } from './rarity-test';
import { SearchStringsSchema } from './search';
import { SettingsStringsSchema } from './settings';
import { ShareStringsSchema } from './share';
import { SplashStringsSchema } from './splash';
import { SpotlightStringsSchema } from './spotlight';
import { StatsStringsSchema } from './stats';
import { SynonymRowCardStringsSchema } from './synonym-row-card';
import { TabsStringsSchema } from './tabs';
import { TipCardStringsSchema } from './tip-card';
import { WidgetStringsSchema } from './widget';
import { WordOfTheDayArchiveStringsSchema } from './word-of-the-day-archive';
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
  idiomCard: IdiomCardStringsSchema,
  synonymRowCard: SynonymRowCardStringsSchema,
  tipCard: TipCardStringsSchema,
  favorites: FavoritesStringsSchema,
  collections: CollectionsStringsSchema,
  history: HistoryStringsSchema,
  hiding: HidingStringsSchema,
  knowledge: KnowledgeStringsSchema,
  learning: LearningStringsSchema,
  mistakeReport: MistakeReportStringsSchema,
  mix: MixStringsSchema,
  hidden: HiddenStringsSchema,
  stats: StatsStringsSchema,
  onboarding: OnboardingStringsSchema,
  notifications: NotificationsStringsSchema,
  notificationBody: NotificationBodyStringsSchema,
  notificationTemplates: NotificationTemplatesStringsSchema,
  search: SearchStringsSchema,
  rarityTest: RarityTestStringsSchema,
  feedNotices: FeedNoticesStringsSchema,
  wordOfTheDayArchive: WordOfTheDayArchiveStringsSchema,
  mood: MoodStringsSchema,
  game: GameStringsSchema,
  widget: WidgetStringsSchema,
  spotlight: SpotlightStringsSchema,
  appIntents: AppIntentsStringsSchema,
  share: ShareStringsSchema,
  account: AccountStringsSchema,
  email: EmailStringsSchema,
});

export type EditionStrings = z.infer<typeof EditionStringsSchema>;

export { ACCOUNT_NAME } from './account';
export { fill, PluralLabelSchema, PluralSchema, type Plural, type PluralLabel } from './shared';
