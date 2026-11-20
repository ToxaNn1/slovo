import type { Service } from '@slovo/contracts/admin-api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { adminApi } from '../api';
import { ServiceCards, ServicesCanvas, type UsageById } from '../components/services/canvas';
import { AddService, ServiceCostsHeader } from '../components/services/service-money';
import { ServiceWindow } from '../components/services/service-window';
import { useWide } from '../screen-width';
import { sectionAt } from '../sections';
import { useSignedInAdmin } from '../session';

const section = sectionAt('/services');

export const Route = createFileRoute('/services')({
  component: Services,
});

/** «Сервіси»: a Власник only; an Адмін reads why it stays closed. */
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

/** Every Service on the canvas, or on a phone as cards; a Service opens its window. */
function OwnerServices() {
  const wide = useWide();
  // By id, so the window shows the Service as the list reads it after a write.
  const [openId, setOpenId] = useState<Service['id']>();
  const setOpen = (service: Service) => {
    setOpenId(service.id);
  };
  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => adminApi.services.list(),
  });
  const list = services.data?.services;
  const open = list?.find((service) => service.id === openId);
  const usage = useServiceUsage();
  return (
    <>
      {services.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Не вдалося завантажити.
        </p>
      ) : null}
      {services.data === undefined ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ServiceCostsHeader costs={services.data.costs} services={services.data.services} />
          <AddService />
        </div>
      )}
      {list === undefined ? null : wide ? (
        <ServicesCanvas services={list} usage={usage.byId} onOpen={setOpen} />
      ) : (
        <ServiceCards services={list} usage={usage.byId} onOpen={setOpen} />
      )}
      {open === undefined ? null : (
        <ServiceWindow
          service={open}
          {...usage.windowOf(open)}
          onClose={() => {
            setOpenId(undefined);
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
    /** The window's usage of the Service, when it has one. */
    windowOf(service: Service) {
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
