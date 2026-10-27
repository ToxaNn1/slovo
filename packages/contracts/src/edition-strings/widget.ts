import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

/** One step of the widget guide: what to do and a hint under it. */
const GuideStepSchema = z.strictObject({
  title: TextSchema,
  hint: TextSchema,
});

/**
 * The home-screen widget's text. The prebuild writes it into the widget
 * extension's string table, so the Swift code holds no text of its own.
 */
export const WidgetStringsSchema = z.strictObject({
  /** The widget's name in the iOS widget gallery. */
  galleryName: TextSchema,
  /** What the widget does, under its name in the gallery. */
  galleryDescription: TextSchema,
  /** The overline of the Widget Mode Усі слова, e.g. «УСІ СЛОВА». */
  allEntries: TextSchema,
  /** The overline of the Widget Mode Улюблене, e.g. «УЛЮБЛЕНЕ». */
  favorites: TextSchema,
  /** The overline of a Collection's Widget Mode. Takes `{name}`, the Collection's, e.g. «КОЛЕКЦІЯ · {name}». */
  collection: templateOf('name'),
  /** The widget's setting that chooses its Widget Mode, where the reader edits the widget. */
  modeTitle: TextSchema,
  /** Улюблене among the Widget Modes of that setting. */
  modeFavorites: TextSchema,
  /** A Collection among the Widget Modes of that setting; also the overline while the Collection is unknown. */
  modeCollection: TextSchema,
  /** Усі слова among the Widget Modes of that setting. */
  modeAllEntries: TextSchema,
  /** The widget's setting that chooses the Collection, which lists the Collections by name. */
  collectionTitle: TextSchema,
  /**
   * What the widget says before the app wrote a snapshot, while the onboarding
   * is unfinished, or when Усі слова has no Entry: the app is where to fix it.
   */
  openApp: TextSchema,
  /** What Улюблене says with no eligible Favorite. */
  noFavorites: TextSchema,
  /** What a Collection's Widget Mode says when the Collection has no eligible Entry. */
  emptyCollection: TextSchema,
  /** What a Collection's Widget Mode says once the Collection is deleted: pick another mode. */
  deletedCollection: TextSchema,
  /** What the Collection's Widget Mode says before a Collection is chosen. */
  noCollection: TextSchema,
  /** The widget guide that Settings › «Як додати віджет» opens and the widget hint shows. */
  guide: z.strictObject({
    /** The title of the screen and of the widget hint's sheet. */
    title: TextSchema,
    /** The button that closes the widget hint's sheet. */
    close: TextSchema,
    /** The steps, in the order the reader does them. */
    steps: z.tuple([GuideStepSchema, GuideStepSchema, GuideStepSchema]),
    /** The sizes the widget comes in, as the widget gallery lists them. */
    sizes: TextSchema,
    /** The Word the drawing's sample widgets show: its Lemma and short line. */
    sample: z.strictObject({ lemma: TextSchema, definition: TextSchema }),
  }),
});
