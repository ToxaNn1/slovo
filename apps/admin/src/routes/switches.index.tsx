import { createFileRoute } from '@tanstack/react-router';

import { SwitchesMatrix } from '../switches/switches-screen';

export const Route = createFileRoute('/switches/')({
  component: SwitchesMatrix,
});
