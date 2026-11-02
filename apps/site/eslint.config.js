import shared from '@slovo/config/eslint';

// .astro/ holds the types Astro generates at the content sync.
export default [...shared, { ignores: ['.astro/**'] }];
