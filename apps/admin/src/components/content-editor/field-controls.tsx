import { RARITIES } from '@slovo/contracts';

import {
  type EditorField,
  type FieldControl,
  type FormObject,
  type FormValue,
  formValueOf,
  isList,
  isObject,
  type Option,
  RARITY_LINES,
} from './kinds';

/** The Categories of the Edition a Category field picks from. */
export type CategoryOptions = Readonly<
  Record<'categories' | 'correctionCategories', readonly Option[]>
>;

const INPUT = 'rounded-lg border border-border bg-background px-3 py-2 text-sm';
const PILL =
  'rounded-full border border-border px-3 py-1 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground';
const SMALL_BUTTON =
  'self-start rounded-lg px-2 py-1 text-sm text-muted-foreground hover:text-foreground';

/** The letters a Stress can fall on. */
const VOWEL = /[аеєиіїоуюяaeiouy]/iu;

/** A control whose value is one text or choice, labelled by a `<label>` beside it. */
const isLeaf = (control: FieldControl) =>
  control.type === 'text' ||
  control.type === 'long-text' ||
  control.type === 'number' ||
  control.type === 'choice' ||
  control.type === 'category';

interface ControlProps {
  readonly id: string;
  readonly label: string;
  readonly control: FieldControl;
  readonly value: FormValue;
  /** The values of the fields beside this one, which a Stress control reads its text from. */
  readonly siblings: FormObject;
  readonly categories: CategoryOptions;
  readonly onChange: (value: FormValue) => void;
}

/**
 * One field of a record with its label: a text, number or choice under a
 * `<label>`, every other control as a labelled group. The error, if any, is
 * the field's own.
 */
export function FieldRow({
  error,
  ...props
}: ControlProps & { readonly error?: string | undefined }) {
  const { id, label, control } = props;
  const describedBy = error === undefined ? undefined : `${id}-error`;
  const message =
    error === undefined ? null : (
      <p id={describedBy} className="text-destructive">
        {error}
      </p>
    );
  if (isLeaf(control)) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor={id}>{label}</label>
        <Leaf {...props} invalid={error !== undefined} describedBy={describedBy} />
        {message}
      </div>
    );
  }
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      aria-invalid={error !== undefined}
      aria-describedby={describedBy}
      className="flex flex-col gap-1 text-sm"
    >
      <span id={`${id}-label`}>{label}</span>
      <Composite {...props} />
      {message}
    </div>
  );
}

