import { ID_PREFIX, type EntryKind } from '@slovo/contracts';
import { type AdminApiOutputs, CONTENT_PAGE_SIZE } from '@slovo/contracts/admin-api';
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { adminApi } from '../../api';
import { cn } from '../../lib/utils';
import { Pager } from '../pager';
import { type CategoryOptions, CONTENT_KINDS, type FormValue, isList, type Option } from './kinds';

/** A record as the records procedure lists it. */
type ContentRecordSummary = AdminApiOutputs['content']['records']['records'][number];

/** The five kinds of Entry, in the order of their tabs. */
const ENTRY_KINDS: readonly EntryKind[] = ['word', 'correction', 'idiom', 'synonymRow', 'tip'];

const INPUT = 'rounded-lg border border-border bg-background px-3 py-2 text-sm';
const SMALL_BUTTON =
  'rounded-lg px-2 py-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40';

const kindName = (kind: EntryKind) =>
  CONTENT_KINDS.find((editor) => editor.kind === kind)?.name ?? kind;

/** The kind of Entry an id names by its prefix, if any. */
const kindOfId = (id: string) => ENTRY_KINDS.find((kind) => id.startsWith(ID_PREFIX[kind]));

/** The Categories a kind of Entry is filtered by: only Words and Corrections have them. */
const categoriesOf = (kind: EntryKind, categories: CategoryOptions): readonly Option[] =>
  kind === 'word'
    ? categories.categories
    : kind === 'correction'
      ? categories.correctionCategories
      : [];

/** Groups of at most a page of ids of one kind, so each is answered on one page. */
function chunksOf(ids: readonly string[]) {
  const chunks: { kind: EntryKind; ids: string[] }[] = [];
  for (const kind of ENTRY_KINDS) {
    const ofKind = ids.filter((id) => kindOfId(id) === kind).sort();
    for (let start = 0; start < ofKind.length; start += CONTENT_PAGE_SIZE) {
      chunks.push({ kind, ids: ofKind.slice(start, start + CONTENT_PAGE_SIZE) });
    }
  }
  return chunks;
}

/**
 * A Curated Collection's Entries: the records of each kind of Entry by a text
 * query and, for Words and Corrections, a Category, a tick per row and
 * «Додати всі показані»; then the chosen Entries in their order, each with
 * its kind, label and Category, to remove or move. The order shown is the
 * order saved.
 */
