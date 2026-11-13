import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';

import { adminApi } from '../../api';

/** The Edition of the global filter, as the queue's input. */
function useEditionInput() {
  const { edition } = useSearch({ from: '__root__' });
  return { edition, input: edition === undefined ? {} : { editionId: edition } };
}

/** The Агент batches not reviewed yet, for the global Edition filter. */
export function useQueueBatches() {
  const { edition, input } = useEditionInput();
  return useQuery({
    queryKey: ['contentQueue', 'batches', edition],
    queryFn: () => adminApi.contentQueue.batches(input),
    retry: false,
  });
}

export function useQueueFlags() {
  const { edition, input } = useEditionInput();
  return useQuery({
    queryKey: ['contentQueue', 'flags', edition],
    queryFn: () => adminApi.contentQueue.flags(input),
    retry: false,
  });
}

export function useQueueReports() {
  const { edition, input } = useEditionInput();
  return useQuery({
    queryKey: ['contentQueue', 'reports', edition],
    queryFn: () => adminApi.contentQueue.reports(input),
    retry: false,
  });
}
