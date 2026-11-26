import type { Knowledge } from '../knowledge/knowledge';

/**
 * The Knowledge Mark an answer writes, in a Game's Round and a Quick Question
 * alike: a right answer confirms the Entry (ADR 0066), a wrong one marks it Unknown.
 */
export const markAnswer = (
  knowledge: Pick<Knowledge, 'answer' | 'confirm'>,
  entryId: string,
  right: boolean,
): Promise<void> => (right ? knowledge.confirm(entryId) : knowledge.answer(entryId, 'unknown'));
