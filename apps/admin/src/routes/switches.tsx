import { createFileRoute } from '@tanstack/react-router';

import { EmptyState } from '../components/empty-state';
import { sectionAt } from '../sections';

export const Route = createFileRoute('/switches')({
  component: () => <EmptyState section={sectionAt('/switches')} />,
});
