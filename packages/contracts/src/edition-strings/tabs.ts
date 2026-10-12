import { z } from 'zod';

import { templateOf, TextSchema } from './shared';

export const TabsStringsSchema = z.strictObject({
  home: TextSchema,
  settings: TextSchema,
  game: TextSchema,
  saved: TextSchema,
  /** What VoiceOver says for a tab, e.g. "{tab}, вкладка {position} з {count}". */
  accessibilityLabel: templateOf('tab', 'position', 'count'),
});
