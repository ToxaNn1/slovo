import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const label: Record<Theme, string> = { light: 'Світла', dark: 'Темна' };

/**
 * The light/dark switch. The page follows the reader's system Theme until
 * the switch picks one; the pick lasts for the visit.
 */
export function ThemeToggle() {
  const [chosen, setChosen] = useState<Theme | null>(null);
  const [system, setSystem] = useState<Theme>('light');

  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const follow = () => {
      setSystem(query.matches ? 'dark' : 'light');
    };
    follow();
    query.addEventListener('change', follow);
    return () => {
      query.removeEventListener('change', follow);
    };
  }, []);

  const theme = chosen ?? system;
  useEffect(() => {
    document.documentElement.dataset['th'] = theme;
  }, [theme]);

  return (
    <button
      type="button"
      aria-label="Змінити тему"
      onClick={() => {
        setChosen(theme === 'dark' ? 'light' : 'dark');
      }}
      className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border-0 bg-sf2 px-3.5 font-word text-xs leading-none font-extrabold text-ink shadow-[0_4px_0_var(--edge)] active:translate-y-1 active:shadow-none"
    >
      <span className="size-3.5 rounded-full border-2 border-ink bg-[linear-gradient(90deg,var(--ink)_50%,transparent_50%)]" />
      <span>{label[theme]}</span>
    </button>
  );
}
