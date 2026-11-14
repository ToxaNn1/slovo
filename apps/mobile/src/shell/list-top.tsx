import { ScrollToTopButton, type ListScroll } from '@slovo/ui';
import type { Component } from 'react';

import { editionStrings } from '@/edition/edition';
import { useEditionInEffect } from '@/edition/remote-switches';

/**
 * The «Нагору» button of a long list, while its Feature Switch `scrollToTop`
 * is in effect. Render it beside the list, in the view the list fills: it
 * sits in that view's bottom-right corner. `overTabBar` for a list that ends
 * at the tab bar.
 */
export function ListTopButton<List extends Component>({
  scroll,
  overTabBar = false,
}: {
  scroll: ListScroll<List>;
  overTabBar?: boolean;
}) {
  if (!useEditionInEffect().isFeatureEnabled('scrollToTop')) return null;
  return (
    <ScrollToTopButton
      scroll={scroll}
      accessibilityLabel={editionStrings.scrollToTop}
      overTabBar={overTabBar}
    />
  );
}
