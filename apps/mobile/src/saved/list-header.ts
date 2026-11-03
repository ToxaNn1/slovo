import type { ReactElement } from 'react';

/**
 * What a Saved list draws over its rows, given the list's own tool («Очистити»
 * of History, «+» of Collections) or `null`: the list's screen puts its back
 * link and title there, the Saved overview its title, search and tabs.
 */
export type ListHeader = (tool: ReactElement | null) => ReactElement;
