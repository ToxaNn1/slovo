import { createFileRoute } from '@tanstack/react-router';

import { ContentQueue } from '../components/content-queue/content-queue';

export const Route = createFileRoute('/content/queue')({
  component: ContentQueue,
});