export function EntryPicker({
  id,
  editionId,
  value,
  categories,
  onChange,
}: {
  readonly id: string;
  readonly editionId: string;
  readonly value: FormValue;
  readonly categories: CategoryOptions;
  readonly onChange: (value: FormValue) => void;
}) {
  const chosen = isList(value) ? value.filter((each) => typeof each === 'string') : [];
  const [kind, setKind] = useState<EntryKind>('word');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const kindCategories = categoriesOf(kind, categories);

  const found = useQuery({
    queryKey: ['content', 'records', editionId, kind, query.trim(), categoryId, page],
    queryFn: () =>
      adminApi.content.records({
        editionId,
        kind,
        page,
        ...(query.trim() === '' ? {} : { query: query.trim() }),
        ...(categoryId === '' ? {} : { categoryId }),
      }),
    placeholderData: keepPreviousData,
  });
  const known = useQueries({
    queries: chunksOf(chosen).map((chunk) => ({
      queryKey: ['content', 'records', editionId, chunk.kind, 'ids', chunk.ids],
      queryFn: () =>
        adminApi.content.records({ editionId, kind: chunk.kind, ids: chunk.ids, retired: 'true' }),
    })),
  });
  const summaries = new Map<string, ContentRecordSummary>();
  for (const answer of [...known.map((each) => each.data), found.data]) {
    for (const record of answer?.records ?? []) summaries.set(record.id, record);
  }
  const resolved = known.every((each) => each.isSuccess);

  const listed = found.data?.records ?? [];
  const has = new Set(chosen);
  const toggle = (record: ContentRecordSummary) => {
    onChange(
      has.has(record.id) ? chosen.filter((each) => each !== record.id) : [...chosen, record.id],
    );
  };
  const moved = (from: number, to: number) => {
    const next = [...chosen];
    const [taken] = next.splice(from, 1);
    if (taken !== undefined) next.splice(to, 0, taken);
    onChange(next);
  };
  const categoryName = (record: ContentRecordSummary) => {
    if (record.categoryId === undefined) return undefined;
    const kindOf = kindOfId(record.id);
    const options = kindOf === undefined ? [] : categoriesOf(kindOf, categories);
    return options.find((option) => option.value === record.categoryId)?.label ?? record.categoryId;
  };
  const lineOf = (entryId: string) => {
    const record = summaries.get(entryId);
    const entryKind = kindOfId(entryId);
    if (record === undefined || entryKind === undefined) {
      return resolved ? `${entryId} · невідомий запис` : entryId;
    }
    return [
      kindName(entryKind),
      record.label,
      categoryName(record),
      record.retired ? 'виведено' : undefined,
    ]
      .filter((part) => part !== undefined)
      .join(' · ');
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-sunk p-3">
      <div
        role="tablist"
        aria-label="Види записів добірки"
        className="flex flex-wrap gap-0.5 self-start rounded-[11px] bg-background p-[3px]"
      >
        {ENTRY_KINDS.map((each) => (
          <button
            key={each}
            type="button"
            role="tab"
            aria-selected={each === kind}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[12.5px]',
              each === kind
                ? 'bg-surface font-semibold shadow-panel'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => {
              setKind(each);
              setCategoryId('');
              setPage(1);
            }}
          >
            {kindName(each)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          aria-label="Пошук записів"
          placeholder="Пошук записів"
          className={INPUT}
          value={query}
          onKeyDown={(event) => {
            // Enter searches as typed; it doesn't save the collection.
            if (event.key === 'Enter') event.preventDefault();
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
        {kindCategories.length > 0 && (
          <select
            aria-label="Категорія записів"
            className={INPUT}
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Усі категорії</option>
            {kindCategories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className={SMALL_BUTTON}
          disabled={listed.length === 0}
          onClick={() => {
            onChange([
              ...chosen,
              ...listed.map((record) => record.id).filter((each) => !has.has(each)),
            ]);
          }}
        >
          Додати всі показані
        </button>
      </div>
      <ul aria-label="Знайдені записи" className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {listed.map((record) => {
          const rowId = `${id}-found-${record.id}`;
          const category = categoryName(record);
          return (
            <li key={record.id} className="flex items-center gap-2">
              <input
                id={rowId}
                type="checkbox"
                checked={has.has(record.id)}
                onChange={() => {
                  toggle(record);
                }}
              />
              <label htmlFor={rowId}>{record.label}</label>
              {category !== undefined && <span className="text-muted-foreground">{category}</span>}
            </li>
          );
        })}
        {found.isSuccess && listed.length === 0 && (
          <li className="text-muted-foreground">Нічого не знайдено.</li>
        )}
      </ul>
      {found.data !== undefined && (
        <Pager
          label="Сторінки знайдених записів"
          page={page}
          pageSize={CONTENT_PAGE_SIZE}
          total={found.data.total}
          onPage={setPage}
        />
      )}
      <span className="font-medium">Обрано: {chosen.length}</span>
      <ol aria-label="Обрані записи" className="flex flex-col gap-1">
        {chosen.map((entryId, index) => {
          const label = summaries.get(entryId)?.label ?? entryId;
          return (
            <li key={entryId} className="flex items-center gap-1">
              <span data-entry className="flex-1">
                {lineOf(entryId)}
              </span>
              <button
                type="button"
                aria-label={`Вище: ${label}`}
                className={SMALL_BUTTON}
                disabled={index === 0}
                onClick={() => {
                  moved(index, index - 1);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Нижче: ${label}`}
                className={SMALL_BUTTON}
                disabled={index === chosen.length - 1}
                onClick={() => {
                  moved(index, index + 1);
                }}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Прибрати: ${label}`}
                className={SMALL_BUTTON}
                onClick={() => {
                  onChange(chosen.filter((each) => each !== entryId));
                }}
              >
                ×
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
