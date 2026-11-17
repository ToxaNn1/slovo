import type { AlertThresholdKey } from '@slovo/contracts/admin-api';
import { z } from 'zod';

import {
  CONTENT_KINDS,
  formValueOf,
  shownOf,
  type EditorField,
} from './components/content-editor/kinds';
import { SWITCH_TEXTS } from './switches/switch-texts';

/**
 * The Action log as the Власник reads it: each row's `what` as a Ukrainian
 * sentence and its Було / Стало as plain text, never raw JSON. The rows are
 * outside data, kept for years, so every value is parsed here, and a key or a
 * shape this table doesn't know yet still reads (ADR 0088).
 */

type Role = 'owner' | 'admin';

export const ROLE_LABELS: Readonly<Record<Role, string>> = { owner: 'Власник', admin: 'Адмін' };

/** What each alert threshold measures, as the Власник reads it. */
export const THRESHOLD_LABELS: Readonly<Record<AlertThresholdKey, string>> = {
  crashFree: 'Сесії без падінь, %',
  issueEvents: 'Подій нової помилки за годину',
  apiErrors: 'Помилки API 5xx за годину, %',
  batchRecords: 'Записів у пакеті',
  activityDrop: 'Падіння активності, %',
};

/** A content kind in a sentence: its name as the object of a verb, and its gender for the adjective. */
const KIND_WORDS: Readonly<Record<string, { readonly name: string; readonly feminine: boolean }>> =
  {
    word: { name: 'Слово', feminine: false },
    correction: { name: 'Виправлення', feminine: false },
    idiom: { name: 'Ідіому', feminine: true },
    synonymRow: { name: 'Синонімічний ряд', feminine: false },
    tip: { name: 'Пораду', feminine: true },
    curatedCollection: { name: 'Добірку', feminine: true },
    crosswordDay: { name: 'Кросворд дня', feminine: false },
  };

const CONTENT_OPS: Readonly<Record<string, (feminine: boolean) => string>> = {
  create: () => 'додано',
  edit: () => 'змінено',
  retire: () => 'виведено',
  check: (feminine) => `позначено перевірен${feminine ? 'ою' : 'им'}`,
  flag: () => 'позначено для Черги контенту',
};

const WHATS: Readonly<Record<string, string>> = {
  'content.batch.review': 'Пачку переглянуто',
  'content.batch.rollback': 'Пачку відкочено',
  'content.flag.accept': 'Позначку прийнято',
  'content.flag.reject': 'Позначку відхилено',
  'report.resolve': 'Повідомлення про помилку вирішено',
  'account.delete': 'Обліковий запис читача видалено',
  'admin.owner.add': 'Додано Власника',
  'admin.user.invite': 'Запрошено людину в адмінку',
  'admin.user.role': 'Змінено роль',
  'admin.user.remove': 'Прибрано доступ до адмінки',
  'admin.agent.add': 'Видано токен Агента',
  'admin.agent.revoke': 'Відкликано токен Агента',
  'owner-check.add': 'Додано перевірку власника',
  'owner-check.import': 'Перевірку власника перенесено з файлу',
  'owner-check.tick': 'Перевірку власника відмічено',
  'alert-threshold.set': 'Змінено поріг сповіщення',
  'switches.rules.set': 'Змінено правила перемикача',
  'switches.minimum.set': 'Змінено мінімальну версію застосунку',
  'switches.kill': 'Функцію вимкнено для всіх (аварійно)',
};

/** The content kind and operation of a `content.<kind>.<op>` key. */
function contentKeyOf(what: string): { kind: string; op: string } | undefined {
  const [area, kind, op, ...rest] = what.split('.');
  if (area !== 'content' || kind === undefined || op === undefined || rest.length > 0) {
    return undefined;
  }
  return KIND_WORDS[kind] === undefined ? undefined : { kind, op };
}

/** A row's `what` as a sentence; a key it doesn't know reads as «Інша дія: …». */
export function whatOf(what: string): string {
  const known = WHATS[what];
  if (known !== undefined) return known;
  const content = contentKeyOf(what);
  const words = content === undefined ? undefined : KIND_WORDS[content.kind];
  const op = content === undefined ? undefined : CONTENT_OPS[content.op];
  if (words !== undefined && op !== undefined) return `${words.name} ${op(words.feminine)}`;
  return `Інша дія: ${what}`;
}

// The shapes the backend writes; loose, so a field added later never hides a row.
const RecordSnapshot = z.object({
  recordVersion: z.number(),
  fields: z.record(z.string(), z.unknown()),
});
const RecordRef = z.object({ id: z.string(), recordVersion: z.number().optional() });
const Person = z.object({ email: z.string(), role: z.enum(['owner', 'admin']).optional() });
const Agent = z.object({ name: z.string(), revoked: z.boolean().optional() });
const Threshold = z.object({ key: z.string(), value: z.number().optional() });
const Minimum = z.object({
  platform: z.string(),
  minimum: z.object({ soft: z.string().optional(), hard: z.string().optional() }).optional(),
});
const Rules = z.array(
  z.object({
    feature: z.string(),
    verdict: z.union([z.enum(['on', 'off']), z.object({ variants: z.array(z.string()) })]),
    targets: z.record(z.string(), z.unknown()).optional(),
  }),
);
type Rule = z.infer<typeof Rules>[number];
const Rollback = z.object({
  retired: z.array(z.string()),
  restored: z.array(z.string()),
  skipped: z.array(z.string()),
});
const FlagRef = z.object({ flagId: z.union([z.number(), z.string()]) });
const Report = z.object({ entryId: z.string(), type: z.string(), comment: z.string().optional() });
const Account = z.object({ email: z.string(), createdAt: z.string() });
const OwnerCheck = z.object({ text: z.string() });
const Tick = z.object({ ticked: z.boolean() });

