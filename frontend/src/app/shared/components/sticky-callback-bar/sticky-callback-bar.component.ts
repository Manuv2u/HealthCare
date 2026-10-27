import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ContactSettingsApiService } from '../../../core/api/services/contact-settings-api.service';
import { PrescriptionModalService } from '../upload-prescription-modal/prescription-modal.service';
import { CallbackRequestModalComponent } from '../callback-request-modal/callback-request-modal.component';

/**
 * Sticky bottom CTA bar (homepage): "Need Help Booking Tests?" with a
 * "Request a Call Back" button that opens the callback-request dialog,
 * plus the lab's phone number. Slides in from the bottom; hides itself
 * while a dialog is open.
 */
@Component({
  selector: 'app-sticky-callback-bar',
  standalone: true,
  imports: [CommonModule, MatIconModule, CallbackRequestModalComponent],
  template: `
    @if (!modal.isOpen() && !callbackOpen()) {
      <div class="scb-bar" role="complementary" aria-label="Need help booking tests">
        <div class="scb-inner">
          <div class="scb-text">
            <mat-icon class="scb-help-icon" aria-hidden="true">contact_support</mat-icon>
            <span class="scb-title">Need Help Booking Tests?</span>
          </div>

          <div class="scb-actions">
            <button type="button" class="scb-cta" (click)="callbackOpen.set(true)">
              <mat-icon>phone_callback</mat-icon>
              Request a Call Back
            </button>

            @if (callEnabled()) {
              <span class="scb-or" aria-hidden="true">OR</span>

              <a class="scb-call" [href]="'tel:' + phoneHref()">
                <mat-icon>call</mat-icon>
                <span class="scb-call-text">
                  <span class="scb-call-label">Call Us</span>
                  <span class="scb-call-number">{{ phoneDisplay() }}</span>
                </span>
              </a>
            }
          </div>
        </div>
      </div>
    }

    <app-callback-request-modal [open]="callbackOpen()" (closed)="callbackOpen.set(false)" />
  `,
  styles: [`
    :host {
      /* Single-accent teal bar with a clean white CTA */
      --scb-green:      #003399;
      --scb-green-dark: #002577;
      --scb-green-deep: #001B57;
      --scb-yellow:     #ffffff;
      --scb-yellow-dark:#EEF4FF;
      --scb-yellow-ink: #002577;
    }

    .scb-bar {
      position: fixed; left: 0; right: 0; bottom: 0;
      z-index: 400; /* below the quick-help FAB (500) and modals (1000+) */
      background: linear-gradient(135deg, var(--scb-green) 0%, var(--scb-green-dark) 100%);
      box-shadow: 0 -8px 24px rgba(0, 37, 119, .28);
      padding-bottom: env(safe-area-inset-bottom, 0px);
      animation: scb-slide-up .35s cubic-bezier(0, 0, .2, 1);
    }
    @keyframes scb-slide-up {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }

    .scb-inner {
      max-width: 1280px; margin: 0 auto;
      padding: .65rem 1.75rem;
      display: flex; align-items: center; justify-content: center;
      gap: 1.25rem; flex-wrap: wrap;
    }

    .scb-text { display: flex; align-items: center; gap: .5rem; color: #fff; }
    .scb-help-icon { font-size: 1.4rem; width: 1.4rem; height: 1.4rem; opacity: .9; }
    .scb-title { font-size: 1rem; font-weight: 700; letter-spacing: .01em; }

    .scb-actions { display: flex; align-items: center; gap: 1rem; }

    .scb-cta {
      display: inline-flex; align-items: center; gap: .5rem;
      padding: .6rem 1.15rem;
      background: linear-gradient(135deg, var(--scb-yellow) 0%, var(--scb-yellow-dark) 100%);
      color: var(--scb-yellow-ink);
      border: none; border-radius: 999px;
      font: inherit; font-size: .9rem; font-weight: 800; cursor: pointer;
      box-shadow: 0 6px 16px -4px rgba(0, 0, 0, .35);
      transition: transform .15s, filter .15s;
    }
    .scb-cta mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; }
    .scb-cta:hover { transform: translateY(-1px); filter: brightness(1.05); }
    .scb-cta:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

    .scb-or {
      font-size: .74rem; font-weight: 700; color: rgba(255, 255, 255, .75);
      letter-spacing: .08em;
    }

    .scb-call {
      display: inline-flex; align-items: center; gap: .55rem;
      color: #fff; text-decoration: none;
      padding: .35rem .6rem; border-radius: 12px;
      transition: background .15s;
    }
    .scb-call:hover { background: rgba(255, 255, 255, .12); }
    .scb-call:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    .scb-call mat-icon { font-size: 1.35rem; width: 1.35rem; height: 1.35rem; }
    .scb-call-text { display: flex; flex-direction: column; line-height: 1.15; }
    .scb-call-label { font-size: .7rem; font-weight: 600; opacity: .85; text-transform: uppercase; letter-spacing: .06em; }
    .scb-call-number { font-size: .95rem; font-weight: 800; letter-spacing: .02em; }

    /* ── Mobile: sit above the bottom navigation bar ──
       Matches app.component.ts's bottom-nav breakpoint (1099px) so the
       call-back button disappears exactly when the bottom nav appears. */
    @media (max-width: 1099px) {
      .scb-bar {
        bottom: calc(var(--bnav-h, 64px) + env(safe-area-inset-bottom, 0px));
        padding-bottom: 0;
      }
      .scb-inner {
        padding: .55rem .9rem;
        gap: .5rem .9rem;
      }
      .scb-title { font-size: .88rem; }
      .scb-cta { display: none; } /* call back is not needed on mobile — Call Us covers it */
      .scb-or { display: none; }
      .scb-call-number { font-size: .88rem; }
    }

    /* ── Phone: hide the bar entirely ──
       Keep it for tablet/desktop only; the bottom nav's own actions
       (Book, etc.) cover mobile users. */
    @media (max-width: 767px) {
      .scb-bar { display: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .scb-bar { animation: none; }
      .scb-cta { transition: none; }
    }
  `],
})
export class StickyCallbackBarComponent implements OnInit {
  private contactApi = inject(ContactSettingsApiService);
  readonly modal = inject(PrescriptionModalService);

  callbackOpen = signal(false);
  phoneDisplay = signal('+91 77951 49207');
  phoneHref = signal('+917795149207');
  callEnabled = signal(true);

  ngOnInit(): void {
    this.contactApi.get().subscribe({
      next: (s) => {
        if (s?.phone_number) {
          this.phoneDisplay.set(s.phone_number);
          this.phoneHref.set(s.phone_number.replace(/[^+\d]/g, ''));
        }
        this.callEnabled.set(s?.call_enabled ?? true);
      },
      error: () => {}, // keep the static fallback number
    });
  }
}
