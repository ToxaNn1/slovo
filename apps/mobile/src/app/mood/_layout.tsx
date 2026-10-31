import { ScreenStack } from '@/entries/screen-stack';

/**
 * The mood roulette's own stack: the Word it landed on, and the Entry screens
 * its card opens. The next Word it lands on takes the place of all of them
 * (`MoodButtonAndSheet`).
 */
export default function MoodLayout() {
  return <ScreenStack />;
}
