/**
 * IST (Asia/Kolkata, UTC+5:30, no DST) date/time helpers.
 * The app stores/exchanges timestamps in UTC; these helpers are the single
 * place responsible for converting to/from IST for display and for
 * `datetime-local` inputs, instead of each component re-deriving it.
 */

const IST_OFFSET_MINUTES = 5 * 60 + 30;

function toIstShifted(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
}

/** "YYYY-MM-DDTHH:mm" in IST, suitable for an `<input type="datetime-local">` value. */
export function isoToIstDatetimeLocal(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const ist = toIstShifted(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}T${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
}

/** Current time as an IST `datetime-local` value. */
export function nowIstForDatetimeLocal(): string {
  return isoToIstDatetimeLocal(new Date());
}

/** Interprets a `datetime-local` string as IST wall-clock time and returns a UTC ISO string. */
export function istDatetimeLocalToUtcIso(local: string): string {
  return new Date(`${local}:00.000+05:30`).toISOString();
}

/** Today's date ("YYYY-MM-DD") in IST — use instead of `new Date().toISOString().split('T')[0]`. */
export function todayIstDateStr(): string {
  return isoToIstDatetimeLocal(new Date()).slice(0, 10);
}

/** Hour-of-day (0-23) in IST, e.g. for time-of-day greetings. */
export function getIstHours(date: Date = new Date()): number {
  return toIstShifted(date).getUTCHours();
}

/** Whether two instants fall on the same IST calendar day. */
export function isSameIstDay(a: Date | string, b: Date | string): boolean {
  const dateA = typeof a === 'string' ? new Date(a) : a;
  const dateB = typeof b === 'string' ? new Date(b) : b;
  return isoToIstDatetimeLocal(dateA).slice(0, 10) === isoToIstDatetimeLocal(dateB).slice(0, 10);
}

/** Formats an instant in IST for places that can't use Angular's `date` pipe (e.g. plain strings, alerts). */
export function formatIst(value: string | Date, pattern: 'date' | 'datetime' | 'time' = 'datetime'): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata' };
  if (pattern !== 'time') {
    options.day = '2-digit';
    options.month = 'short';
    options.year = 'numeric';
  }
  if (pattern !== 'date') {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = true;
  }
  return new Intl.DateTimeFormat('en-IN', options).format(date);
}
