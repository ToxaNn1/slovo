import shared from '@slovo/config/eslint';

export default [...shared, { ignores: ['.expo/**', 'ios/**', 'android/**', 'expo-env.d.ts'] }];
