/** A section of the Owner admin behind the sidebar (ADR 0088). */
export interface Section {
  /** The route under `/admin`. */
  readonly path: '/' | `/${string}`;
  readonly title: string;
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
    empty: 'Тут буде короткий стан усіх Editions: версії, збої й Черга контенту.',
  },
  { path: '/content', title: 'Контент', empty: 'Тут будуть записи Editions і Черга контенту.' },
  { path: '/switches', title: 'Свічі', empty: 'Тут будуть Feature Switches і їхні правила.' },
  { path: '/analytics', title: 'Аналітика', empty: 'Тут будуть дані PostHog і суми лічильників.' },
  { path: '/quality', title: 'Якість', empty: 'Тут будуть збої з Sentry та історія CI.' },
  { path: '/development', title: 'Розробка', empty: 'Тут будуть версії, pull requests і збірки.' },
  {
    path: '/security',
    title: 'Безпека',
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
