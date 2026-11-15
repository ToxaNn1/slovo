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

  return (
    <button
      type="button"
      aria-label={label[theme]}
      onClick={() => {
        setChosen(theme === 'dark' ? 'light' : 'dark');
      }}
      className="relative h-[30px] w-[52px] flex-none cursor-pointer rounded-[15px] border-0 bg-red-edge p-0"
    >
      <span
        className={`absolute top-[3px] left-[3px] size-6 rounded-xl transition-transform duration-[220ms] ease-[cubic-bezier(.3,1.4,.5,1)] ${
          theme === 'dark' ? 'translate-x-[22px] bg-coal' : 'bg-cream'
        }`}
      />
    </button>
  );
}
