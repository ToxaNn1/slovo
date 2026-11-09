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
    <section aria-label="Мої сесії" className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Сесія закінчується після 8 годин без дій і через 30 днів після входу.
      </p>
      <ul aria-label="Сесії" className="flex flex-col gap-2">
        {(sessions.data?.sessions ?? []).map((session) => (
          <li
            key={session.createdAt}
            className="rounded-[14px] bg-surface px-4 py-3 shadow-panel text-sm"
          >
            Вхід {when(session.createdAt)} · остання дія {when(session.lastSeenAt)}
            {session.current ? ' · ця сесія' : ''}
          </li>
        ))}
      </ul>
      <div>
        <Button
          variant="secondary"
          disabled={everywhere.isPending}
          onClick={() => {
            everywhere.mutate();
          }}
        >
          Вийти всюди
        </Button>
      </div>
    </section>
  );
}
