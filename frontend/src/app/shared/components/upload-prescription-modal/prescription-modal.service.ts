import { Injectable, signal } from '@angular/core';

/**
 * Signal-based open/close state for the shared Upload Prescription dialog.
 * The single dialog instance lives in AppComponent; the navbar, hero,
 * footer, and sticky bottom CTA all open it through this service.
 */
@Injectable({ providedIn: 'root' })
export class PrescriptionModalService {
  readonly isOpen = signal(false);

  open(): void { this.isOpen.set(true); }
  close(): void { this.isOpen.set(false); }
}
