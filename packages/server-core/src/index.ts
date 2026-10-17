/**
 * The server Core's public interface. The backend reaches the server's rules
 * through this module only (ADR 0030).
 */
export { systemClock, type Clock } from './ports';
