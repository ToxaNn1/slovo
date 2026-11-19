import type { CategoryOptions, EditorField, FieldControl } from '../content-editor/kinds';

/**
 * A field's value as plain text to read on the review card: a list one item
 * after another, an object its values; none for an empty value.
 */
function readable(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const items = value.map(readable).filter((item) => item !== undefined);
    return items.length === 0 ? undefined : items.join('; ');
  }
  if (typeof value === 'object') {
    const parts = Object.values(value)
      .map(readable)
      .filter((part) => part !== undefined);
    return parts.length === 0 ? undefined : parts.join(' — ');
  }
  return undefined;
}

const STRESS_MARK = '́';

/**
 * A field's value as the owner reads it on the review card: a choice by its
 * label, a Category by the name the app shows, stressed vowels marked in the
 * word they stress, an object's sub-fields by their labels; none for an empty value.
 */
export function readableField(
  field: EditorField,
  fields: Readonly<Record<string, unknown>>,
  categories: CategoryOptions,
): string | undefined {
  return readableAs(field.control, fields[field.name], fields, categories);
}

function readableAs(
  control: FieldControl,
  value: unknown,
  siblings: Readonly<Record<string, unknown>>,
  categories: CategoryOptions,
): string | undefined {
  switch (control.type) {
    case 'category':
      return (
        categories[control.of].find((option) => option.value === value)?.label ?? readable(value)
      );
    case 'choice':
    case 'chips': {
      const label = (each: unknown) =>
        control.options.find((option) => option.value === each)?.label ?? readable(each);
      if (Array.isArray(value)) return joined(value.map(label), ', ');
      return value === undefined || value === '' ? undefined : label(value);
    }
    case 'stress': {
      const text = siblings[control.of];
      if (typeof text !== 'string' || !Array.isArray(value) || value.length === 0) return undefined;
      return Array.from(text)
        .map((letter, at) => (value.includes(at) ? `${letter}${STRESS_MARK}` : letter))
        .join('');
    }
    case 'list':
      return Array.isArray(value)
        ? joined(
            value.map((item) => readableAs(control.item, item, siblings, categories)),
            '\n',
          )
        : undefined;
    case 'object':
      if (!isRecord(value)) return undefined;
      return joined(
        control.fields.map((sub) => {
          const text = readableField(sub, value, categories);
          return text === undefined ? undefined : `${sub.label}: ${text}`;
        }),
        ' · ',
      );
    default:
      return readable(value);
  }
}

function joined(parts: readonly (string | undefined)[], by: string): string | undefined {
  const present = parts.filter((part) => part !== undefined);
  return present.length === 0 ? undefined : present.join(by);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
