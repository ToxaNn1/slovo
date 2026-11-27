import {
  ACTION_SHAPES,
  ContentActionSideSchema,
  contentActionOf,
  isNamedActionKey,
  type ActionSide,
  type ContentActionOp,
  type ContentRecordKind,
  type NamedActionKey,
} from '@slovo/contracts';
import { ServiceEntryTypeSchema, type AlertThresholdKey } from '@slovo/contracts/admin-api';
import type { z } from 'zod';

import {
  CONTENT_KINDS,
  formValueOf,
  shownOf,
  type EditorField,
} from './components/content-editor/kinds';
import { usd } from './components/services/service-currency';
import { ENTRY_TYPE_LABELS } from './components/services/service-entries';
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
const KIND_WORDS: Readonly<
  Record<ContentRecordKind, { readonly name: string; readonly feminine: boolean }>
> = {
  word: { name: 'Слово', feminine: false },
  correction: { name: 'Виправлення', feminine: false },
  idiom: { name: 'Ідіому', feminine: true },
  synonymRow: { name: 'Синонімічний ряд', feminine: false },
  tip: { name: 'Пораду', feminine: true },
  curatedCollection: { name: 'Добірку', feminine: true },
  crosswordDay: { name: 'Кросворд дня', feminine: false },
};

const CONTENT_OPS: Readonly<Record<ContentActionOp, (feminine: boolean) => string>> = {
  create: () => 'додано',
  edit: () => 'змінено',
  retire: () => 'виведено',
  check: (feminine) => `позначено перевірен${feminine ? 'ою' : 'им'}`,
  flag: () => 'позначено для Черги контенту',
  allVoices: () => 'передано на запис у всіх голосах',
};

/** What the Власник reads of a named key: its sentence, and each side of its rows. */
interface NamedText<Key extends NamedActionKey> {
  readonly what: string;
  /**
   * A side of a row, parsed by the key's shape, given the row's other side;
   * none: as plain text. A method, so a key's text reads as any key's.
   */
  side?(value: ActionSide<Key>, other: unknown): string;
}

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

type Rule = ActionSide<'switches.rules.set'>[number];

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

type ContentSide = z.output<typeof ContentActionSideSchema>;
/** A record as a content write keeps it. */
type Snapshot = Extract<ContentSide, { readonly fields: unknown }>;

/** A record before or after a write: its version and what names it, or the fields an edit changed. */
function snapshotText(kind: string, snapshot: Snapshot, other: Snapshot | undefined): string {
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
function refText(kind: string, ref: Exclude<ContentSide, Snapshot>): string {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ref.id);
  const named =
    kind === 'crosswordDay' && date !== null
      ? `Кросворд на ${date[3] ?? ''}.${date[2] ?? ''}.${date[1] ?? ''}`
      : `Запис ${ref.id}`;
  return ref.recordVersion === undefined ? named : `${named} · версія ${String(ref.recordVersion)}`;
}

/** A side of a content write; an edit's Стало lists the fields it changed from its Було. */
function contentSide(what: string, value: unknown, before: unknown): string | undefined {
  const content = contentActionOf(what);
  if (content === undefined) return undefined;
  const side = ContentActionSideSchema.safeParse(value);
  if (!side.success) return undefined;
  if (!('fields' in side.data)) return refText(content.kind, side.data);
  const was = ContentActionSideSchema.safeParse(before);
  const compared =
    content.op === 'edit' && was.success && 'fields' in was.data ? was.data : undefined;
  return snapshotText(content.kind, side.data, compared);
}

/** A Person as the Власник reads them: the email, and the role when the row holds it. */
const personText = ({ email, role }: ActionSide<'admin.user.role'>) =>
  role === undefined ? email : `${email} · ${ROLE_LABELS[role]}`;

const agentText = ({ name, revoked }: ActionSide<'admin.agent.add'>) =>
  `Агент ${name}${revoked === true ? ' · відкликано' : ''}`;

const ownerCheckText = (check: ActionSide<'owner-check.add'>) =>
  'text' in check ? `«${short(check.text)}»` : check.ticked ? 'відмічено' : 'не відмічено';

const flagText = ({ flagId }: ActionSide<'content.flag.accept'>) => `позначка №${String(flagId)}`;

/** The Rules a row holds, named by their feature, or by the other side's when it holds none. */
const rulesSide = (rules: ActionSide<'switches.rules.set'>, other: unknown) => {
  const sibling = ACTION_SHAPES['switches.rules.set'].safeParse(other);
  return rulesText(rules, sibling.success ? sibling.data[0]?.feature : undefined);
};

/** A Service and the money fields the row holds: its plan, its monthly price, its billing day. */
const serviceText = ({ name, plan, monthlyPriceUsdCents, billingDay }: ActionSide<'service.add'>) =>
  [
    name,
    plan === undefined ? undefined : `тариф ${plan ?? 'не задано'}`,
    monthlyPriceUsdCents === undefined
      ? undefined
      : monthlyPriceUsdCents === null
        ? 'ціну не задано'
        : `${usd(monthlyPriceUsdCents)} на місяць`,
    billingDay === undefined
      ? undefined
      : billingDay === null
        ? 'день списання не задано'
        : `списання ${String(billingDay)}-го числа`,
  ]
    .filter((part) => part !== undefined)
    .join(' · ');

