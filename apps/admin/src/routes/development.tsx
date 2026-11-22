import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { EasBlock, GitHubBlocks, Source } from '../components/development/blocks';
import { OwnerChecks } from '../components/owner-checks';
import { developmentQuery } from '../queries';
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
  const development = useQuery(developmentQuery);
  // A failed read leaves both sources unavailable, as a source down does.
  const { github, eas } = development.data ?? {
    github: { state: 'unavailable' },
    eas: { state: 'unavailable' },
  };
  return (
    <section aria-label={section.title} className="flex flex-col gap-8">
      <OwnerChecks />
      {development.isPending ? (
        <p className="text-sm text-muted-foreground">Завантаження…</p>
      ) : (
        <>
          <Source name="GitHub" read={github}>
            {github.state === 'ok' && <GitHubBlocks read={github} />}
          </Source>
          <Source name="EAS" read={eas}>
            {eas.state === 'ok' && <EasBlock builds={eas.builds} />}
          </Source>
        </>
      )}
    </section>
  );
}
