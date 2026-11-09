import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { adminApi } from '../api';
import { Button } from '../components/ui/button';
import { ME_KEY } from '../session';

export const Route = createFileRoute('/sessions')({
  component: Sessions,
});

const when = (iso: string) =>
  new Date(iso).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });

/** «Мої сесії»: the signed-in Admin user's sessions, and «Вийти всюди». */
function Sessions() {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => adminApi.sessions() });
  const everywhere = useMutation({
    mutationFn: () => adminApi.signOutEverywhere(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_KEY }),
  });
  return (
    <section aria-label="Мої сесії" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          Сесія закінчується після 8 годин без дій і через 30 днів після входу.
        </p>
        <Button
          variant="danger"
          disabled={everywhere.isPending}
          onClick={() => {
            everywhere.mutate();
          }}
        >
          Вийти всюди
        </Button>
      </div>
      <ul
        aria-label="Сесії"
        className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-panel"
      >
        {(sessions.data?.sessions ?? []).map((session) => (
          <li
            key={session.createdAt}
            className="flex flex-wrap items-center gap-3 px-[18px] py-3 text-[13px]"
          >
            <span className="grow">
              Вхід {when(session.createdAt)} · остання дія {when(session.lastSeenAt)}
            </span>
            {session.current ? (
              <span className="rounded-[20px] bg-ok-soft px-[9px] py-[3px] text-[11.5px] font-semibold text-ok">
                ця сесія
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
