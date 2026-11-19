import type { UsdRate } from '@slovo/contracts/admin-api';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from '../../api';
import { useCurrency, type Currency } from '../../currency';

const PILL =
  'rounded-full border border-border px-3 py-1 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground';

/** Dollars of the cents: whole dollars without cents, «$4.50» with them. */
export function usd(cents: number): string {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2)}`;
}

/** Whole hryvnias of the dollar cents at the rate, «2 013 ₴». */
const uah = (cents: number, rate: UsdRate): string =>
  `${Math.round((cents / 100) * rate.uahPerUsd).toLocaleString('uk-UA')} ₴`;

/** The NBU rate the hryvnias are counted at, kept by the backend for the Kyiv day. */
function useUsdRate() {
  return useQuery({
    queryKey: ['services', 'usd-rate'],
    queryFn: () => adminApi.services.usdRate(),
  });
}

/**
 * The money of dollar cents in the currency this device picked: hryvnias at
 * the NBU rate, or the dollars `usd` writes while no rate is known.
 */
export function useMoney(usd: (cents: number) => string): (cents: number) => string {
  const [currency] = useCurrency();
  const rate = useUsdRate().data?.rate;
  return (cents) =>
    currency === 'UAH' && rate !== undefined && rate !== null ? uah(cents, rate) : usd(cents);
}

/** «17 листопада» of a day `YYYY-MM-DD`. */
const dayOf = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

/** What the hryvnias stand on: the NBU rate and its day, or that none is known. */
function RateLine() {
  const rate = useUsdRate();
  if (rate.data === undefined) return null;
  const known = rate.data.rate;
  if (known === null) {
    return <p className="text-sm text-muted-foreground">Курс НБУ невідомий, суми в доларах.</p>;
  }
  const lastKnown = known.state === 'last-known' ? ' (останній відомий)' : '';
  const value = known.uahPerUsd.toLocaleString('uk-UA', { maximumFractionDigits: 4 });
  return (
    <p className="text-sm text-muted-foreground">
      {`Курс НБУ на ${dayOf(known.on)}${lastKnown}: $1 = ${value} ₴`}
    </p>
  );
}

const CURRENCIES: readonly Currency[] = ['USD', 'UAH'];

/** The USD/UAH switch of «Сервіси», remembered on this device; in hryvnias it names the rate. */
export function CurrencySwitch() {
  const [currency, pick] = useCurrency();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div role="group" aria-label="Валюта" className="flex gap-1">
        {CURRENCIES.map((each) => (
          <button
            key={each}
            type="button"
            className={PILL}
            aria-pressed={currency === each}
            onClick={() => {
              pick(each);
            }}
          >
            {each}
          </button>
        ))}
      </div>
      {currency === 'UAH' ? <RateLine /> : null}
    </div>
  );
}
