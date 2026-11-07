/**
 * Hermes v1 of React Native 0.88 fails to parse an async arrow function whose
 * rest parameter is a pattern, `async (...[a, b = {}]) => …`, with
 * "invalid destructuring target" (facebook/hermes#1761). `@orpc/client`
 * ships one, so the app crashes when it builds the API client.
 * `babel-preset-expo` 57 rewrote these; 58 dropped the rewrite while the
 * Hermes it runs on still has the bug. This plugin takes the pattern into the
 * body: `async (...rest) => { var [a, b = {}] = rest; … }`.
 * Remove it once Hermes parses the original.
 */
module.exports = function hermesAsyncArrowRest({ types: t }) {
  return {
    name: 'hermes-async-arrow-rest',
    visitor: {
      ArrowFunctionExpression(path) {
        const { node } = path;
        const rest = node.params.at(-1);
        if (!node.async || !t.isRestElement(rest) || t.isIdentifier(rest.argument)) return;
        const args = path.scope.generateUidIdentifier('rest');
        const body = t.isBlockStatement(node.body)
          ? node.body
          : t.blockStatement([t.returnStatement(node.body)]);
        body.body.unshift(
          t.variableDeclaration('var', [t.variableDeclarator(rest.argument, t.cloneNode(args))]),
        );
        rest.argument = args;
        node.body = body;
      },
    },
  };
};