/** A text, number or choice control. */
function Leaf({
  id,
  control,
  value,
  categories,
  onChange,
  invalid,
  describedBy,
  ariaLabel,
}: ControlProps & {
  readonly invalid?: boolean;
  readonly describedBy?: string | undefined;
  /** The name of a control with no `<label>`, a row of a list. */
  readonly ariaLabel?: string;
}) {
  const text = typeof value === 'string' ? value : '';
  const common = {
    id,
    value: text,
    'aria-label': ariaLabel,
    'aria-invalid': invalid,
    'aria-describedby': describedBy,
    className: INPUT,
  };
  if (control.type === 'choice' || control.type === 'category') {
    const options = control.type === 'choice' ? control.options : categories[control.of];
    const known = text === '' || options.some((option) => option.value === text);
    return (
      <select
        {...common}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        <option value="">—</option>
        {(known ? options : [...options, { value: text, label: text }]).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (control.type === 'long-text') {
    return (
      <textarea
        {...common}
        className={`${INPUT} min-h-20`}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    );
  }
  return (
    <input
      {...common}
      inputMode={control.type === 'number' ? 'numeric' : undefined}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}

/** A Stress, chips, rarity, list or object control. */
function Composite(props: ControlProps) {
  const { id, label, control, value, siblings, categories, onChange } = props;
  switch (control.type) {
    case 'stress': {
      const positions = isList(value) ? value : [];
      const text = siblings[control.of];
      const letters = Array.from(typeof text === 'string' ? text : '');
      if (letters.length === 0) {
        return <span className="text-muted-foreground">Спершу впишіть слово.</span>;
      }
      return (
        <div className="flex flex-wrap gap-0.5 text-lg">
          {letters.map((letter, position) => {
            if (!VOWEL.test(letter)) {
              return (
                <span key={position} className="px-1 py-0.5">
                  {letter}
                </span>
              );
            }
            const stressed = positions.includes(position);
            return (
              <button
                key={position}
                type="button"
                aria-pressed={stressed}
                className="rounded px-1 py-0.5 hover:bg-sunk aria-pressed:font-bold aria-pressed:text-primary aria-pressed:underline"
                onClick={() => {
                  onChange(
                    stressed
                      ? positions.filter((at) => at !== position)
                      : [...positions, position].sort((a, b) => Number(a) - Number(b)),
                  );
                }}
              >
                {letter}
              </button>
            );
          })}
        </div>
      );
    }
    case 'chips': {
      const picked = isList(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {control.options.map((option) => {
            const on = picked.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={on}
                className={PILL}
                onClick={() => {
                  onChange(
                    control.options
                      .map(({ value: each }) => each)
                      .filter((each) => (each === option.value ? !on : picked.includes(each))),
                  );
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );
    }
    case 'rarity':
      return (
        <div className="flex flex-wrap gap-1.5">
          {RARITIES.map((rarity) => (
            <button
              key={rarity}
              type="button"
              aria-pressed={value === rarity}
              className={`${PILL} flex flex-col items-start rounded-lg`}
              onClick={() => {
                onChange(rarity);
              }}
            >
              <span className="font-semibold">{rarity}</span>{' '}
              <span className="text-xs">{RARITY_LINES[rarity]}</span>
            </button>
          ))}
        </div>
      );
    case 'object':
      return (
        <SubFields
          id={id}
          fields={control.fields}
          value={isObject(value) ? value : {}}
          categories={categories}
          onChange={onChange}
        />
      );
    case 'list': {
      const items = isList(value) ? value : [];
      const item = control.item;
      const replaced = (index: number, next: FormValue) =>
        items.map((each, at) => (at === index ? next : each));
      return (
        <div className="flex flex-col gap-2">
          {items.map((each, index) => {
            const rowId = `${id}-${String(index)}`;
            const name = `${label} ${String(index + 1)}`;
            return (
              <div key={index} className="flex items-start gap-2">
                {isLeaf(item) ? (
                  <Leaf
                    id={rowId}
                    label={name}
                    ariaLabel={name}
                    control={item}
                    value={each}
                    siblings={{}}
                    categories={categories}
                    onChange={(next) => {
                      onChange(replaced(index, next));
                    }}
                  />
                ) : (
                  <div
                    role="group"
                    aria-label={name}
                    className="flex flex-1 flex-col gap-2 rounded-lg bg-sunk p-3"
                  >
                    {item.type === 'object' ? (
                      <SubFields
                        id={rowId}
                        fields={item.fields}
                        value={isObject(each) ? each : {}}
                        categories={categories}
                        onChange={(next) => {
                          onChange(replaced(index, next));
                        }}
                      />
                    ) : (
                      <Composite
                        {...props}
                        id={rowId}
                        label={name}
                        control={item}
                        value={each}
                        onChange={(next) => {
                          onChange(replaced(index, next));
                        }}
                      />
                    )}
                  </div>
                )}
                <button
                  type="button"
                  aria-label={`Прибрати ${String(index + 1)}`}
                  className={SMALL_BUTTON}
                  onClick={() => {
                    onChange(items.filter((_, at) => at !== index));
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className={SMALL_BUTTON}
            onClick={() => {
              onChange([...items, formValueOf(item, undefined)]);
            }}
          >
            + Додати
          </button>
        </div>
      );
    }
    default:
      return null;
  }
}

/** The labelled sub-fields of an object. */
function SubFields({
  id,
  fields,
  value,
  categories,
  onChange,
}: {
  readonly id: string;
  readonly fields: readonly EditorField[];
  readonly value: FormObject;
  readonly categories: CategoryOptions;
  readonly onChange: (value: FormValue) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {fields.map((field) => (
        <FieldRow
          key={field.name}
          id={`${id}-${field.name}`}
          label={field.label}
          control={field.control}
          value={value[field.name]}
          siblings={value}
          categories={categories}
          onChange={(next) => {
            onChange({ ...value, [field.name]: next });
          }}
        />
      ))}
    </div>
  );
}
