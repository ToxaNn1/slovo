import { cn } from '../../lib/utils';

/** A page number, or a gap of pages left out. */
type Step =
  { readonly at: 'page'; readonly page: number } | { readonly at: 'gap'; readonly after: number };

/** The first, the last and the pages around the current one, with gaps between them. */
function stepsOf(page: number, pages: number): Step[] {
  const shown = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((each) => each >= 1 && each <= pages)
    .toSorted((a, b) => a - b);
  return shown.flatMap((each, index): Step[] => {
    const before = shown[index - 1];
    const step: Step = { at: 'page', page: each };
    return before !== undefined && each - before > 1
      ? [{ at: 'gap', after: before }, step]
      : [step];
  });
}

const stepClass = 'h-8 min-w-8 rounded-lg px-2.5 text-[12.5px]';

/** The pages of a list: which records are shown of how many, and the way to the others. */
export function Pager({
  label,
  page,
  pageSize,
  total,
  onPage,
}: {
  readonly label: string;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-subtle">{`${String(first)}–${String(last)} з ${String(total)}`}</p>
      <div className="flex flex-wrap items-center gap-0.5 rounded-[11px] bg-sunk p-[3px]">
        <button
          type="button"
          className={cn(
            stepClass,
            'text-muted-foreground enabled:hover:text-foreground disabled:opacity-40',
          )}
          disabled={page <= 1}
          onClick={() => {
            onPage(page - 1);
          }}
        >
          Назад
        </button>
        {stepsOf(page, pages).map((step) =>
          step.at === 'gap' ? (
            <span key={`gap-${String(step.after)}`} className="px-1 text-xs text-subtle">
              …
            </span>
          ) : (
            <button
              key={step.page}
              type="button"
              aria-current={step.page === page ? 'page' : undefined}
              className={cn(
                stepClass,
                step.page === page
                  ? 'bg-surface font-semibold shadow-panel'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => {
                onPage(step.page);
              }}
            >
              {step.page}
            </button>
          ),
        )}
        <button
          type="button"
          className={cn(
            stepClass,
            'text-muted-foreground enabled:hover:text-foreground disabled:opacity-40',
          )}
          disabled={page >= pages}
          onClick={() => {
            onPage(page + 1);
          }}
        >
          Далі
        </button>
      </div>
    </nav>
  );
}
