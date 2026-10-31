# Counts take CLDR plural forms, with a polyfill for Hermes

From 0.3 the app shows counts of Entries: «1 запис», «2 записи», «17 записів». Languages differ in how many plural forms they have and which numbers take which, so the Core can't hold the rule. An Edition gives every count string in each CLDR plural category its language has (`zero`, `one`, `two`, `few`, `many`, `other`; `other` is required), with a `{count}` placeholder, and the UI picks the form with `Intl.PluralRules` for the Edition's locale.

Hermes, the app's JavaScript engine, has no `Intl.PluralRules` (checked on the 0.3 development build). The shell adds `@formatjs/intl-pluralrules`, a pure-JavaScript polyfill, before anything else runs. It installs itself only where the engine lacks the API, so Node and the tests use their own. It loads the plural rules of the bundled Editions' languages only: Metro writes `slovo-editions/plural-rules` from the polyfill's data for each bundled Edition's locale, or for the locale's language, and fails the bundle when the polyfill has neither. A new Edition needs no change, as long as the polyfill knows its language.

## Considered Options

- **Plural rules written by the Edition**, such as a function or a table of number ranges in its config: rejected. CLDR already defines them for every language, and hand-written rules for Ukrainian or Arabic are easy to get wrong.
- **The polyfill with the data of every language**: rejected. It would ship hundreds of languages' rules in an app that speaks one.
- **A native module**: rejected. The polyfill needs no native build (ADR 0004), and plural rules are small enough for JavaScript.
