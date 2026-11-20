import { useEffect, useState, type ReactElement } from 'react';

/**
 * Settings › «Тестовий профіль», a development build's alone (owner, 20.11).
 * The screen's modules load inside a `__DEV__` branch, so a production
 * bundle holds none of them: there the route draws nothing and no row opens it.
 */
export default function TestProfileRoute() {
  const [screen, setScreen] = useState<ReactElement | undefined>(undefined);
  useEffect(() => {
    if (__DEV__) {
      void Promise.all([
        import('@/settings/test-profile-screen'),
        import('@/shell/test-state-link'),
      ]).then(([{ TestProfileScreen }, { loadTestProfile }]) => {
        setScreen(<TestProfileScreen load={loadTestProfile} />);
      });
    }
  }, []);
  return screen ?? null;
}
