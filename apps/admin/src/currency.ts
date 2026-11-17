import { useSyncExternalStore } from 'react';

/** The currency «Сервіси» shows the money in. */
export type Currency = 'USD' | 'UAH';

const KEY = 'slovo-admin-currency';

/** A pick storage refused to keep: it lasts until the page reloads. */
let unkept: Currency | undefined;
const listeners = new Set<() => void>();

/** The Currency kept in storage; none when storage is blocked or holds none. */
function keptCurrency(): Currency | undefined {
  try {
    const kept = window.localStorage.getItem(KEY);
    return kept === 'USD' || kept === 'UAH' ? kept : undefined;
  } catch {
    return undefined;
  }
}

const currencyNow = (): Currency => keptCurrency() ?? unkept ?? 'USD';

function pickCurrency(next: Currency) {
  try {
    window.localStorage.setItem(KEY, next);
    unkept = undefined;
  } catch {
    // Blocked storage only forgets the pick on the next visit.
    unkept = next;
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The currency of «Сервіси» on this device (ADR 0164): the one the owner
 * picked last, else dollars. Every place that shows money follows one pick.
 */
export function useCurrency(): readonly [Currency, (currency: Currency) => void] {
  return [useSyncExternalStore(subscribe, currencyNow), pickCurrency];
}
