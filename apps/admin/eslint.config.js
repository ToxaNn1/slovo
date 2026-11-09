import shared from '@slovo/config/eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  // The router plugin writes routeTree.gen.ts from src/routes.
  { ignores: ['dist/**', 'src/routeTree.gen.ts'] },
  ...shared,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.flat['recommended-latest'].rules,
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
