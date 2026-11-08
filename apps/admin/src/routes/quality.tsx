import { createFileRoute } from '@tanstack/react-router';

import { EmptyState } from '../components/empty-state';
import { sectionAt } from '../sections';

export const Route = createFileRoute('/quality')({
  component: () => <EmptyState section={sectionAt('/quality')} />,
});
