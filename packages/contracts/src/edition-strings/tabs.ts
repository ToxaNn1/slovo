import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

export const TabsStringsSchema = z.strictObject({
  home: TextSchema,
  /** The last tab while the Profile is shown: the Profile, which opens Settings. */
  profile: TextSchema,
  /** The last tab while the Profile is off: Settings itself. */
  settings: TextSchema,
  game: TextSchema,
  saved: TextSchema,
  /** The centre tab «Мікс», which opens «Мій Мікс» while the mixTab switch is on (ADR 0201). */
  mix: TextSchema,
  /** What VoiceOver says for a tab, e.g. "{tab}, вкладка {position} з {count}". */
  accessibilityLabel: templateOf('tab', 'position', 'count'),
});
