import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const label: Record<Theme, string> = {
  light: 'Увімкнути темну тему',
  dark: 'Увімкнути світлу тему',
};

/**
 * The light/dark switch in the header. The page follows the reader's system
 * Theme until the switch picks one; the pick lasts for the visit.
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

  const dark = theme === 'dark';
  return (
    <button
      type="button"
      aria-label={label[theme]}
      title={label[theme]}
      onClick={() => {
        setChosen(dark ? 'light' : 'dark');
      }}
      className="relative h-8 w-[60px] flex-none cursor-pointer rounded-full border-0 bg-red-edge p-0"
    >
      <Sun className="absolute top-2 left-2 size-4 text-cream opacity-60" />
      <Moon className="absolute top-2 right-2 size-4 text-cream opacity-60" />
      <span
        className={`absolute top-1 left-1 grid size-6 place-items-center rounded-full transition-transform duration-[220ms] ease-[cubic-bezier(.3,1.4,.5,1)] ${
          dark ? 'translate-x-7 bg-coal text-cream' : 'bg-cream text-red'
        }`}
      >
        {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </span>
    </button>
  );
}

function Sun({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </svg>
  );
}

function Moon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z" />
    </svg>
  );
}
