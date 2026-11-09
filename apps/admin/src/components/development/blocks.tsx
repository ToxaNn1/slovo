import type { Development, EasBuild, MainCi, Milestone } from '@slovo/contracts/admin-api';
import type { ReactNode } from 'react';

type GitHubRead = Extract<Development['github'], { state: 'ok' }>;

/** A time as Kyiv reads it, hours and minutes. */
const kyivTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
  });

const kyivDate = (iso: string) =>
  new Date(iso).toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'medium' });

/** One block of Розробка: a titled card. */
function Block({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  const id = `block-${title.replace(/\s+/g, '-')}`;
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-2xl bg-surface shadow-panel p-5"
    >
      <h3 id={id} className="font-display text-base font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

const Quiet = ({ children }: { readonly children: ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
);

/** A source's group: its name, the time of its data and its blocks, or that it is unavailable. */
export function Source({
  name,
  read,
  children,
}: {
  readonly name: 'GitHub' | 'EAS';
  readonly read: Development['github'] | Development['eas'];
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg font-medium">{name}</h2>
        {read.state === 'ok' && <Quiet>Останні дані за {kyivTime(read.fetchedAt)}</Quiet>}
      </div>
      {read.state === 'ok' ? (
        children
      ) : (
        <div
          role="status"
          className="flex flex-col items-start gap-1.5 rounded-2xl bg-surface p-5 shadow-panel"
        >
          <p className="font-medium text-destructive">{name} недоступний</p>
        </div>
      )}
    </div>
  );
}

const CI_LABEL = { success: 'успішно', failure: 'впав', pending: 'триває' } as const;

export function CiBadge({ ci }: { readonly ci: MainCi }) {
  if (ci.state === 'none') return <Quiet>Запусків ще не було</Quiet>;
  const tone =
    ci.state === 'success'
      ? 'border-primary text-primary'
      : ci.state === 'failure'
        ? 'border-destructive text-destructive'
        : 'border-border text-muted-foreground';
  return (
    <p className="flex items-center gap-3 text-sm">
      <a href={ci.url} className={`rounded-full border px-3 py-1 font-medium ${tone}`}>
        {CI_LABEL[ci.state]}
      </a>
      {ci.state !== 'pending' && (
        <span className="text-muted-foreground">{kyivDate(ci.finishedAt)}</span>
      )}
    </p>
  );
}

function Versions({ milestones }: { readonly milestones: readonly Milestone[] }) {
  if (milestones.length === 0) return <Quiet>Версій ще немає</Quiet>;
  return (
    <ul className="flex flex-col gap-2">
      {milestones.map(({ title, open, closed }) => {
        const total = open + closed;
        const share = total === 0 ? 0 : Math.round((closed / total) * 100);
        return (
          <li key={title} className="grid grid-cols-[3rem_1fr_5rem] items-center gap-3 text-sm">
            <span className="font-medium">{title}</span>
            <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="block h-full bg-primary" style={{ width: `${String(share)}%` }} />
            </span>
            <span className="text-right text-muted-foreground">
              {closed} з {total}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The GitHub blocks: pull requests, CI on `main`, the version progress and releases. */
export function GitHubBlocks({ read }: { readonly read: GitHubRead }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Block title="Pull requests">
        {read.pullRequests.length === 0 ? (
          <Quiet>Відкритих pull requests немає</Quiet>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {read.pullRequests.map((pull) => (
              <li key={pull.number} className="flex flex-col">
                <a href={pull.url} className="font-medium hover:underline">
                  {pull.title}
                </a>
                <span className="text-muted-foreground">
                  #{pull.number} · {pull.author}
                  {pull.draft ? ' · чернетка' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Block>
      <Block title="CI на main">
        <CiBadge ci={read.mainCi} />
      </Block>
      <Block title="Прогрес версій">
        <Versions milestones={read.milestones} />
      </Block>
      <Block title="Релізи">
        {read.releases.length === 0 ? (
          <Quiet>Релізів ще немає</Quiet>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {read.releases.map((release) => (
              <li key={release.tag} className="flex justify-between gap-3">
                <a href={release.url} className="font-medium hover:underline">
                  {release.tag}
                </a>
                <span className="text-muted-foreground">{kyivDate(release.publishedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  );
}

const BUILD_LABEL = {
  finished: 'готова',
  errored: 'впала',
  canceled: 'скасована',
  'in-progress': 'триває',
} as const;

const versionOf = ({ appVersion, buildNumber }: EasBuild) =>
  appVersion === null ? '—' : buildNumber === null ? appVersion : `${appVersion} (${buildNumber})`;

/** The newest EAS builds as a table. */
export function EasBlock({ builds }: { readonly builds: readonly EasBuild[] }) {
  return (
    <Block title="Збірки EAS">
      {builds.length === 0 ? (
        <Quiet>Збірок ще немає</Quiet>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Платформа</th>
              <th className="py-1 font-normal">Профіль</th>
              <th className="py-1 font-normal">Версія</th>
              <th className="py-1 font-normal">Стан</th>
              <th className="py-1 font-normal">Створено</th>
            </tr>
          </thead>
          <tbody>
            {builds.map((build) => (
              <tr key={build.id} className="border-t border-border">
                <td className="py-2">{build.platform === 'ios' ? 'iOS' : 'Android'}</td>
                <td className="py-2">{build.profile}</td>
                <td className="py-2">{versionOf(build)}</td>
                <td className="py-2">
                  <a href={build.url} className="hover:underline">
                    {BUILD_LABEL[build.status]}
                  </a>
                </td>
                <td className="py-2 text-muted-foreground">{kyivDate(build.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Block>
  );
}
