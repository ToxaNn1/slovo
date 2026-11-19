import type { AdminApiOutputs } from '@slovo/contracts/admin-api';
import { useState } from 'react';

import { adminApi } from '../../api';
import { codeOf, refusalData } from '../../session';
import { useAdminWrite } from '../admin-write';
import { ConfirmDialog } from '../confirm-dialog';
import { Button } from '../ui/button';

type Recordings = NonNullable<
  AdminApiOutputs['content']['records']['records'][number]['recordings']
>;

/** What the admin reads of a refused «Додати інші голоси». */
function refusalOf(error: unknown): string {
  const code = codeOf(error);
  if (code === 'NOT_ADDABLE') {
    const data = refusalData(error);
    return typeof data === 'object' && data !== null && 'reason' in data && data.reason === 'listed'
      ? 'Слово вже чекає запису в усіх голосах'
      : 'Слово виведене з ужитку або його немає';
  }
  if (code === 'FORBIDDEN') return 'Інші голоси додає лише Власник або Адмін';
  return 'Не вдалося додати голоси';
}

/**
 * A Word's Recordings in the Words list as «N з M» (ADR 0195): a Word in
 * fewer than every voice and not on the list of Words in all voices has
 * «Додати інші голоси», one confirmation and no reason; one on the list
 * waits for the next run of the Recordings job.
 */
export function RecordingsCell({
  editionId,
  id,
  label,
  recordings,
}: {
  readonly editionId: string;
  readonly id: string;
  readonly label: string;
  readonly recordings: Recordings;
}) {
  const [confirming, setConfirming] = useState(false);
  const add = useAdminWrite(() => adminApi.content.addOtherVoices({ editionId, id }));
  const { live, of, allVoices } = recordings;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>{`${String(live)} з ${String(of)}`}</span>
      {live < of &&
        (allVoices ? (
          <span className="text-xs text-subtle">чекає запису</span>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            aria-label={`Додати інші голоси: ${label}`}
            onClick={() => {
              setConfirming(true);
            }}
          >
            Додати інші голоси
          </Button>
        ))}
      {confirming && (
        <ConfirmDialog
          title={`Додати інші голоси до «${label}»?`}
          confirmLabel="Додати"
          asksReason={false}
          onConfirm={async () => {
            await add.mutateAsync(undefined);
          }}
          onClose={() => {
            setConfirming(false);
          }}
          refusalText={refusalOf}
        >
          <p>Наступний запуск запису озвучить це слово в голосах, яких йому бракує.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
