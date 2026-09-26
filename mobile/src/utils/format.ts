import type { Medication, Role, UserRef } from '../types/models';

/** YYYY-MM-DD in local time (the web uses toISOString().split('T')[0], which is UTC). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD as a local date (new Date('2024-01-02') would be UTC midnight). */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Calendar-date fields (medication start/end, date of birth) are sent as
 * "YYYY-MM-DD" and stored by Mongo as UTC midnight. Reading them with local
 * time moves them to the previous day west of UTC (and an edit form would then
 * save that shifted day back), so date-only values use their UTC calendar date.
 */
export function dateOnlyKey(iso: string): string {
  return iso.slice(0, 10);
}

export function fromDateOnly(iso: string): Date {
  return fromDateKey(dateOnlyKey(iso));
}

export function formatDateOnly(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  return iso ? formatDate(fromDateOnly(iso), opts) : '—';
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function formatDate(value: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return `${formatDate(value)} · ${formatTime(value)}`;
}

export function initials(person: { firstName?: string; lastName?: string } | null | undefined): string {
  if (!person) return '?';
  return `${person.firstName?.[0] ?? ''}${person.lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

export function fullName(person: { firstName?: string; lastName?: string } | UserRef | null | undefined): string {
  if (!person) return 'Unknown';
  return `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown';
}

export function capitalise(text: string | null | undefined): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function humanise(text: string | null | undefined): string {
  return capitalise((text ?? '').replace(/_/g, ' '));
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

/** Same rule as the web dashboards: is the medication active on this date? */
export function isMedicationActiveOn(med: Pick<Medication, 'startDate' | 'endDate'>, date: Date): boolean {
  const day = startOfDay(date);
  const start = fromDateOnly(med.startDate);
  if (day < start) return false;
  if (med.endDate) {
    const end = endOfDay(fromDateOnly(med.endDate));
    if (day > end) return false;
  }
  return true;
}

export const ROLE_LABEL: Record<Role, string> = {
  patient: 'Patient',
  caregiver: 'Caregiver',
  doctor: 'Doctor',
  admin: 'Admin',
};

/** Parse a numeric text input; empty → undefined (matches the web payload builders). */
export function numberOrUndefined(text: string): number | undefined {
  if (!text.trim()) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

export function splitList(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const EMAIL_RE = /\S+@\S+\.\S+/;

/** A real calendar date in YYYY-MM-DD form (the web build types dates by hand). */
export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toDateKey(fromDateKey(value)) === value;
}
