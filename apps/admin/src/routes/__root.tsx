import { createRootRoute, Outlet, useLocation } from '@tanstack/react-router';
import { AccountMenu } from '../components/account-menu';
import { FiltersBar, useEditionLabel } from '../components/filters-bar';
import { PhoneShell } from '../components/phone-shell';
import { Logo, Sidebar } from '../components/sidebar';
import { SignIn } from '../components/sign-in';
import { Button } from '../components/ui/button';
import { FiltersSchema } from '../filters';
import { useWide } from '../screen-width';
import { sectionOf } from '../sections';
import { useSession } from '../session';
import { useTheme } from '../theme';

export const Route = createRootRoute({
  validateSearch: (search) => FiltersSchema.parse(search),
  component: Layout,
});

/** The section's title and line in the header; «Мої сесії» is off the sidebar. */
function useHeading(): { readonly title: string; readonly subtitle: string } {
  const { pathname } = useLocation();
  const edition = useEditionLabel();
  const section = sectionOf(pathname);
  if (section === undefined) return { title: 'Мої сесії', subtitle: '' };
  return { title: section.title, subtitle: section.subtitle(edition) };
}

/**
 * The admin of a signed-in Admin user; the sign-in without a session; a
 * retry when the backend fails to answer who is signed in. A phone gets
 * bottom tabs instead of the sidebar.
 */
function Layout() {
  const [theme, setTheme] = useTheme();
  const session = useSession();
  const wide = useWide();
  const heading = useHeading();
  if (session.kind === 'pending') return null;
  if (session.kind === 'signed-out') return <SignIn />;
  if (session.kind === 'failed') {
    return (
      <main className="admin-page flex min-h-screen flex-col items-center justify-center gap-4 p-4 font-sans text-foreground">
        <p role="alert" className="text-sm text-destructive">
          Не вдалося. Спробуйте ще раз.
        </p>
        <Button variant="secondary" onClick={session.retry}>
          Спробувати ще раз
        </Button>
      </main>
    );
  }
  const { admin } = session;
  if (!wide) {
    return (
      <PhoneShell admin={admin} theme={theme} setTheme={setTheme}>
        <Outlet />
      </PhoneShell>
    );
  }
  const account = <AccountMenu admin={admin} theme={theme} setTheme={setTheme} />;
  return (
    <div className="admin-page grid min-h-screen grid-cols-[236px_minmax(0,1fr)] font-sans text-foreground">
      <aside className="sticky top-0 flex h-screen flex-col overflow-auto border-r border-side-border bg-side text-side-foreground">
        <div className="px-[18px] pt-5 pb-[18px]">
          <Logo />
        </div>
        <div className="px-2.5 py-1">
          <Sidebar role={admin.role} />
        </div>
        <div className="mt-auto p-2.5">{account}</div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-4 bg-background/80 px-7 py-3.5 backdrop-blur-[14px]">
          <div className="flex min-w-60 flex-1 flex-col gap-0.5">
            <h1 className="font-display text-[22px] font-medium tracking-[-0.01em]">
              {heading.title}
            </h1>
            {heading.subtitle === '' ? null : (
              <span className="text-[13px] text-subtle">{heading.subtitle}</span>
            )}
          </div>
          <FiltersBar />
        </header>
        <main className="flex flex-1 flex-col px-7 pt-2 pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
