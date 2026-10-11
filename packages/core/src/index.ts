/**
 * The Core's public interface. Every Edition reaches Core behaviour through
 * this module only (ADR 0006).
 */
export type { Correction, CorrectionType, Entry, EntryKind, Word } from '@slovo/contracts';
export { createContent, type Content } from './content';
export { coreDecor, InvalidDecorError, loadDecor, type Decor } from './decor';
export {
  InvalidEditionConfigError,
  loadEdition,
  type Edition,
  type Mix,
  type UserSettingDefaults,
} from './edition';
export type { Category, FeatureSwitch, FontSize, LanguageTraits, Theme } from '@slovo/contracts';
export {
  colorSchemeFor,
  createSettings,
  type ColorScheme,
  type Settings,
  type UserSettings,
} from './settings';
export { renderStress } from './stress';
export {
  systemClock,
  systemRandom,
  type Clock,
  type ContentReadPort,
  type Random,
  type UserStateChanges,
  type UserStatePort,
} from './ports';
export {
  createMemoryUserStatePort,
  openUserState,
  UserStateTooNewError,
  type UserState,
  type UserStateMigration,
} from './user-state';
