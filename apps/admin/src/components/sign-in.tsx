import type { AdminApiOutputs } from '@slovo/contracts/admin-api';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent, type ReactNode } from 'react';

import { adminApi } from '../api';
import { ME_KEY, refusalText } from '../session';
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
  'h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary';

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

  let body: ReactNode;
  if (step.at === 'email') {
    body = (
      <form
        className="flex flex-col gap-3"
        onSubmit={run(async (form) => {
          const email = text(form, 'email');
          await adminApi.requestCode({ email });
          setStep({ at: 'code', email });
        })}
      >
        <Field label="Пошта" name="email" type="email" autoComplete="email" />
        <Button disabled={busy}>Надіслати код</Button>
      </form>
    );
  } else if (step.at === 'code') {
    body = (
      <form
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
        <p className="text-sm text-muted-foreground">
          Ми надіслали код на {step.email}. Він дійсний 10 хвилин.
        </p>
        <Field label="Код із листа" name="code" autoComplete="one-time-code" />
        <Button disabled={busy}>Далі</Button>
      </form>
    );
  } else {
    body = (
      <form
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
        <Button disabled={busy}>Увійти</Button>
        {step.enrolment === undefined ? (
          <Button
            type="button"
            variant="outline"
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
    <main className="flex min-h-screen items-center justify-center bg-background p-8 font-sans text-foreground">
      <section
        aria-labelledby="sign-in-title"
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
      >
        <h1 id="sign-in-title" className="font-display text-xl font-semibold">
          Вхід до SLOVO Admin
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
    <div className="flex flex-col gap-2 text-sm">
      <p>Додайте SLOVO Admin у застосунок автентифікації.</p>
      <p>
        Ключ: <code className="font-mono">{enrolment.secret}</code>{' '}
        <a className="text-primary underline" href={enrolment.otpauthUrl}>
          Відкрити в застосунку
        </a>
      </p>
      <p>Коди відновлення показано один раз. Збережіть їх: кожен входить один раз замість коду.</p>
      <ul aria-label="Коди відновлення" className="grid grid-cols-2 gap-1 font-mono">
        {enrolment.recoveryCodes.map((recoveryCode) => (
          <li key={recoveryCode}>{recoveryCode}</li>
        ))}
      </ul>
    </div>
  );
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
