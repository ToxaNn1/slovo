/** A question about one Feature Switch, as the Core asks the Edition. */
function isSwitchQuestion(node) {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'isFeatureEnabled'
  );
}

/** The initializer of the `const` an identifier names, or nothing. */
function constInitializer(sourceCode, identifier) {
  for (let scope = sourceCode.getScope(identifier); scope; scope = scope.upper) {
    const variable = scope.set.get(identifier.name);
    if (!variable) continue;
    const [definition] = variable.defs;
    if (
      variable.defs.length !== 1 ||
      definition.type !== 'Variable' ||
      definition.parent.kind !== 'const'
    ) {
      return null;
    }
    return definition.node.init;
  }
  return null;
}

/**
 * Whether `node` is a switch answer: a switch question, its negation, or a `const`
 * whose initializer is one. A value merely built from an answer is none.
 */
function isSwitchAnswer(sourceCode, node, followed) {
  if (isSwitchQuestion(node)) return true;
  if (node.type === 'UnaryExpression' && node.operator === '!') {
    return isSwitchAnswer(sourceCode, node.argument, followed);
  }
  if (node.type !== 'Identifier') return false;
  const init = constInitializer(sourceCode, node);
  if (!init || followed.has(init)) return false;
  followed.add(init);
  return isSwitchAnswer(sourceCode, init, followed);
}

/** Whether `node` asks about a Feature Switch: it is or holds a switch answer. */
function asksSwitch(sourceCode, node) {
  if (isSwitchAnswer(sourceCode, node, new Set())) return true;
  for (const key of sourceCode.visitorKeys[node.type] ?? []) {
    // A property name is no reference to a variable.
    if ((node.type === 'MemberExpression' || node.type === 'Property') && !node.computed) {
      if (key === (node.type === 'MemberExpression' ? 'property' : 'key')) continue;
    }
    const children = [node[key]].flat();
    for (const child of children) {
      if (child && typeof child.type === 'string' && asksSwitch(sourceCode, child)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * One condition asks about one Feature Switch: a dependency between two lives in the
 * one table of the contracts (`DEPENDS_ON`), which the Edition applies (ADR 0089).
 * Both sides of a logical expression are checked, and a `const` they name is followed
 * to its initializer, so an answer first held in a variable still counts.
 * A helper function that asks for the caller is not followed.
 */
export const oneSwitchPerCondition = {
  meta: {
    type: 'problem',
    docs: { description: 'Ask about one Feature Switch in a condition (ADR 0089).' },
    schema: [],
    messages: {
      twoSwitches:
        'Ask about one Feature Switch in a condition; a dependency between two goes into DEPENDS_ON in the contracts.',
    },
  },
  create(context) {
    const { sourceCode } = context;
    return {
      LogicalExpression(node) {
        if (asksSwitch(sourceCode, node.left) && asksSwitch(sourceCode, node.right)) {
          context.report({ node, messageId: 'twoSwitches' });
        }
      },
    };
  },
};

/** The plugin that carries the rule, for a workspace part's ESLint config. */
export const switchLintPlugin = { rules: { 'one-switch-per-condition': oneSwitchPerCondition } };

/** The rule on for the Core's source files; tests may combine switches freely. */
export default [
  {
    files: ['**/*.ts'],
    ignores: ['**/*.test.ts'],
    plugins: { slovo: switchLintPlugin },
    rules: { 'slovo/one-switch-per-condition': 'error' },
  },
];
