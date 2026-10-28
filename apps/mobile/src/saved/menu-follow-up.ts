/**
 * What a Collection's «…» menu chose, held until the menu sheet has slid away:
 * the rename's name field, the delete dialog and the share sheet each take the
 * focus or a modal, and none may start while the sheet's own modal is still
 * going (iOS takes the focus back from the field, whose blur then cancels the
 * rename, and shows no second modal over the first).
 */
export function createMenuFollowUp<Collection>(actions: {
  readonly rename: (collection: Collection) => void;
  readonly remove: (collection: Collection) => void;
  readonly share: (collection: Collection) => void;
}) {
  let chosen:
    { readonly action: 'rename' | 'remove' | 'share'; readonly collection: Collection } | undefined;
  return {
    /** The menu opens: an earlier choice is stale. */
    opened: () => {
      chosen = undefined;
    },
    chooseRename: (collection: Collection) => {
      chosen = { action: 'rename', collection };
    },
    chooseDelete: (collection: Collection) => {
      chosen = { action: 'remove', collection };
    },
    chooseShare: (collection: Collection) => {
      chosen = { action: 'share', collection };
    },
    /** The sheet has slid away: runs the chosen action, once. */
    dismissed: () => {
      const done = chosen;
      chosen = undefined;
      if (done !== undefined) actions[done.action](done.collection);
    },
  };
}
