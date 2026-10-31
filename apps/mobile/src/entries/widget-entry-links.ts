/** Hands links from where they arrive to the one listener that opens them, holding the last until it listens. */
export interface LinkRelay {
  open: (link: string) => void;
  /** Calls `open` with each link, the one held first; returns the call that stops it. */
  listen: (open: (link: string) => void) => () => void;
}

export function createLinkRelay(): LinkRelay {
  let listener: ((link: string) => void) | undefined;
  let held: string | undefined;
  return {
    open: (link) => {
      if (listener === undefined) held = link;
      else listener(link);
    },
    listen: (open) => {
      listener = open;
      if (held !== undefined) {
        const link = held;
        held = undefined;
        open(link);
      }
      return () => {
        if (listener === open) listener = undefined;
      };
    },
  };
}

/**
 * The widget's Entry links the outside links hand over while the app runs,
 * for `NotificationTaps` to open in place of the open Entry.
 */
export const widgetEntryLinks = createLinkRelay();
