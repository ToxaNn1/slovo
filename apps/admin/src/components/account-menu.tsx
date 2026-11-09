import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import { adminApi } from '../api';
import { ME_KEY, type SignedInAdmin } from '../session';
import type { Theme } from '../theme';

const ROLE_LABEL = { owner: 'Власник', admin: 'Адмін' } as const;

const THEMES: readonly (readonly [Theme, string])[] = [
  ['light', 'Світла'],
  ['dark', 'Темна'],
];

const itemClass =
  'rounded-[9px] px-2.5 py-[9px] text-left text-[13px] hover:bg-side-hover disabled:opacity-50';

/**
 * The signed-in Admin user: at the foot of the sidebar a card, in the phone's
 * header only the avatar; either opens the Theme, «Мої сесії» and «Вийти».
 * Escape or a click outside closes it.
 */
export function AccountMenu({
  admin,
  theme,
  setTheme,
  compact = false,
}: {
  readonly admin: SignedInAdmin;
  readonly theme: Theme;
  readonly setTheme: (theme: Theme) => void;
  readonly compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: () => adminApi.signOut(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_KEY }),
  });

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      const outside =
        event.type === 'pointerdown' &&
        event.target instanceof Node &&
        !root.current?.contains(event.target);
      if (outside || (event instanceof KeyboardEvent && event.key === 'Escape')) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      {open ? (
        <div
          className={`absolute z-20 flex flex-col ${compact ? 'top-[calc(100%+6px)] right-0 w-60' : 'inset-x-0 bottom-[calc(100%-2px)]'}`}
        >
          <div className="flex flex-col gap-0.5 rounded-[14px] bg-side-pop p-1.5 text-side-foreground shadow-[0_0_0_1px_var(--side-border),0_16px_40px_rgb(0_0_0/0.3)]">
            <span className="mb-1 truncate border-b border-side-border px-2.5 pt-2 pb-2.5 text-[12.5px]">
              {admin.email}
            </span>
            <span className="px-2.5 pt-1.5 pb-1 text-[11px] text-side-muted">Тема</span>
            <div className="mx-1.5 mb-1.5 flex gap-0.5 rounded-[9px] bg-side-hover p-[3px]">
              {THEMES.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={theme === id}
                  onClick={() => {
                    setTheme(id);
                  }}
                  className="flex-1 rounded-[7px] px-1 py-1.5 text-xs text-side-muted aria-pressed:bg-side-active aria-pressed:text-side-foreground"
                >
                  {label}
                </button>
              ))}
            </div>
            <Link
              to="/sessions"
              search={(previous) => previous}
              onClick={() => {
                setOpen(false);
              }}
              className={`${itemClass} text-side-foreground no-underline`}
            >
              Мої сесії
            </Link>
            <button
              type="button"
              disabled={signOut.isPending}
              onClick={() => {
                signOut.mutate();
              }}
              className={`${itemClass} text-destructive`}
            >
              Вийти
            </button>
          </div>
        </div>
      ) : null}
      {compact ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${admin.email} ${ROLE_LABEL[admin.role]}`}
          onClick={() => {
            setOpen(!open);
          }}
          className="grid size-10 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground uppercase"
        >
          {admin.email.slice(0, 1)}
        </button>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
          className={`flex w-full items-center gap-2.5 rounded-xl p-2 text-left text-side-foreground hover:bg-side-hover ${open ? 'bg-side-hover' : ''}`}
        >
          <span
            aria-hidden
            className="grid size-8 flex-none place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground uppercase"
          >
            {admin.email.slice(0, 1)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-[13px] font-semibold">{admin.email}</span>
            <span className="text-xs text-side-muted">{ROLE_LABEL[admin.role]}</span>
          </span>
          <span aria-hidden className="text-xs text-side-muted">
            {open ? '▾' : '▴'}
          </span>
        </button>
      )}
    </div>
  );
}
