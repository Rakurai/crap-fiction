const STAMP_FORMAT: Readonly<Intl.DateTimeFormatOptions> = { dateStyle: 'short', timeStyle: 'short' }

export function formatStamp(atMs: number): string {
  return new Date(atMs).toLocaleString(undefined, STAMP_FORMAT)
}
