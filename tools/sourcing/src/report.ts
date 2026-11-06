import type { DraftOutcome, Flag, ReviewReport } from './review-report';

/** How much of a ready draft's Definition the «Ready drafts» list shows. */
const DEFINITION_START = 55;

/**
 * The review report as Markdown: what was drafted, and what a human must
 * decide. It ends with the «Ready drafts» list, one line per ready draft, so a
 * human picks without opening files.
 */
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
    `- Requests: ${String(report.requests.network)} to the network, ${String(report.requests.cached)} from the cache, ${String(report.requests.backoffs)} back-off(s)`,
    ...Object.entries(report.requests.unreachable).map(
      ([host, reason]) => `- Skipped for this run: ${host} (${reason})`,
    ),
    '',
    'Every field comes from the sources named in the draft. Nothing below was resolved by the tool.',
  ];
  for (const lemma of report.lemmas) {
    lines.push('', `## ${lemma.lemma} (line ${String(lemma.line)})`, '');
    for (const flag of lemma.flags) lines.push(formatFlag(flag));
    if (lemma.flags.length > 0 && lemma.drafts.length > 0) lines.push('');
    for (const draft of lemma.drafts) lines.push(...formatDraft(draft));
  }
  lines.push('', '## Ready drafts', '');
  for (const { id, summary } of drafts.filter((draft) => draft.ready)) {
    lines.push(
      `- \`${id}\` | ${summary.text} | ${summary.group} | Examples: ${String(summary.examples)} | ${summary.definition.slice(0, DEFINITION_START)}`,
    );
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
