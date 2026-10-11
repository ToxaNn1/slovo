/**
 * The Core's public interface. Every Edition reaches Core behaviour through
 * this module only (ADR 0006).
 */
export type { Word } from '@slovo/contracts';
export { createContent, type Content } from './content';
export { InvalidEditionConfigError, loadEdition, type Edition } from './edition';
export { systemClock, systemRandom, type Clock, type ContentReadPort, type Random } from './ports';
