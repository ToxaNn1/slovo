import type { AdminApiOutputs } from '@slovo/contracts/admin-api';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent, type ReactNode } from 'react';

import { adminApi } from '../api';
import { ME_KEY, refusalText } from '../session';
import { cn } from '../lib/utils';
import { Logo } from './sidebar';
import { Button } from './ui/button';

type Enrolment = Extract<AdminApiOutputs['verifyCode'], { next: 'enrol' }>;

/** Where the sign-in is: the email, the emailed code, then the TOTP (set up the first time). */
type Step =
  | { readonly at: 'email' }
  | { readonly at: 'code'; readonly email: string }
  | {
      readonly at: 'factor';
      readonly email: string;
      readonly code: string;
      readonly enrolment?: Enrolment;
    };

const FIELD =
  'rounded-[11px] border-[1.5px] border-transparent bg-background px-[13px] py-3 text-[15px] font-normal outline-none focus:border-primary';

/** The design's step bar; the TOTP set-up shows the recovery codes too, so it lights «Коди». */
const STEPS = ['Email', 'Код з листа', 'TOTP', 'Коди'] as const;

const BIG = 'h-auto rounded-[11px] py-3 text-sm';

/** The admin's sign-in (ADR 0088): an emailed code, then a TOTP or a recovery code. */
export function SignIn() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>({ at: 'email' });
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  /** Runs one step, showing its refusal. */
  const run =
    (action: (form: FormData) => Promise<void>) => (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      setBusy(true);
      setError(undefined);
      action(form)
        .catch((refusal: unknown) => {
          setError(refusalText(refusal));
        })
        .finally(() => {
          setBusy(false);
        });
    };
  const text = (form: FormData, name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };

  let title: string;
  let reached: number;
  let body: ReactNode;
  if (step.at === 'email') {
    title = 'Увійти';
    reached = 0;
    body = (
      <form
        key="email"
        className="flex flex-col gap-3"
        onSubmit={run(async (form) => {
          const email = text(form, 'email');
          await adminApi.requestCode({ email });
          setStep({ at: 'code', email });
        })}
      >
        <Hint>Надішлемо код на пошту.</Hint>
        <Field label="Пошта" name="email" type="email" autoComplete="email" />
        <Button className={BIG} disabled={busy}>
          Надіслати код
        </Button>
      </form>
    );
  } else if (step.at === 'code') {
    title = 'Код з листа';
    reached = 1;
    body = (
      <form
        key="code"
        className="flex flex-col gap-3"
        onSubmit={run(async (form) => {
          const code = text(form, 'code');
          const next = await adminApi.verifyCode({ email: step.email, code });
          setStep({
            at: 'factor',
            email: step.email,
            code,
            ...(next.next === 'enrol' ? { enrolment: next } : {}),
          });
        })}
      >
        <Hint>Ми надіслали код на {step.email}. Він дійсний 10 хвилин.</Hint>
        <Field label="Код із листа" name="code" autoComplete="one-time-code" />
        <Button className={BIG} disabled={busy}>
          Далі
        </Button>
      </form>
    );
  } else {
    const enrolling = step.enrolment !== undefined;
    title = enrolling ? 'Налаштуйте TOTP' : recovery ? 'Код відновлення' : 'Код із застосунку';
    reached = enrolling ? 3 : 2;
    body = (
      <form
        key="factor"
        className="flex flex-col gap-3"
        onSubmit={run(async (form) => {
          const value = text(form, 'factor');
          await adminApi.signIn({
            email: step.email,
            code: step.code,
            factor: recovery
              ? { kind: 'recovery', recoveryCode: value }
              : { kind: 'totp', totp: value },
          });
          await queryClient.invalidateQueries({ queryKey: ME_KEY });
        })}
      >
        {step.enrolment === undefined ? null : <Enrol enrolment={step.enrolment} />}
        <Field
          key={recovery ? 'recovery' : 'totp'}
          label={recovery ? 'Код відновлення' : 'Код із застосунку'}
          name="factor"
          autoComplete="one-time-code"
        />
        <Button className={BIG} disabled={busy}>
          Увійти
        </Button>
        {step.enrolment === undefined ? (
          <Button
            type="button"
            variant="secondary"
            className={BIG}
            onClick={() => {
              setRecovery(!recovery);
            }}
          >
            {recovery ? 'Увійти кодом із застосунку' : 'Увійти кодом відновлення'}
          </Button>
        ) : null}
      </form>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-[18px] bg-backdrop p-6 font-sans text-foreground">
      <div className="flex w-full max-w-[400px] items-center gap-2.5 text-[#f2f0fb]">
        <Logo withName={false} />
        <span className="font-display text-[15px] font-medium">slovo адмінка</span>
      </div>
      <ol aria-label="Кроки входу" className="flex w-full max-w-[400px] gap-1.5">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === reached ? 'step' : undefined}
            className={cn(
              'flex flex-1 flex-col gap-1.5 text-[11px]',
              index <= reached ? 'text-[#f2f0fb]' : 'text-[#6e6a88]',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'h-[3px] rounded-[2px]',
                index <= reached ? 'bg-primary' : 'bg-[#2a2554]',
              )}
            />
            {label}
          </li>
        ))}
      </ol>
      {/* The card stays light in both Themes, as in the design. */}
      <section
        data-theme="light"
        aria-labelledby="sign-in-title"
        className="flex w-full max-w-[400px] flex-col gap-3.5 rounded-[18px] bg-surface p-6 text-foreground"
      >
        <h1 id="sign-in-title" className="font-display text-lg font-medium">
          {title}
        </h1>
        {body}
        {error === undefined ? null : (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

/** The TOTP set-up, shown once: the secret, its link and the recovery codes. */
function Enrol({ enrolment }: { readonly enrolment: Enrolment }) {
  return (
    <div className="flex flex-col gap-2 text-[13px] text-muted-foreground">
      <p>Додайте SLOVO Admin у застосунок автентифікації.</p>
      <p>
        Ключ: <code className="font-mono">{enrolment.secret}</code>{' '}
        <a className="text-primary underline" href={enrolment.otpauthUrl}>
          Відкрити в застосунку
        </a>
      </p>
      <p>Коди відновлення показано один раз. Збережіть їх: кожен входить один раз замість коду.</p>
      <ul
        aria-label="Коди відновлення"
        className="grid grid-cols-2 gap-1.5 rounded-xl bg-sunk p-3 font-mono text-[13px] font-medium text-foreground"
      >
        {enrolment.recoveryCodes.map((recoveryCode) => (
          <li key={recoveryCode}>{recoveryCode}</li>
        ))}
      </ul>
    </div>
  );
}

function Hint({ children }: { readonly children: ReactNode }) {
  return <p className="-mt-1.5 text-[13px] leading-[1.45] text-muted-foreground">{children}</p>;
}

function Field({
  label,
  name,
  type = 'text',
  autoComplete,
}: {
  readonly label: string;
  readonly name: string;
  readonly type?: string;
  readonly autoComplete: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input className={FIELD} name={name} type={type} autoComplete={autoComplete} required />
    </label>
  );
}
