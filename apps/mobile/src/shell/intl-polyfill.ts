/**
 * Hermes has no `Intl.PluralRules`, which the UI needs to pick the plural
 * form of a count («1 запис», «2 записи», «17 записів»). This pure-JavaScript
 * polyfill adds it when the engine lacks it, with the CLDR rules of the
 * bundled Editions' languages only (Metro writes `slovo-editions/plural-rules`, see
 * metro.config.cjs; ADR 0020). Import it before anything else.
 */
import '@formatjs/intl-pluralrules/polyfill.js';
import 'slovo-editions/plural-rules';
