import shared from '@slovo/config/eslint';
import { tokenScope, tokenSelectors } from '@slovo/config/token-lint';
import reactHooks from 'eslint-plugin-react-hooks';

const cyrillicBan = {
  selector:
    'Literal[value=/[\\u0400-\\u04FF]/], TemplateElement[value.raw=/[\\u0400-\\u04FF]/], JSXText[value=/[\\u0400-\\u04FF]/]',
  message: 'The UI must not contain language-specific text; read it from the Edition.',
};

const compilerRulesOff = Object.fromEntries(
  Object.keys(reactHooks.configs.flat['recommended-latest'].rules)
    .filter((rule) => !['react-hooks/rules-of-hooks', 'react-hooks/exhaustive-deps'].includes(rule))
    .map((rule) => [rule, 'off']),
);

export default [
  ...shared,
  {
    // Text and token values come from the Edition, never from the UI code.
    // Cyrillic text is the tripwire for the Ukrainian Edition leaking in.
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', cyrillicBan],
    },
  },
  {
    // The same array again with the token selectors, for every file the token
    // rule covers: a later declaration replaces the earlier one.
    ...tokenScope,
    rules: {
      'no-restricted-syntax': ['error', cyrillicBan, ...tokenSelectors],
    },
  },
  {
    // The rules of hooks, effect dependencies and the React Compiler's rules.
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.flat['recommended-latest'].rules,
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // Modules with Reanimated or gesture code opt out of the compiler with
    // 'use no memo' (ADR 0059), so its rules do not apply to them.
    files: [
      'src/decor/DecorSlots.tsx',
      'src/feed/FeedStates.tsx',
      'src/game/GameRound.tsx',
      'src/game/OrderedChips.tsx',
      'src/game/PairsGrid.tsx',
      'src/game/VowelButtons.tsx',
      'src/onboarding/Onboarding.tsx',
      'src/onboarding/SplashOverlay.tsx',
      'src/progress/ActiveDaysCalendar.tsx',
      'src/primitives/BottomSheet.tsx',
      'src/primitives/UndoToast.tsx',
      'src/primitives/VerticalPager.tsx',
      'src/saved/FavoriteButton.tsx',
      'src/settings/WidgetGuide.tsx',
      'src/share/ShareSheet.tsx',
    ],
    rules: compilerRulesOff,
  },
];
