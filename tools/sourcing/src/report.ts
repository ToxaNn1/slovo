import type { DraftOutcome, Flag, ReviewReport } from './source-words';

/** The review report as Markdown: what was drafted, and what a human must decide. */
export function formatReviewReport(report: ReviewReport): string {
  const drafts = report.lemmas.flatMap((lemma) => lemma.drafts);
  const ready = drafts.filter((draft) => draft.ready).length;
  const lines = [
    '# Sourcing review',
    '',
    `- Lemmas: ${String(report.lemmas.length)}`,
    `- Drafts ready for review: ${String(ready)} (in \`drafts/\`)`,
    `- Drafts missing required data: ${String(drafts.length - ready)} (in \`incomplete/\`)`,
    `- Lemmas without a draft: ${String(report.lemmas.filter((lemma) => lemma.drafts.length === 0).length)}`,
    `- Requests: ${String(report.requests.network)} to the network, ${String(report.requests.cached)} from the cache`,
    '',
    'Every field comes from the sources named in the draft. Nothing below was resolved by the tool.',
  ];
  for (const lemma of report.lemmas) {
    lines.push('', `## ${lemma.lemma} (line ${String(lemma.line)})`, '');
    for (const flag of lemma.flags) lines.push(formatFlag(flag));
    if (lemma.flags.length > 0 && lemma.drafts.length > 0) lines.push('');
    for (const draft of lemma.drafts) lines.push(...formatDraft(draft));
  }
  return `${lines.join('\n')}\n`;
}

function formatDraft(draft: DraftOutcome): string[] {
  const status = draft.ready ? 'ready for review' : 'missing required data';
  return [
    `- \`${draft.file}\` from ${draft.headword}: ${status}`,
    ...draft.issues.map((issue) => `  - schema: ${issue}`),
    ...draft.flags.map((flag) => `  ${formatFlag(flag)}`),
  ];
}

function formatFlag({ kind, message }: Flag): string {
  return `- **${kind}**: ${message}`;
}
