import { signalStore, withState, withMethods, patchState, getState } from '@ngrx/signals';
import { FeatureCardItem } from '../api/api.types';

export interface BookingWizardState {
  patientId: string | null;
  patientName: string | null;
  selectedTests: { id: string; name: string; price: number }[];
  selectedPackages: { id: string; name: string; price: number }[];
  /** Union of enabled feature cards across the selected tests/packages — drives
      the "Why Choose This Test" panel shown alongside every wizard step. */
  selectedFeatureCards: FeatureCardItem[];
  slotId: string | null;
  slotDate: string | null;
  /** Human-readable slot window, e.g. "7:00 AM - 8:00 AM". Carried so the
      summary can show the time without re-fetching the slot. */
  slotLabel: string | null;
  collectionType: 'home' | 'lab' | null;
  pincode: string | null;
  labBranchId: string | null;
  selectedAddressId: string | null;
  paymentMethod: string | null;
  currentStep: number;
}

const initialState: BookingWizardState = {
  patientId: null,
  patientName: null,
  selectedTests: [],
  selectedPackages: [],
  selectedFeatureCards: [],
  slotId: null,
  slotDate: null,
  slotLabel: null,
  collectionType: null,
  pincode: null,
  labBranchId: null,
  selectedAddressId: null,
  paymentMethod: null,
  currentStep: 0,
};

/** sessionStorage (not localStorage): survives refresh/back-nav within a tab,
    but a booking session shouldn't quietly resume days later in a new tab. */
const SESSION_KEY = 'booking-wizard-state';

export const BookingWizardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    reset(): void {
      patchState(store, initialState);
      sessionStorage.removeItem(SESSION_KEY);
    },
    patch(partial: Partial<BookingWizardState>): void {
      patchState(store, partial);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(getState(store)));
    },
    /** Restores a previously in-progress booking. Returns whether anything was found. */
    loadFromSession(): boolean {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;

      try {
        const saved = JSON.parse(raw) as Partial<BookingWizardState>;
        patchState(store, saved);
        return true;
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
        return false;
      }
    },
  })),
);
