/** A section of the Owner admin behind the sidebar (ADR 0088). */
export interface Section {
  /** The route under `/admin`. */
  readonly path:
    '/' | '/content' | '/switches' | '/analytics' | '/quality' | '/development' | '/security';
  readonly title: string;
  /** The line under the title in the header; it may name the Edition filter's choice. */
  readonly subtitle: (edition: string) => string;
  /** The empty state's line until the section's own ticket fills it. */
  readonly empty: string;
  /** Whether only a Власник opens it: Безпека. */
  readonly ownerOnly?: true;
}

/** The seven sections in sidebar order; Магазини is deferred whole. */
export const SECTIONS = [
  {
    path: '/',
    title: 'Огляд',
    subtitle: (edition) => `Як почуваються застосунки · ${edition}`,
    empty: 'Тут буде короткий стан усіх Editions: версії, збої й Черга контенту.',
  },
  {
    path: '/content',
    title: 'Контент',
    subtitle: (edition) => `${edition} · кожне збереження одразу публікується`,
    empty: 'Тут будуть записи Editions і Черга контенту.',
  },
  {
    path: '/switches',
    title: 'Свічі',
    subtitle: () => 'Feature Switch: увімкнено, вимкнено або недоступно',
    empty: 'Тут будуть Feature Switches і їхні правила.',
  },
  {
    path: '/analytics',
    title: 'Аналітика',
    subtitle: () => 'Лише узагальнені дані, без списків людей',
    empty: 'Тут будуть дані PostHog і суми лічильників.',
  },
  {
    path: '/quality',
    title: 'Якість',
    subtitle: () => 'Топ помилок і падінь · Sentry',
    empty: 'Тут будуть збої з Sentry та історія CI.',
  },
  {
    path: '/development',
    title: 'Розробка',
    subtitle: () => 'CI і PR · GitHub',
    empty: 'Тут будуть версії, pull requests і збірки.',
  },
  {
    path: '/security',
    title: 'Безпека',
    subtitle: () => 'Тільки Власник',
    empty: 'Тут будуть люди, токени Агентів і Action log.',
    ownerOnly: true,
  },
] as const satisfies readonly Section[];

/** The sections the Admin user of the role opens: an Адмін has no Безпека. */
export const sectionsOf = (role: 'owner' | 'admin'): readonly Section[] =>
  role === 'owner' ? SECTIONS : SECTIONS.filter((section: Section) => section.ownerOnly !== true);

export function sectionAt(path: Section['path']): Section {
  const section = SECTIONS.find((candidate) => candidate.path === path);
  if (section === undefined) throw new Error(`No admin section at ${path}`);
  return section;
}

/** The section a path of the admin opens, `undefined` off the sidebar («Мої сесії»). */
export function sectionOf(pathname: string): Section | undefined {
  return SECTIONS.find((section: Section) =>
    section.path === '/'
      ? pathname === '/'
      : pathname === section.path || pathname.startsWith(`${section.path}/`),
  );
}
