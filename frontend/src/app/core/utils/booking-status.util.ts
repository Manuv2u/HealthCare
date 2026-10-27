/** All booking statuses an admin can filter/set — shared by the bookings table and appointment calendar. */
export const BOOKING_STATUS_OPTIONS = [
  'booked',
  'technician_assigned',
  'accepted',
  'on_the_way',
  'sample_collected',
  'reached_lab',
  'sample_delivered',
  'processing',
  'report_ready',
  'completed',
  'cancelled',
];

/** Human-readable label for a snake_case status/enum value, e.g. "sample_collected" -> "Sample Collected". */
export function fmtStatus(s: string): string {
  return (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Badge color for a booking status — single source of truth shared by the bookings table and appointment calendar. */
export function statusColor(s: string): string {
  const m: Record<string, string> = {
    booked: 'warning',
    technician_assigned: 'info',
    accepted: 'info',
    on_the_way: 'primary',
    sample_collected: 'primary',
    reached_lab: 'primary',
    sample_delivered: 'primary',
    processing: 'primary',
    report_ready: 'info',
    completed: 'success',
    cancelled: 'error',
    collected: 'primary',
  };
  return m[s] ?? 'default';
}