/** The fields of a Service entry an edit changed, as its form names them. */
const ENTRY_FIELDS: Readonly<Record<string, string>> = {
  type: 'тип',
  label: 'назва',
  note: 'де використовується',
  value: 'значення',
};

/** A Service entry by its Service and type. */
const entryText = ({ service, type }: ActionSide<'service.entry.add'>) => {
  const known = ServiceEntryTypeSchema.safeParse(type);
  return `${service} · ${known.success ? ENTRY_TYPE_LABELS[known.data] : type}`;
};

/** Every named key's sentence and sides: a key of the catalogue without a line here fails typecheck. */
const NAMED_TEXTS: { readonly [Key in NamedActionKey]: NamedText<Key> } = {
  'content.batch.review': { what: 'Пачку переглянуто' },
  'content.batch.rollback': {
    what: 'Пачку відкочено',
    // The batch rolled back: its id says nothing to the Власник.
    side: (rollback) =>
      'retired' in rollback
        ? `виведено: ${String(rollback.retired.length)} · повернуто: ${String(rollback.restored.length)} · пропущено: ${String(rollback.skipped.length)}`
        : '—',
  },
  'content.flag.accept': { what: 'Позначку прийнято', side: flagText },
  'content.flag.reject': { what: 'Позначку відхилено', side: flagText },
  'report.resolve': {
    what: 'Повідомлення про помилку вирішено',
    side: ({ entryId, type, comment }) =>
      `Запис ${entryId} · ${MISTAKE_TYPES[type] ?? type}${comment === undefined || comment === '' ? '' : ` · «${short(comment)}»`}`,
  },
  'account.delete': {
    what: 'Обліковий запис читача видалено',
    side: ({ email, createdAt }) => `${email}, створено ${day(createdAt)}`,
  },
  'admin.owner.add': { what: 'Додано Власника', side: personText },
  'admin.user.invite': { what: 'Запрошено людину в адмінку', side: personText },
  'admin.user.role': { what: 'Змінено роль', side: personText },
  'admin.user.remove': { what: 'Прибрано доступ до адмінки', side: personText },
  'admin.agent.add': { what: 'Видано токен Агента', side: agentText },
  'admin.agent.revoke': { what: 'Відкликано токен Агента', side: agentText },
  'owner-check.add': { what: 'Додано перевірку власника', side: ownerCheckText },
  'owner-check.import': { what: 'Перевірку власника перенесено з файлу', side: ownerCheckText },
  'owner-check.tick': { what: 'Перевірку власника відмічено', side: ownerCheckText },
  'alert-threshold.set': {
    what: 'Змінено поріг сповіщення',
    side: ({ key, value }) => {
      const label = Object.entries(THRESHOLD_LABELS).find(([name]) => name === key)?.[1] ?? key;
      return `${label}: ${value === undefined ? 'за замовчуванням' : number(value)}`;
    },
  },
  'switches.rules.set': { what: 'Змінено правила перемикача', side: rulesSide },
  'switches.kill': { what: 'Функцію вимкнено для всіх (аварійно)', side: rulesSide },
  'switches.minimum.set': {
    what: 'Змінено мінімальну версію застосунку',
    side: ({ platform, minimum }) => {
      const limits = [
        minimum?.soft === undefined ? undefined : `просити оновити нижче ${minimum.soft}`,
        minimum?.hard === undefined ? undefined : `не пускати нижче ${minimum.hard}`,
      ].filter((limit) => limit !== undefined);
      return `${PLATFORMS[platform] ?? platform}: ${limits.length === 0 ? 'не задано' : limits.join(', ')}`;
    },
  },
  'service.add': { what: 'Додано сервіс', side: serviceText },
  'service.money.edit': { what: 'Змінено тариф і ціну сервісу', side: serviceText },
  'service.entry.add': { what: 'Додано запис сервісу', side: entryText },
  'service.entry.edit': {
    what: 'Змінено запис сервісу',
    side: (entry) => {
      const fields = (entry.fields ?? []).map((field) => ENTRY_FIELDS[field] ?? field);
      return fields.length === 0
        ? entryText(entry)
        : `${entryText(entry)} · змінено: ${fields.join(', ')}`;
    },
  },
  'service.entry.delete': { what: 'Видалено запис сервісу', side: entryText },
  'service.entry.reveal': { what: 'Показано значення запису сервісу', side: entryText },
  'service.entry.copy': { what: 'Скопійовано значення запису сервісу', side: entryText },
};

/** A row's `what` as a sentence; a key it doesn't know reads as «Інша дія: …». */
export function whatOf(what: string): string {
  if (isNamedActionKey(what)) return NAMED_TEXTS[what].what;
  const content = contentActionOf(what);
  if (content === undefined) return `Інша дія: ${what}`;
  const words = KIND_WORDS[content.kind];
  return `${words.name} ${CONTENT_OPS[content.op](words.feminine)}`;
}

/** One side of a row of any key besides the content records', parsed by the shape its key writes. */
function otherSide(what: string, value: unknown, other: unknown): string | undefined {
  if (!isNamedActionKey(what)) return undefined;
  const text: NamedText<NamedActionKey> = NAMED_TEXTS[what];
  const parsed = ACTION_SHAPES[what].safeParse(value);
  return parsed.success ? text.side?.(parsed.data, other) : undefined;
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
