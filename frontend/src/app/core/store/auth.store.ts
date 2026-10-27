import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { computed } from '@angular/core';

export interface AuthState {
  currentUser: { id: string; name: string; role: string; phone?: string } | null;
  isAuthenticated: boolean;
  role: string | null;
}

const initialState: AuthState = {
  currentUser: null,
  isAuthenticated: false,
  role: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    isAdmin: computed(() => store.role() === 'admin'),
  })),
  withMethods((store) => ({
    setUser(user: { id: string; name: string; role: string; phone?: string }): void {
      patchState(store, { currentUser: user, isAuthenticated: true, role: user.role });
    },
    clearUser(): void {
      patchState(store, { currentUser: null, isAuthenticated: false, role: null });
    },
  })),
);
