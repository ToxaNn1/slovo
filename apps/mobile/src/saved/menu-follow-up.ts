/**
 * What a Collection's «…» menu chose, held until the menu sheet has slid away:
 * the rename's name field and the delete dialog both take the focus or a modal,
 * and neither may start while the sheet's own modal is still going (iOS takes
 * the focus back from the field, whose blur then cancels the rename).
 */
export function createMenuFollowUp<Collection>(actions: {
  readonly rename: (collection: Collection) => void;
  readonly remove: (collection: Collection) => void;
}) {
  let chosen: { readonly action: 'rename' | 'remove'; readonly collection: Collection } | undefined;
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
    /** The sheet has slid away: runs the chosen action, once. */
    dismissed: () => {
      const done = chosen;
      chosen = undefined;
      if (done !== undefined) actions[done.action](done.collection);
    },
  };
}
