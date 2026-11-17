import type { Service } from '@slovo/contracts/admin-api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { adminApi } from '../api';
import { ServiceCards, ServicesCanvas, type UsageById } from '../components/services/canvas';
import { ServicePanel } from '../components/services/service-panel';
import { useWide } from '../screen-width';
import { sectionAt } from '../sections';
import { useSignedInAdmin } from '../session';

const section = sectionAt('/services');

export const Route = createFileRoute('/services')({
  component: Services,
});

/** «Сервіси» (ADR 0164): a Власник only; an Адмін reads why it stays closed. */
function Services() {
  const admin = useSignedInAdmin();
  return (
    <section aria-label={section.title} className="flex flex-col gap-4">
      {admin?.role === 'owner' ? (
        <OwnerServices />
      ) : (
        <p className="text-sm text-muted-foreground">Цей розділ відкриває тільки Власник.</p>
      )}
    </section>
  );
}

/** Every Service on the canvas, or on a phone as cards; a Service opens its side panel. */
function OwnerServices() {
  const wide = useWide();
  const [open, setOpen] = useState<Service>();
  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => adminApi.services.list(),
  });
  const list = services.data?.services;
  const usage = useServiceUsage();
  return (
    <>
      {services.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Не вдалося завантажити.
        </p>
      ) : null}
      {list === undefined ? null : wide ? (
        <ServicesCanvas services={list} usage={usage.byId} onOpen={setOpen} />
      ) : (
        <ServiceCards services={list} usage={usage.byId} onOpen={setOpen} />
      )}
      {open === undefined ? null : (
        <ServicePanel
          service={open}
          {...usage.panelOf(open)}
          onClose={() => {
            setOpen(undefined);
          }}
        />
      )}
    </>
  );
}

const USAGE_KEY = ['services', 'usage'];

/**
 * The Services' usage, read apart from the list so the canvas never waits for
 * a provider, and «Оновити», which reads one Service's provider again and puts
 * its answer in place.
 */
function useServiceUsage() {
  const queryClient = useQueryClient();
  const usage = useQuery({
    queryKey: USAGE_KEY,
    queryFn: () => adminApi.services.usage(),
  });
  const refresh = useMutation({
    mutationFn: (serviceId: string) => adminApi.services.refreshUsage({ serviceId }),
    onSuccess: ({ usage: fresh }) => {
      queryClient.setQueryData(USAGE_KEY, (kept: typeof usage.data) => ({
        usage: [
          ...(kept?.usage ?? []).filter(({ serviceId }) => serviceId !== fresh.serviceId),
          fresh,
        ],
      }));
    },
  });
  const byId: UsageById = new Map(
    (usage.data?.usage ?? []).map(({ serviceId, read }) => [serviceId, read]),
  );
  return {
    byId,
    /** The panel's usage of the Service, when it has one. */
    panelOf(service: Service) {
      const read = byId.get(service.id);
      return read === undefined
        ? {}
        : {
            usage: {
              read,
              refreshing: refresh.isPending,
              onRefresh: () => {
                refresh.mutate(service.id);
              },
            },
          };
    },
  };
}
