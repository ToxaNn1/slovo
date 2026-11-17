import type { Service } from '@slovo/contracts/admin-api';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { adminApi } from '../api';
import { ServiceCards, ServicesCanvas } from '../components/services/canvas';
import { AddService, ServiceCostsHeader } from '../components/services/service-money';
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
  // By id, so the panel shows the Service as the list reads it after a write.
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
        <ServicesCanvas services={list} onOpen={setOpen} />
      ) : (
        <ServiceCards services={list} onOpen={setOpen} />
      )}
      {open === undefined ? null : (
        <ServicePanel
          service={open}
          onClose={() => {
            setOpenId(undefined);
          }}
        />
      )}
    </>
  );
}
