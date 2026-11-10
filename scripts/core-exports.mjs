// Spec decision H, ADR 0018: the Core's main entry exports only the names that
// code outside the Core imports, so the shell cannot go around the
// composition. Run by `pnpm deps` and in CI next to the dependency-cruiser
// rules; the cruiser sees modules, not names, so this check reads the names.
//
// It lists every name `packages/core/src/index.ts` exports and every name a
// non-test module outside the Core imports from `@slovo/core` (named imports,
// re-exports and `Core.Name` through a namespace import), and fails on an
// export nothing imports. A name only tests need belongs in
// `@slovo/core/testing`.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const ROOT = new URL('..', import.meta.url).pathname;
const ENTRY = 'packages/core/src/index.ts';
const PARTS = ['apps', 'packages', 'tools', 'editions'];
const SKIPPED_FOLDERS = new Set(['node_modules', 'dist', '.expo', '.astro', '.turbo', 'coverage']);
const SOURCE = /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/;
const TEST =
  /(\.test\.[cm]?[jt]sx?$)|((^|\/)test-support\.[cm]?[jt]sx?$)|((^|\/)jest\.[^/]+\.c?js$)/;

function sourceFiles(folder) {
  return readdirSync(join(ROOT, folder), { withFileTypes: true }).flatMap((dirent) => {
    const path = join(folder, dirent.name);
    if (dirent.isDirectory()) return SKIPPED_FOLDERS.has(dirent.name) ? [] : sourceFiles(path);
    return SOURCE.test(dirent.name) && !dirent.name.endsWith('.d.ts') ? [path] : [];
  });
}

function parse(path) {
  return ts.createSourceFile(path, readFileSync(join(ROOT, path), 'utf8'), ts.ScriptTarget.Latest);
}

/** The names a module exports through `export { … }` and `export type { … }`. */
function exportedNames(file) {
  const names = [];
  for (const statement of file.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    const clause = statement.exportClause;
    if (clause === undefined || !ts.isNamedExports(clause)) {
      throw new Error(`${ENTRY}: name every export; \`export *\` hides what the Core exports`);
    }
    for (const element of clause.elements) names.push(element.name.text);
  }
  return names;
}

const isCoreEntry = (node) => ts.isStringLiteral(node) && node.text === '@slovo/core';

/** The names one module imports or re-exports from `@slovo/core`. */
function importedNames(file) {
  const names = new Set();
  const namespaces = new Set();
  for (const statement of file.statements) {
    const from = statement.moduleSpecifier;
    if (from === undefined || !isCoreEntry(from)) continue;
    if (ts.isImportDeclaration(statement)) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings === undefined) continue;
      if (ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
      else for (const e of bindings.elements) names.add((e.propertyName ?? e.name).text);
    } else if (ts.isExportDeclaration(statement) && statement.exportClause !== undefined) {
      const clause = statement.exportClause;
      if (ts.isNamedExports(clause)) {
        for (const e of clause.elements) names.add((e.propertyName ?? e.name).text);
      }
    }
  }
  if (namespaces.size > 0) {
    const visit = (node) => {
      const left = ts.isQualifiedName(node)
        ? node.left
        : ts.isPropertyAccessExpression(node)
          ? node.expression
          : undefined;
      if (left !== undefined && ts.isIdentifier(left) && namespaces.has(left.text)) {
        names.add((ts.isQualifiedName(node) ? node.right : node.name).text);
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return names;
}

const imported = new Set();
for (const path of PARTS.flatMap(sourceFiles)) {
  if (path.startsWith('packages/core/') || TEST.test(path)) continue;
  for (const name of importedNames(parse(path))) imported.add(name);
}

const unused = exportedNames(parse(ENTRY)).filter((name) => !imported.has(name));
if (unused.length > 0) {
  console.error(
    `${relative(ROOT, join(ROOT, ENTRY))} exports ${unused.length} name(s) that no non-test ` +
      'module outside the Core imports. Take the export off, or move a test helper to ' +
      `@slovo/core/testing (spec decision H, ADR 0018):\n  ${unused.join('\n  ')}`,
  );
  process.exit(1);
}
