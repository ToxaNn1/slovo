import { inEffectWithoutRules, type Edition } from '@slovo/core';

import { edition } from './edition';

/**
 * The Edition in effect until the remote Rules the device kept are read, and
 * when they can't be: each Feature Switch as the build shipped it (ADR 0203).
 * The one place that hands the shipped answer as the answer in effect; the
 * Shell replaces it with the Edition of the remote Feature Switches once
 * they open.
 */
export const editionAtLaunch: Edition = inEffectWithoutRules(edition);
