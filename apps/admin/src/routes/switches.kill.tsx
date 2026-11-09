import { createFileRoute } from '@tanstack/react-router';

import { KillTab } from '../switches/kill-tab';

export const Route = createFileRoute('/switches/kill')({
  component: KillTab,
});
