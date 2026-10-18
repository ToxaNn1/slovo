/**
 * The most changes one push of Sync sends, and the most records one pull
 * answers (spec #378). The app's Core pushes its pending changes in batches
 * of this size.
 */
export const SYNC_BATCH_SIZE = 500;
