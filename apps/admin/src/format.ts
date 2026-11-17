/** A moment as the admin reads it: Ukrainian, in Kyiv time, date and minutes. */
export const formatMoment = (iso: string) =>
  new Date(iso).toLocaleString('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Kyiv',
  });

/** A day and its minutes in Kyiv time, «17 листопада, 19:40», for what happens this year. */
export function formatWhen(iso: string): string {
  const at = new Date(iso);
  const day = at.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Kyiv',
  });
  const time = at.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  });
  return `${day}, ${time}`;
}
