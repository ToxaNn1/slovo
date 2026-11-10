import { useState } from 'react';

import { adminApi } from '../../api';
import { refusalText } from '../../session';
import { RefusedSchema } from './record-form';

/** A Word's live Illustration, as the content editor shows it (ADR 0099). */
interface LiveIllustration {
  readonly hash: string;
  readonly url: string;
}

/**
 * A Word's Illustration and its upload. The backend checks the file against
 * the Illustration rules (ADR 0055); a refused rule shows by its name.
 */
export function IllustrationUpload({
  editionId,
  id,
  illustration,
  onUploaded,
}: {
  readonly editionId: string;
  readonly id: string;
  readonly illustration: LiveIllustration | undefined;
  readonly onUploaded: (contentVersion: number) => void;
}) {
  const [live, setLive] = useState(illustration);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<readonly string[]>([]);

  const upload = async (file: File) => {
    setBusy(true);
    setErrors([]);
    try {
      const png = await base64Of(file);
      const answer = await adminApi.content.uploadIllustration({ editionId, id, png });
      setLive(answer.illustration);
      onUploaded(answer.contentVersion);
    } catch (error) {
      const refusal = RefusedSchema.safeParse(error);
      setErrors(
        refusal.success
          ? refusal.data.data.refusals.map(({ rule, message }) => `${rule}: ${message}`)
          : [refusalText(error)],
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Ілюстрація"
      className="flex flex-col gap-3 rounded-2xl bg-surface px-[18px] py-4 shadow-panel"
    >
      <h3 className="text-sm font-semibold">Ілюстрація</h3>
      {live === undefined ? (
        <p className="text-sm text-muted-foreground">Немає ілюстрації</p>
      ) : (
        <img
          src={live.url}
          alt="Ілюстрація"
          className="size-40 rounded-[10px] bg-sunk object-contain"
        />
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Завантажити ілюстрацію</span>
        <input
          type="file"
          accept="image/png"
          disabled={busy}
          className="text-[13px]"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file !== undefined) void upload(file);
          }}
        />
      </label>
      <p className="text-xs text-subtle">PNG, квадратна, до 150 КБ</p>
      {errors.map((error) => (
        <p key={error} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ))}
    </section>
  );
}

/** The file's bytes in base64, without the data URL's prefix. */
function base64Of(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('The file could not be read'));
    };
    reader.readAsDataURL(file);
  });
}
