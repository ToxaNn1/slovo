import { FeatureSwitchesSchema } from '@slovo/contracts';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { RuleTab } from '../switches/rule-tab';

/** The feature whose Rules the tab opens; a name the URL can't hold opens none. */
const RuleSearchSchema = z.object({
  feature: FeatureSwitchesSchema.keyof().optional().catch(undefined),
});

export const Route = createFileRoute('/switches/rule')({
  validateSearch: (search) => RuleSearchSchema.parse(search),
  component: Rule,
});

function Rule() {
  const { feature } = Route.useSearch();
  return <RuleTab feature={feature} />;
}
