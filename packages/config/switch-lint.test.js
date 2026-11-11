import { describe, it } from 'node:test';

import { RuleTester } from 'eslint';

import { oneSwitchPerCondition } from './switch-lint.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester();
const error = { messageId: 'twoSwitches' };

ruleTester.run('one-switch-per-condition', oneSwitchPerCondition, {
  valid: [
    "if (edition.isFeatureEnabled('spotlight')) show();",
    "if (edition.isFeatureEnabled('rarityTest') && offer === true) show();",
    "const on = edition.isFeatureEnabled('rarityTest'); const ready = offer === true; if (on && ready) show();",
    "let on = edition.isFeatureEnabled('a'); on = true; if (on && edition.isFeatureEnabled('b')) show();",
    "const a = edition.isFeatureEnabled('a'); if (other.a && edition.isFeatureEnabled('b')) show();",
    // A value built from a switch answer is no answer itself.
    "const steps = edition.isFeatureEnabled('a') ? ['a'] : []; if (steps.length > 0 && edition.isFeatureEnabled('b')) show();",
  ],
  invalid: [
    {
      code: "if (edition.isFeatureEnabled('a') && edition.isFeatureEnabled('b')) show();",
      errors: [error],
    },
    {
      code: "if (!edition.isFeatureEnabled('a') || edition.isFeatureEnabled('b')) show();",
      errors: [error],
    },
    {
      code: "const a = edition.isFeatureEnabled('a'); if (a && edition.isFeatureEnabled('b')) show();",
      errors: [error],
    },
    {
      code: "const a = edition.isFeatureEnabled('a'); const b = !edition.isFeatureEnabled('b'); if (a && b) show();",
      errors: [error],
    },
    {
      code: "const a = edition.isFeatureEnabled('a'); const both = a; const b = edition.isFeatureEnabled('b'); const ok = both || b;",
      errors: [error],
    },
  ],
});
