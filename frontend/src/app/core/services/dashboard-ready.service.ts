import { Injectable, signal } from '@angular/core';

/**
 * Lets the customer dashboard announce "my initial data load has settled"
 * without the app shell needing to know anything about bookings/dashboard
 * internals. Consumed by AppComponent to time the health-concern prompt.
 */
@Injectable({ providedIn: 'root' })
export class DashboardReadyService {
  readonly ready = signal(false);

  markReady(): void {
    this.ready.set(true);
  }
}
