import { createFileRoute } from '@tanstack/react-router';

import { SwitchesScreen } from '../switches/switches-screen';

export const Route = createFileRoute('/switches')({
  component: SwitchesScreen,
});
