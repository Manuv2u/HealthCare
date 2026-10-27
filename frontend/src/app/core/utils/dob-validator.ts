import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const MAX_AGE_YEARS = 130;

/** Today's date as YYYY-MM-DD, for binding to a date input's `max` attribute. */
export function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Rejects a date of birth in the future, or implausibly far in the past. */
export const dobValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (!value) return null;
  const dob = new Date(value);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dob.getTime() > today.getTime()) return { dobFuture: true };
  const minDate = new Date(today);
  minDate.setFullYear(minDate.getFullYear() - MAX_AGE_YEARS);
  if (dob.getTime() < minDate.getTime()) return { dobTooOld: true };
  return null;
};
