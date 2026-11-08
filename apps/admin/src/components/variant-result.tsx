import { useQuery } from '@tanstack/react-query';

import { adminApi } from '../api';
import { BarList } from './bar-list';

/** The people active in each Variant of an A/B Feature Switch, from PostHog. */
export function VariantResult({
  editionId,
  feature,
}: {
  readonly editionId: string;
  readonly feature: string;
}) {
  const result = useQuery({
    queryKey: ['variantResults', editionId, feature],
    queryFn: () => adminApi.variantResults({ editionId, feature }),
    retry: false,
  });
  if (result.isError) return <p className="text-sm text-destructive">PostHog недоступний</p>;
  return <BarList label={`Варіанти ${feature}`} rows={result.data?.variants ?? []} />;
}
