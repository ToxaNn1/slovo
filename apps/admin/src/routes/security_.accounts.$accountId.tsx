import { AccessRefusalSchema, type AccountDetail } from '@slovo/contracts/admin-api';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { recordsBlocks, signInMethodsText } from '../account-records';
import { adminApi } from '../api';
import { useAdminWrite } from '../components/admin-write';
import { ConfirmDialog } from '../components/confirm-dialog';
import { Button } from '../components/ui/button';
import { formatMoment } from '../format';
import { refusalData, useSignedInAdmin } from '../session';

export const Route = createFileRoute('/security_/accounts/$accountId')({
  component: AccountPage,
});

/** What the Власник reads of a refused deletion. */
function refusalOf(error: unknown): string {
  return AccessRefusalSchema.safeParse(refusalData(error)).data?.refusal === 'unknown'
    ? 'Цього акаунта вже немає: оновіть сторінку.'
    : 'Не вдалося. Спробуйте ще раз.';
}

/** One reader Account on its own page, read only, and deleted with a reason (ADR 0162); a Власник only. */
function AccountPage() {
  const admin = useSignedInAdmin();
  if (admin?.role !== 'owner') {
    return <p className="text-sm text-muted-foreground">Безпека відкрита лише Власнику.</p>;
  }
  return <OwnerAccountPage />;
}

function OwnerAccountPage() {
  const { accountId } = Route.useParams();
  const opened = useQuery({
    queryKey: ['reader-account', accountId],
    queryFn: () => adminApi.getAccount({ accountId }),
    retry: false,
  });
  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/security"
        className="self-start rounded-lg bg-sunk px-3 py-1.5 text-[12.5px] text-foreground no-underline hover:bg-border"
      >
        ← Безпека
      </Link>
      {opened.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Не вдалося завантажити.
        </p>
      ) : null}
      {opened.data === undefined ? null : opened.data.account === null ? (
        <p className="text-sm text-muted-foreground">Цього акаунта немає: його видалено.</p>
      ) : (
        <ReaderAccount account={opened.data.account} />
      )}
    </div>
  );
}

function ReaderAccount({ account }: { account: AccountDetail }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const remove = useAdminWrite(adminApi.deleteAccount);
  return (
    <section aria-label="Акаунт читача" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-semibold">{account.email}</h2>
          <p className="text-[13px] text-muted-foreground">
            Створено {formatMoment(account.createdAt)}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {`Входи: ${signInMethodsText(account.signInMethods)}`}
          </p>
        </div>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            setDeleting(true);
          }}
        >
          Видалити акаунт
        </Button>
      </div>
      {account.editions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Немає даних синхронізації.</p>
      ) : (
        account.editions.map(({ editionId, records }) => (
          <section
            key={editionId}
            aria-label={`Видання ${editionId}`}
            className="flex flex-col gap-4"
          >
            <h3 className="font-display text-base font-semibold">Видання {editionId}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {recordsBlocks(records).map(({ title, lines }) => (
                <section
                  key={title}
                  aria-label={title}
                  className="flex flex-col gap-1 rounded-lg border border-border p-3"
                >
                  <h4 className="text-[13px] font-semibold">{title}</h4>
                  <ul className="flex flex-col gap-0.5 text-[13px]">
                    {lines.map((line, index) => (
                      <li key={index} className="break-words">
                        {line}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        ))
      )}
      {deleting ? (
        <ConfirmDialog
          title={`Видалити акаунт ${account.email} назавжди? Слова, прогрес і входи читача зникнуть.`}
          confirmLabel="Видалити акаунт"
          danger
          onConfirm={async (reason) => {
            await remove.mutateAsync({ email: account.email, reason });
            await navigate({ to: '/security' });
          }}
          onClose={() => {
            setDeleting(false);
          }}
          refusalText={refusalOf}
        />
      ) : null}
    </section>
  );
}
