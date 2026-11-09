import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { adminApi } from '../api';
import { EasBlock, GitHubBlocks, Source } from '../components/development/blocks';
import { OwnerChecks } from '../components/owner-checks';
import { sectionAt } from '../sections';

const section = sectionAt('/development');

export const Route = createFileRoute('/development')({
  component: Development,
});

/**
 * Розробка: GitHub's pull requests, CI on `main`, version progress and
 * releases, and the newest EAS builds, each source with the time of its data.
 * One repository and one app (ADR 0065): the Edition filter does not apply.
 */
function Development() {
  const development = useQuery({
    queryKey: ['development'],
    queryFn: () => adminApi.development(),
  });
  const { github, eas } = development.data ?? {};
  return (
    <section aria-label={section.title} className="flex flex-col gap-8">
      <OwnerChecks />
      {github !== undefined && (
        <Source name="GitHub" read={github}>
          {github.state === 'ok' && <GitHubBlocks read={github} />}
        </Source>
      )}
      {eas !== undefined && (
        <Source name="EAS" read={eas}>
          {eas.state === 'ok' && <EasBlock builds={eas.builds} />}
        </Source>
      )}
    </section>
  );
}