const MISTAKE_TYPES: Readonly<Record<string, string>> = {
  typo: 'одрук',
  stress: 'наголос',
  definition: 'визначення',
  other: 'інше',
};

const PLATFORMS: Readonly<Record<string, string>> = { ios: 'iOS', android: 'Android' };

const MAX_TEXT = 140;

const short = (text: string) => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text);

const day = (iso: string) => new Date(iso).toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv' });

const number = (value: number) => value.toLocaleString('uk-UA', { maximumFractionDigits: 2 });

const RULES = new Intl.PluralRules('uk-UA');
const ruleCount = (count: number) => {
  const form = RULES.select(count);
  const word = form === 'one' ? 'правило' : form === 'few' ? 'правила' : 'правил';
  return `${String(count)} ${word}`;
};

/** Any value as plain text: texts as they are, lists and objects flattened. */
function plain(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return typeof value === 'number' ? number(value) : value ? 'так' : 'ні';
  }
  if (Array.isArray(value)) return value.map(plain).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${plain(item)}`)
      .join(', ');
  }
  return '—';
}

const switchName = (feature: string) =>
  Object.entries(SWITCH_TEXTS).find(([name]) => name === feature)?.[1].name ?? feature;

const verdictOf = ({ verdict }: Rule) =>
  verdict === 'on'
    ? 'увімкнено'
    : verdict === 'off'
      ? 'вимкнено'
      : `варіанти ${verdict.variants.join(', ')}`;

/** One Rule: what it sets, for everyone or only for the readers it targets. */
const ruleText = (rule: Rule) =>
  `${verdictOf(rule)} ${Object.keys(rule.targets ?? {}).length === 0 ? 'для всіх' : 'для частини читачів'}`;

/** The Rules of one feature: none, one, or their count and what each sets, in order. */
function rulesText(rules: readonly Rule[], feature: string | undefined): string {
  const name = switchName(rules[0]?.feature ?? feature ?? '');
  const prefix = name === '' ? '' : `${name}: `;
  const [only] = rules;
  if (only === undefined) return `${prefix}правил немає`;
  if (rules.length === 1) return `${prefix}${ruleText(only)}`;
  return `${prefix}${ruleCount(rules.length)} — ${rules.map(ruleText).join('; ')}`;
}

/** The editor fields of a content kind, which name a record's fields in Ukrainian. */
const fieldsOf = (kind: string): readonly EditorField[] =>
  CONTENT_KINDS.find((editor) => editor.kind === kind)?.fields ?? [];

/** A record field's value as one line, as the editor shows it. */
function fieldText(field: EditorField | undefined, value: unknown): string {
  if (field === undefined) return plain(value);
  const text = shownOf(field.control, formValueOf(field.control, value));
  return text === '' ? '—' : text;
}

/** The field that names a record: a Word's Lemma, an Idiom's expression and so on. */
export function titleOf(
  kind: string,
  fields: Readonly<Record<string, unknown>>,
): string | undefined {
  const [first] = fieldsOf(kind);
  if (first === undefined) return undefined;
  const text = fieldText(first, fields[first.name]);
  return text === '—' ? undefined : short(text);
}

/** A record before or after a write: its version and what names it, or the fields an edit changed. */
function snapshotText(
  kind: string,
  snapshot: z.infer<typeof RecordSnapshot>,
  other: z.infer<typeof RecordSnapshot> | undefined,
): string {
  const version = `версія ${String(snapshot.recordVersion)}`;
  if (other === undefined) {
    const title = titleOf(kind, snapshot.fields);
    return title === undefined ? version : `${version} · «${title}»`;
  }
  const fields = fieldsOf(kind);
  const names = [...new Set([...Object.keys(other.fields), ...Object.keys(snapshot.fields)])];
  const order = (name: string) => {
    const index = fields.findIndex((each) => each.name === name);
    return index === -1 ? fields.length : index;
  };
  const changes = names
    .toSorted((one, two) => order(one) - order(two))
    .filter((name) => JSON.stringify(other.fields[name]) !== JSON.stringify(snapshot.fields[name]))
    .map((name) => {
      const field = fields.find((each) => each.name === name);
      const was = short(fieldText(field, other.fields[name]));
      const now = short(fieldText(field, snapshot.fields[name]));
      return `${field?.label ?? name}: ${was} → ${now}`;
    });
  return changes.length === 0 ? version : `${version} · ${changes.join(' · ')}`;
}

/** A record named by its id: a Crossword day by its date, any other by its id. */
function refText(kind: string, ref: z.infer<typeof RecordRef>): string {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ref.id);
  const named =
    kind === 'crosswordDay' && date !== null
      ? `Кросворд на ${date[3] ?? ''}.${date[2] ?? ''}.${date[1] ?? ''}`
      : `Запис ${ref.id}`;
  return ref.recordVersion === undefined ? named : `${named} · версія ${String(ref.recordVersion)}`;
}

/** A side of a content write; an edit's Стало lists the fields it changed from its Було. */
function contentSide(what: string, value: unknown, before: unknown): string | undefined {
  const content = contentKeyOf(what);
  if (content === undefined) return undefined;
  const snapshot = RecordSnapshot.safeParse(value);
  if (snapshot.success) {
    const was = RecordSnapshot.safeParse(before);
    const compared = content.op === 'edit' && was.success ? was.data : undefined;
    return snapshotText(content.kind, snapshot.data, compared);
  }
  const ref = RecordRef.safeParse(value);
  return ref.success ? refText(content.kind, ref.data) : undefined;
}

/** One side of a row of any other key, parsed by the shape its key writes. */
function otherSide(what: string, value: unknown, other: unknown): string | undefined {
  switch (what) {
    case 'admin.owner.add':
    case 'admin.user.invite':
    case 'admin.user.role':
    case 'admin.user.remove': {
      const person = Person.safeParse(value);
      if (!person.success) return undefined;
      const { email, role } = person.data;
      return role === undefined ? email : `${email} · ${ROLE_LABELS[role]}`;
    }
    case 'admin.agent.add':
    case 'admin.agent.revoke': {
      const agent = Agent.safeParse(value);
      if (!agent.success) return undefined;
      return `Агент ${agent.data.name}${agent.data.revoked === true ? ' · відкликано' : ''}`;
    }
    case 'alert-threshold.set': {
      const threshold = Threshold.safeParse(value);
      if (!threshold.success) return undefined;
      const { key, value: set } = threshold.data;
      const label = Object.entries(THRESHOLD_LABELS).find(([name]) => name === key)?.[1] ?? key;
      return `${label}: ${set === undefined ? 'за замовчуванням' : number(set)}`;
    }
    case 'switches.minimum.set': {
      const minimum = Minimum.safeParse(value);
      if (!minimum.success) return undefined;
      const { platform, minimum: set } = minimum.data;
      const limits = [
        set?.soft === undefined ? undefined : `просити оновити нижче ${set.soft}`,
        set?.hard === undefined ? undefined : `не пускати нижче ${set.hard}`,
      ].filter((limit) => limit !== undefined);
      return `${PLATFORMS[platform] ?? platform}: ${limits.length === 0 ? 'не задано' : limits.join(', ')}`;
    }
    case 'switches.rules.set':
    case 'switches.kill': {
      const rules = Rules.safeParse(value);
      if (!rules.success) return undefined;
      const sibling = Rules.safeParse(other);
      return rulesText(rules.data, sibling.success ? sibling.data[0]?.feature : undefined);
    }
    case 'content.batch.rollback': {
      const rollback = Rollback.safeParse(value);
      if (rollback.success) {
        const { retired, restored, skipped } = rollback.data;
        return `виведено: ${String(retired.length)} · повернуто: ${String(restored.length)} · пропущено: ${String(skipped.length)}`;
      }
      // The batch rolled back: its id says nothing to the Власник.
      return z.object({ batchId: z.string() }).safeParse(value).success ? '—' : undefined;
    }
    case 'content.flag.accept':
    case 'content.flag.reject': {
      const flag = FlagRef.safeParse(value);
      return flag.success ? `позначка №${String(flag.data.flagId)}` : undefined;
    }
    case 'report.resolve': {
      const report = Report.safeParse(value);
      if (!report.success) return undefined;
      const { entryId, type, comment } = report.data;
      const kind = MISTAKE_TYPES[type] ?? type;
      return `Запис ${entryId} · ${kind}${comment === undefined || comment === '' ? '' : ` · «${short(comment)}»`}`;
    }
    case 'account.delete': {
      const account = Account.safeParse(value);
      return account.success
        ? `${account.data.email}, створено ${day(account.data.createdAt)}`
        : undefined;
    }
    case 'owner-check.add':
    case 'owner-check.import':
    case 'owner-check.tick': {
      const check = OwnerCheck.safeParse(value);
      if (check.success) return `«${short(check.data.text)}»`;
      const tick = Tick.safeParse(value);
      return tick.success ? (tick.data.ticked ? 'відмічено' : 'не відмічено') : undefined;
    }
    default:
      return undefined;
  }
}

/** One side of a row as plain text; «—» when there is nothing. */
function sideOf(what: string, value: unknown, other: unknown, before?: unknown): string {
  if (value === null || value === undefined) return '—';
  return contentSide(what, value, before) ?? otherSide(what, value, other) ?? short(plain(value));
}

/** A row's Було and Стало as plain text. */
export function changeOf(what: string, before: unknown, after: unknown) {
  return { before: sideOf(what, before, after), after: sideOf(what, after, before, before) };
}
