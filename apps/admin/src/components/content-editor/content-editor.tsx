import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { adminApi } from '../../api';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { CONTENT_KINDS, type KindEditor } from './kinds';
import { RecordForm, type Written } from './record-form';

/** The record the editor has open: none, a new one, or one by its id. */
type Open =
  | { readonly at: 'none' }
  | { readonly at: 'create' }
  | { readonly at: 'edit'; readonly id: string };

const NONE: Open = { at: 'none' };

/**
 * The content editor of one Edition: its card read-only, then per kind the
 * records by a text query, and the open record's fields. Every save publishes
 * a new content version (ADR 0090).
 */
export function ContentEditor({ editionId }: { readonly editionId: string }) {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<KindEditor>(CONTENT_KINDS[0] ?? never());
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Open>(NONE);
  const [written, setWritten] = useState<Written>();
  const kind = editor.kind;

  const card = useQuery({
    queryKey: ['edition-card', editionId],
    queryFn: () => adminApi.editionCard({ editionId }),
  });
  const records = useQuery({
    queryKey: ['content', 'records', editionId, kind, query],
    queryFn: () =>
      adminApi.content.records({ editionId, kind, ...(query === '' ? {} : { query }) }),
  });
  const openId = open.at === 'edit' ? open.id : undefined;
  const record = useQuery({
    queryKey: ['content', 'record', editionId, kind, openId],
    queryFn: () => adminApi.content.record({ editionId, kind, id: openId ?? '' }),
    enabled: openId !== undefined,
  });

  const choose = (next: Open) => {
    setOpen(next);
    setWritten(undefined);
  };
  const onWritten = (next: Written) => {
    setWritten(next);
    void queryClient.invalidateQueries({ queryKey: ['content'] });
    if (open.at === 'create') setOpen({ at: 'edit', id: next.id });
  };

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Картка Edition"
        className="flex flex-col gap-2 rounded-2xl bg-surface px-[18px] py-4 shadow-panel"
      >
        {card.data !== undefined && (
          <>
            <h2 className="font-display text-lg font-semibold">{card.data.displayName}</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Edition</dt>
              <dd>{card.data.id}</dd>
              <dt className="text-muted-foreground">Мова</dt>
              <dd>{card.data.locale}</dd>
              <dt className="text-muted-foreground">Категорії</dt>
              <dd>{card.data.categories.map((category) => category.displayName).join(', ')}</dd>
              <dt className="text-muted-foreground">Рівні</dt>
              <dd>{card.data.levels.names.join(', ')}</dd>
            </dl>
          </>
        )}
      </section>

      <div
        role="tablist"
        aria-label="Види записів"
        className="flex flex-wrap gap-0.5 self-start rounded-[11px] bg-sunk p-[3px]"
      >
        {CONTENT_KINDS.map((each) => (
          <button
            key={each.kind}
            type="button"
            role="tab"
            aria-selected={each.kind === kind}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[12.5px]',
              each.kind === kind
                ? 'bg-surface font-semibold shadow-panel'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => {
              setEditor(each);
              choose(NONE);
            }}
          >
            {each.name}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        <div className="flex flex-col gap-3">
          <form
            role="search"
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(search.trim());
            }}
          >
            <input
              aria-label="Пошук"
              placeholder="Пошук"
              className="h-9 min-w-0 flex-1 rounded-[10px] bg-surface px-[13px] text-[13px] shadow-panel"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
            <Button type="submit" variant="secondary">
              Шукати
            </Button>
          </form>
          <Button
            onClick={() => {
              choose({ at: 'create' });
            }}
          >
            Додати
          </Button>
          <ul className="flex flex-col gap-1">
            {records.data?.records.map((each) => (
              <li key={each.id}>
                <button
                  type="button"
                  className={cn(
                    'w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-muted',
                    each.retired && 'text-muted-foreground line-through',
                  )}
                  onClick={() => {
                    choose({ at: 'edit', id: each.id });
                  }}
                >
                  {each.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          {written !== undefined && (
            <p role="status" className="text-sm">
              {`Опубліковано, версія контенту ${String(written.contentVersion)}`}
            </p>
          )}
          {(written?.needsNewRecording ?? record.data?.needsNewRecording) === true && (
            <p className="text-sm text-destructive">потребує нового запису</p>
          )}
          {record.data?.retired === true && (
            <p className="text-sm text-muted-foreground">Виведено з ужитку</p>
          )}
          {open.at === 'create' && (
            <RecordForm
              key={`${kind}:new`}
              editionId={editionId}
              editor={editor}
              fields={{}}
              record={open}
              onWritten={onWritten}
            />
          )}
          {open.at === 'edit' && record.data !== undefined && (
            <RecordForm
              key={`${kind}:${open.id}`}
              editionId={editionId}
              editor={editor}
              fields={record.data.fields}
              record={{ at: 'edit', id: open.id, recordVersion: record.data.recordVersion }}
              onWritten={onWritten}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function never(): never {
  throw new Error('The content editor has no kinds');
}
