import { Component, EventEmitter, HostListener, Input, OnDestroy, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CallbackRequestApiService } from '../../../core/api/services/callback-request-api.service';
import { InputComponent } from '../input/input.component';
import { sanitizePhoneInput } from '../../../core/utils/phone.util';

/**
 * Shared "Request a Callback" modal.
 * Desktop: centered dialog. Mobile: bottom sheet.
 * Submits to the existing POST /callback-requests endpoint.
 */
@Component({
  selector: 'app-callback-request-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, InputComponent],
  template: `
    @if (isOpen) {
      <div class="cbm-backdrop" (click)="requestClose()"></div>

      <div class="cbm-dialog" role="dialog" aria-modal="true" aria-labelledby="cbm-title">
        <div class="cbm-grabber" aria-hidden="true"></div>

        <div class="cbm-head">
          <div class="cbm-badge"><mat-icon>support_agent</mat-icon></div>
          <div class="cbm-head-text">
            <h3 id="cbm-title">Request a Callback</h3>
            <p>Leave your details and our health advisor will call you back.</p>
          </div>
          <button type="button" class="cbm-close" (click)="requestClose()" aria-label="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        @if (done()) {
          <div class="cbm-success">
            <div class="cbm-success-icon"><mat-icon>check_circle</mat-icon></div>
            <h4>Request received!</h4>
            <p>Thanks — our team will call you shortly at <strong>+91 {{ form.get('phone')?.value }}</strong>.</p>
            <button type="button" class="cbm-submit" (click)="requestClose()">Done</button>
          </div>
        } @else {
          <form class="cbm-form" [formGroup]="form" (ngSubmit)="submit()">
            <app-input
              label="Name"
              icon="person"
              formControlName="name"
              placeholder="Your name"
              [maxlength]="100"
              autocomplete="name"
            />

            <app-input
              label="Phone Number"
              [required]="true"
              prefix="+91"
              type="tel"
              formControlName="phone"
              placeholder="10-digit mobile number"
              inputmode="numeric"
              [maxlength]="10"
              autocomplete="tel-national"
              [error]="showPhoneError()"
              errorMessage="Enter a valid 10-digit phone number"
              (input)="sanitizePhone($event)"
            />

            <div class="cbm-field">
              <span class="cbm-label">Preferred Time</span>
              <div class="cbm-chips" role="radiogroup" aria-label="Preferred time">
                @for (slot of timeSlots; track slot.value) {
                  <button
                    type="button"
                    class="cbm-chip"
                    role="radio"
                    [attr.aria-checked]="form.get('preferred_time')?.value === slot.value"
                    [class.selected]="form.get('preferred_time')?.value === slot.value"
                    (click)="form.get('preferred_time')?.setValue(slot.value)"
                  >
                    <mat-icon>{{ slot.icon }}</mat-icon>
                    {{ slot.label }}
                  </button>
                }
              </div>
            </div>

            <app-input
              label="Message (optional)"
              type="textarea"
              formControlName="message"
              [rows]="2"
              [maxlength]="500"
              placeholder="Tell us what you'd like to book…"
            />

            @if (error()) {
              <div class="cbm-form-err" role="alert">
                <mat-icon>error_outline</mat-icon>
                {{ error() }}
              </div>
            }

            <button type="submit" class="cbm-submit" [disabled]="submitting()">
              @if (submitting()) {
                <span class="cbm-spinner" aria-hidden="true"></span> Submitting…
              } @else {
                <mat-icon>phone_callback</mat-icon> Request Callback
              }
            </button>
          </form>
        }
      </div>
    }
  `,
  styles: [`
    .cbm-backdrop {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(15, 23, 42, .55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      animation: cbm-fade .18s ease;
    }
    @keyframes cbm-fade { from { opacity: 0; } to { opacity: 1; } }

    .cbm-dialog {
      position: fixed; z-index: 1001;
      top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: min(480px, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      overflow-y: auto;
      background: var(--surface, #fff);
      border-radius: var(--r-xl, 20px);
      box-shadow: 0 30px 60px -12px rgba(15, 23, 42, .4);
      animation: cbm-pop .22s cubic-bezier(0, 0, .2, 1);
    }
    @keyframes cbm-pop {
      from { opacity: 0; transform: translate(-50%, -46%) scale(.97); }
      to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    .cbm-grabber { display: none; }

    /* ── Header ── */
    .cbm-head {
      display: flex; align-items: flex-start; gap: .9rem;
      padding: 1.4rem 1.5rem 1rem;
      border-bottom: 1px solid var(--border, #E2E8F0);
    }
    .cbm-badge {
      width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
      background: linear-gradient(135deg, var(--orange, #003399) 0%, var(--orange-dark, #002577) 100%);
      color: #fff; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 6px 16px -4px rgba(0, 71, 204, .45);
    }
    .cbm-head-text h3 { margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text, #0F172A); }
    .cbm-head-text p  { margin: .15rem 0 0; font-size: .85rem; color: var(--text-2, #475569); }
    .cbm-close {
      margin-left: auto; flex-shrink: 0;
      background: none; border: none; cursor: pointer;
      color: var(--muted, #94A3B8); border-radius: 8px; padding: .25rem; line-height: 0;
      transition: background .15s, color .15s;
    }
    .cbm-close:hover { background: var(--bg, #F8F9FF); color: var(--text, #0F172A); }
    .cbm-close:focus-visible { outline: 2px solid var(--indigo, #0047CC); outline-offset: 2px; }

    /* ── Form ── */
    .cbm-form { display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem 1.5rem 1.5rem; }
    .cbm-field { display: flex; flex-direction: column; gap: .4rem; }
    .cbm-label { font-size: .82rem; font-weight: 600; color: var(--text, #0F172A); }

    /* Preferred-time chips */
    .cbm-chips { display: flex; flex-wrap: wrap; gap: .5rem; }
    .cbm-chip {
      display: inline-flex; align-items: center; gap: .35rem;
      padding: .5rem .8rem;
      border: 1px solid var(--border, #E2E8F0); border-radius: var(--r-pill, 999px);
      background: var(--surface, #fff);
      font: inherit; font-size: .82rem; font-weight: 600; color: var(--text-2, #475569);
      cursor: pointer;
      transition: border-color .15s, background .15s, color .15s;
    }
    .cbm-chip mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }
    .cbm-chip:hover { border-color: var(--indigo-mid, #B3CAFF); color: var(--indigo-dark, #003399); }
    .cbm-chip.selected {
      background: var(--indigo-lt, #EEF4FF);
      border-color: var(--indigo, #0047CC);
      color: var(--indigo-dark, #003399);
    }
    .cbm-chip:focus-visible { outline: 2px solid var(--indigo, #0047CC); outline-offset: 2px; }

    /* Error banner */
    .cbm-form-err {
      display: flex; align-items: flex-start; gap: .5rem;
      font-size: .85rem; color: #B91C1C; background: #FEF2F2;
      border: 1px solid #FECACA; border-radius: var(--r, 12px);
      padding: .6rem .8rem;
    }
    .cbm-form-err mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; flex-shrink: 0; }

    /* Submit */
    .cbm-submit {
      margin-top: .2rem; padding: .85rem 1rem;
      display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
      background: linear-gradient(135deg, var(--indigo, #0047CC) 0%, var(--indigo-dark, #003399) 100%);
      color: #fff; border: none; border-radius: var(--r, 12px);
      font: inherit; font-size: .95rem; font-weight: 700; cursor: pointer;
      box-shadow: 0 6px 16px -4px rgba(0, 71, 204, .5);
      transition: filter .15s, opacity .15s;
    }
    .cbm-submit mat-icon { font-size: 1.15rem; width: 1.15rem; height: 1.15rem; }
    .cbm-submit:hover:not(:disabled) { filter: brightness(1.06); }
    .cbm-submit:disabled { opacity: .6; cursor: not-allowed; }
    .cbm-submit:focus-visible { outline: 2px solid var(--indigo-deep, #001B57); outline-offset: 2px; }

    .cbm-spinner {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, .4); border-top-color: #fff;
      animation: cbm-spin .7s linear infinite;
    }
    @keyframes cbm-spin { to { transform: rotate(360deg); } }

    /* Success state */
    .cbm-success { text-align: center; padding: 2rem 1.5rem 1.75rem; }
    .cbm-success-icon {
      width: 72px; height: 72px; margin: 0 auto .75rem;
      border-radius: 50%; background: #F0FDF4;
      display: flex; align-items: center; justify-content: center;
      color: var(--green, #22C55E);
    }
    .cbm-success-icon mat-icon { font-size: 44px; width: 44px; height: 44px; }
    .cbm-success h4 { margin: 0 0 .4rem; font-size: 1.2rem; font-weight: 700; color: var(--text, #0F172A); }
    .cbm-success p  { margin: 0 0 1.25rem; color: var(--text-2, #475569); font-size: .92rem; }
    .cbm-success .cbm-submit { width: 100%; }

    /* ── Mobile: bottom sheet ── */
    @media (max-width: 560px) {
      .cbm-dialog {
        top: auto; left: 0; right: 0; bottom: 0;
        transform: none;
        width: 100%;
        max-height: calc(100dvh - 3rem);
        border-radius: var(--r-xl, 20px) var(--r-xl, 20px) 0 0;
        padding-bottom: env(safe-area-inset-bottom, 0px);
        animation: cbm-slide-up .26s cubic-bezier(0, 0, .2, 1);
      }
      @keyframes cbm-slide-up {
        from { opacity: .6; transform: translateY(40px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .cbm-grabber {
        display: block;
        width: 40px; height: 4px;
        margin: .6rem auto 0;
        border-radius: 999px;
        background: var(--border, #E2E8F0);
      }
      .cbm-head { padding: .9rem 1.25rem 1rem; }
      .cbm-form { padding: 1.1rem 1.25rem 1.35rem; }
      .cbm-chip { flex: 1 1 calc(50% - .25rem); justify-content: center; }
    }

    @media (prefers-reduced-motion: reduce) {
      .cbm-backdrop, .cbm-dialog { animation: none; }
    }
  `],
})
export class CallbackRequestModalComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private callbackApi = inject(CallbackRequestApiService);

  @Output() closed = new EventEmitter<void>();

  isOpen = false;
  @Input() set open(value: boolean) {
    if (value && !this.isOpen) this.reset();
    this.isOpen = value;
    document.body.style.overflow = value ? 'hidden' : '';
  }

  submitting = signal(false);
  done = signal(false);
  error = signal<string | null>(null);

  readonly timeSlots = [
    { value: '', label: 'Any time', icon: 'schedule' },
    { value: 'Morning (9 AM – 12 PM)', label: 'Morning', icon: 'wb_sunny' },
    { value: 'Afternoon (12 – 4 PM)', label: 'Afternoon', icon: 'light_mode' },
    { value: 'Evening (4 – 8 PM)', label: 'Evening', icon: 'wb_twilight' },
  ];

  form = this.fb.group({
    name: [''],
    phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    preferred_time: [''],
    message: [''],
  });

  ngOnDestroy(): void {
    if (this.isOpen) document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) this.requestClose();
  }

  showPhoneError(): boolean {
    const c = this.form.get('phone');
    return !!c && c.touched && c.invalid;
  }

  sanitizePhone(event: Event): void {
    sanitizePhoneInput(event, (v) => this.form.get('phone')?.setValue(v));
  }

  requestClose(): void {
    if (this.submitting()) return;
    this.closed.emit();
  }

  private reset(): void {
    this.form.reset({ name: '', phone: '', preferred_time: '', message: '' });
    this.done.set(false);
    this.error.set(null);
    this.submitting.set(false);
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.error.set(null);
    const v = this.form.value;
    this.callbackApi.create({
      name: v.name?.trim() || undefined,
      phone: v.phone!,
      preferred_time: v.preferred_time || undefined,
      message: v.message?.trim() || undefined,
    }).subscribe({
      next: () => { this.submitting.set(false); this.done.set(true); },
      error: () => {
        this.submitting.set(false);
        this.error.set('Could not submit your request. Please try again or call us directly.');
      },
    });
  }
}
