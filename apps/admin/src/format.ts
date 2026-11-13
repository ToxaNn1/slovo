/** A moment as the admin reads it: Ukrainian, in Kyiv time, date and minutes. */
export const formatMoment = (iso: string) =>
  new Date(iso).toLocaleString('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Kyiv',
  });
