import { CommunityWordCard } from '@slovo/ui';

import { useOpenScreen } from '../entries/use-open-screen';
import { useCommunityWordRow } from './community-word';

/**
 * The Community Word card (ADR 0060): the mini card of the Entry readers most
 * added to Favorites last week, with their adds. A tap opens the Entry over
 * the Feed, which, as from every Feed Notice, makes nothing Seen.
 */
export function CommunityWordNotice({ entryId, adds }: { entryId: string; adds: number }) {
  const row = useCommunityWordRow(entryId);
  const openScreen = useOpenScreen();
  return (
    <CommunityWordCard
      row={row}
      adds={adds}
      onOpen={() => {
        openScreen(`/entry/${entryId}`);
      }}
    />
  );
}
