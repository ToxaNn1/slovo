import { describe, expect, it } from 'vitest';

import { checkEditionsMatch } from './edition-match';

describe('checkEditionsMatch', () => {
  it('accepts a build whose native app, JavaScript bundle and Language Pack share an Edition', () => {
    expect(() => {
      checkEditionsMatch({ native: 'uk', bundle: 'uk', languagePack: 'uk' });
    }).not.toThrow();
  });

  it('names the Edition each side belongs to when the Language Pack differs', () => {
    expect(() => {
      checkEditionsMatch({ native: 'uk', bundle: 'uk', languagePack: 'pl' });
    }).toThrow(/native app: "uk".*JavaScript bundle: "uk".*Language Pack: "pl"/s);
  });

  it('rejects a JavaScript bundle of another Edition than the native app', () => {
    expect(() => {
      checkEditionsMatch({ native: 'pl', bundle: 'uk', languagePack: 'uk' });
    }).toThrow(/native app: "pl"/);
  });

  it('skips the native side when the build does not report its Edition', () => {
    expect(() => {
      checkEditionsMatch({ native: undefined, bundle: 'uk', languagePack: 'uk' });
    }).not.toThrow();
    expect(() => {
      checkEditionsMatch({ native: undefined, bundle: 'uk', languagePack: 'pl' });
    }).toThrow(/Language Pack: "pl"/);
  });
});
