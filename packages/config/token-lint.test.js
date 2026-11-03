import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Linter } from 'eslint';

import tokenLint from './token-lint.js';

const linter = new Linter({ configType: 'flat' });

/** The messages the token rule gives for `code` in a component's file. */
function lint(code, filename = 'src/Card.tsx') {
  return linter.verify(code, tokenLint, filename).map((m) => m.message);
}

test('refuses a hand-written font weight', () => {
  const messages = lint("const s = { title: { fontWeight: '700' } };");
  assert.equal(messages.length, 1);
  assert.match(messages[0], /type role/);
});

test('refuses a hand-written font family', () => {
  assert.equal(lint('const s = { title: { fontFamily: families.ui } };').length, 1);
});

test('lets a type role set the text', () => {
  assert.deepEqual(lint("const s = [typeStyle('meta', tokens), { color: ink }];"), []);
});

test('leaves the role table in the tokens folder alone', () => {
  const messages = lint("const r = { fontWeight: '900' };", 'src/tokens/base.ts');
  assert.ok(!messages.some((m) => /type role/.test(m)));
});
