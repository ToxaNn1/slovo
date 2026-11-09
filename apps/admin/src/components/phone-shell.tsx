import { Link, useLocation } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';

import type { SignedInAdmin } from '../session';
import type { Theme } from '../theme';
import { AccountMenu } from './account-menu';
import { FiltersBar } from './filters-bar';
import { Logo } from './sidebar';

/** The two sections a phone opens; the rest want a big screen. */
const PHONE_TITLES: Readonly<Record<string, string>> = {
  '/': 'Огляд',
  '/switches/kill': 'Аварійний вимикач',
};

const tabClass =
  'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[14px] text-xs text-side-muted no-underline data-current:bg-side-active data-current:font-semibold data-current:text-side-foreground';

/**
 * The admin on a phone: the header with the section's title, the Theme and
 * the account, and the bottom tabs Огляд, Вимикач and Ще. Only Огляд and the
 * Kill switch open here; any other section, and Ще, say to open a computer.
 */
export function PhoneShell({
  admin,
  theme,
  setTheme,
  children,
}: {
  readonly admin: SignedInAdmin;
  readonly theme: Theme;
  readonly setTheme: (theme: Theme) => void;
  readonly children: ReactNode;
}) {
  const { pathname } = useLocation();
  // The path Ще was opened on: opening a tab closes it.
  const [moreAt, setMoreAt] = useState<string>();
  const sectionTitle = PHONE_TITLES[pathname];
  const more = moreAt === pathname || sectionTitle === undefined;
  const current = more ? 'more' : pathname;
  // The router marks the route's Link aria-current itself, also under Ще,
  // so the open tab is drawn from data-current.
  const tab = (id: string) => (current === id ? '' : undefined);
  const closeMore = () => {
    setMoreAt(undefined);
  };

  return (
    <div className="admin-page flex min-h-screen flex-col pb-[84px] font-sans text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-2.5 bg-background/80 px-4 py-3 backdrop-blur-[14px]">
        <Logo withName={false} />
        <strong className="flex-1 font-display text-[15px] font-medium">
          {more ? 'Ще' : sectionTitle}
        </strong>
        <button
          type="button"
          aria-label={theme === 'dark' ? 'Світла тема' : 'Темна тема'}
          onClick={() => {
            setTheme(theme === 'dark' ? 'light' : 'dark');
          }}
          className="size-10 rounded-xl bg-surface text-[15px] text-muted-foreground shadow-panel"
        >
          {theme === 'dark' ? '☾' : '☀'}
        </button>
        <AccountMenu admin={admin} theme={theme} setTheme={setTheme} compact />
      </header>
      {more ? (
        <MoreScreen onOverview={closeMore} />
      ) : (
        <main className="flex flex-1 flex-col gap-3 px-4 pt-1 pb-4">
          {/* The Kill switch picks its own place; the filters are Огляд's. */}
          {current === '/' ? <FiltersBar /> : null}
          {children}
        </main>
      )}
      {current === '/' ? (
        <div className="fixed inset-x-4 bottom-[84px] z-10">
          <Link
            to="/switches/kill"
            search={(previous) => previous}
            className="block w-full rounded-[18px] bg-destructive p-[17px] text-center text-base font-semibold text-white no-underline shadow-[0_10px_30px_-8px_var(--destructive)]"
          >
            Аварійний вимикач
          </Link>
        </div>
      ) : null}
      <nav
        aria-label="Вкладки"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t border-side-border bg-side px-2.5 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]"
      >
        <Link
          to="/"
          search={(previous) => previous}
          onClick={closeMore}
          data-current={tab('/')}
          className={tabClass}
        >
          <Dot on={current === '/'} />
          Огляд
        </Link>
        <Link
          to="/switches/kill"
          search={(previous) => previous}
          onClick={closeMore}
          data-current={tab('/switches/kill')}
          className={tabClass}
        >
          <Dot on={current === '/switches/kill'} danger />
          Вимикач
        </Link>
        <button
          type="button"
          aria-current={more ? 'page' : undefined}
          data-current={tab('more')}
          onClick={() => {
            setMoreAt(pathname);
          }}
          className={tabClass}
        >
          <Dot on={more} />
          Ще
        </button>
      </nav>
    </div>
  );
}

function Dot({ on, danger = false }: { readonly on: boolean; readonly danger?: boolean }) {
  const color = on ? (danger ? 'bg-destructive' : 'bg-primary') : 'bg-transparent';
  return <span aria-hidden className={`size-1.5 rounded-full ${color}`} />;
}

/** Ще: the other sections work on a big screen only. */
function MoreScreen({ onOverview }: { readonly onOverview: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <main className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <strong className="font-display text-[17px] font-medium">Відкрийте на комп’ютері</strong>
      <span className="max-w-[300px] text-sm leading-normal text-muted-foreground">
        Контент, свічі, аналітика, якість, розробка й безпека працюють лише на великому екрані.
      </span>
      <div className="mt-2.5 flex w-full max-w-[300px] flex-col gap-2">
        <Link
          to="/"
          search={(previous) => previous}
          onClick={onOverview}
          className="grid min-h-12 place-items-center rounded-[14px] bg-primary text-sm font-medium text-primary-foreground no-underline"
        >
          До Огляду
        </Link>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(window.location.href).then(() => {
              setCopied(true);
            });
          }}
          className="min-h-12 rounded-[14px] bg-sunk text-sm text-foreground"
        >
          {copied ? 'Посилання скопійовано' : 'Скопіювати посилання'}
        </button>
      </div>
    </main>
  );
}
