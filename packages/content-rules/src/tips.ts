import type { EditionConfig, Tip } from '@slovo/contracts';

import type { Authored, Refusal } from './refusal';

/**
 * The check the schema can't make on a Tip alone, on the Tips whose file
 * `checksFile` takes: the answers of its Game
 * question differ, in lower case of the Edition's locale. The schema already
 * holds a Tip's shape: an explanation of at most 300 characters, a Game
 * question with one right and three wrong answers, at least one source.
 */
export function checkTips(
  config: EditionConfig,
  tips: readonly Authored<Tip>[],
  checksFile: (file: string) => boolean = () => true,
): Refusal[] {
  const errors: Refusal[] = [];

  for (const { file, entry: tip } of tips) {
    if (!checksFile(file)) continue;
    const { rightAnswer, wrongAnswers } = tip.gameQuestion;
    const answers = [
      { field: 'rightAnswer', text: rightAnswer },
      ...wrongAnswers.map((text, place) => ({ field: `wrongAnswers.${String(place)}`, text })),
    ];
    const fieldByText = new Map<string, string>();
    for (const { field, text } of answers) {
      const key = text.toLocaleLowerCase(config.locale);
      const first = fieldByText.get(key);
      if (first === undefined) {
        fieldByText.set(key, field);
      } else {
        errors.push({
          rule: 'unique-tip-answers',
          file,
          entryId: tip.id,
          field: `gameQuestion.${field}`,
          message: `Same answer as ${first}: a Game question gives four different answers`,
        });
      }
    }
  }
  return errors;
}
