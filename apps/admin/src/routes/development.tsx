import { createFileRoute } from '@tanstack/react-router';

import { EmptyState } from '../components/empty-state';
import { sectionAt } from '../sections';

export const Route = createFileRoute('/development')({
  component: () => <EmptyState section={sectionAt('/development')} />,
});
