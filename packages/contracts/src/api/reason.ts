import { z } from 'zod';

/** Every admin write names why: the Action log keeps it (ADR 0088, 0122). */
export const ReasonSchema = z.string().trim().min(1).max(500);
