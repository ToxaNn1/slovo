/**
 * The app-level store (ADR 0065): what the app keeps apart from every
 * Edition's user state, read before any Edition opens.
 */
export interface AppStore {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

/** The key of the active Edition in the app-level store. */
const ACTIVE_EDITION = 'activeEdition';

/** What choosing the active Edition at launch reads. */
export interface EditionChoice {
  /** The ids of the Editions the app has. */
  readonly editionIds: readonly string[];
  /** The Edition opened when no other applies: the UA Edition. */
  readonly defaultId: string;
  /** The device's preferred languages, most preferred first, as ISO 639-1 codes. */
  readonly deviceLanguages: readonly string[];
  readonly appStore: AppStore;
}

/**
 * The Edition the app runs as, chosen once at launch and fixed for the run
 * (ADR 0065): the one the app-level store keeps, else the Edition of the
 * device's first preferred language that has one, else the default. An
 * Edition id is its language code, so a language names its Edition. The
 * choice is kept, so a reader stays in their Edition when the device's
 * language changes.
 */
export function chooseActiveEdition({
  editionIds,
  defaultId,
  deviceLanguages,
  appStore,
}: EditionChoice): string {
  const has = (id: string | undefined): id is string => id !== undefined && editionIds.includes(id);
  const kept = appStore.get(ACTIVE_EDITION);
  if (has(kept)) return kept;
  const chosen = deviceLanguages.find(has) ?? defaultId;
  appStore.set(ACTIVE_EDITION, chosen);
  return chosen;
}
