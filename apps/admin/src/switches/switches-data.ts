import { FeatureSwitchesSchema, type FeatureSwitch } from '@slovo/contracts';
import type { AdminEdition } from '@slovo/contracts/admin-api';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';

import { adminApi } from '../api';
import { editionsQuery } from '../queries';

export const FEATURES: readonly FeatureSwitch[] = FeatureSwitchesSchema.keyof().options;

/** The key of every Edition's switches; a write refetches them all. */
const SWITCHES_KEY = ['switches'] as const;

/** An Edition with its switches loaded. */
export interface Column {
  readonly edition: AdminEdition;
  readonly answer: Awaited<ReturnType<typeof adminApi.switches>>;
}

/**
 * The switches every tab of Свічі reads: the Editions, each one's answer once
 * loaded, the Edition the global filter picks, and a refetch after a write.
 */
export function useSwitches() {
  const search = useSearch({ from: '__root__' });
  const queryClient = useQueryClient();
  const editionsAnswer = useQuery(editionsQuery);
  const editions = editionsAnswer.data?.editions ?? [];
  const answers = useQueries({
    queries: editions.map((edition) => ({
      queryKey: [...SWITCHES_KEY, edition.id],
      queryFn: () => adminApi.switches({ editionId: edition.id }),
      retry: false,
    })),
  });
  const loaded: readonly Column[] = editions.flatMap((edition, index) => {
    const answer = answers[index]?.data;
    return answer === undefined ? [] : [{ edition, answer }];
  });
  const picked = editions.find((edition) => edition.id === search.edition);
  const answerOf = (edition: AdminEdition) =>
    loaded.find((column) => column.edition === edition)?.answer;
  return {
    editions,
    /** The Editions answered, so an unpicked filter means every Edition and not «none known yet». */
    editionsLoaded: editionsAnswer.isSuccess,
    /** The Editions or a switches answer failed to load. */
    failed: editionsAnswer.isError || answers.some((answer) => answer.isError),
    loaded,
    /** Every Edition answered. */
    ready: editions.length > 0 && loaded.length === editions.length,
    picked,
    pickedAnswer: picked === undefined ? undefined : answerOf(picked),
    answerOf,
    refetch: () => queryClient.invalidateQueries({ queryKey: SWITCHES_KEY }),
  };
}
