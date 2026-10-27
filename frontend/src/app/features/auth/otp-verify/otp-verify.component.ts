import { Component, inject, signal, OnInit, ViewChildren, QueryList, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthApiService } from '../../../core/api/services/auth-api.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';

@Component({
  selector: 'app-otp-verify',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatIconModule],
  template: `
    <div class="auth-shell">
      <a routerLink="/" class="auth-back" aria-label="Back to home">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        <span>Home</span>
      </a>

      <div class="auth-bg" aria-hidden="true">
        <span class="blob blob--1"></span>
        <span class="blob blob--2"></span>
        <span class="blob blob--3"></span>
      </div>

      <div class="auth-stage">
        <!-- ── Showcase ── -->
        <section class="auth-showcase">
          <a routerLink="/" class="brand" aria-label="Sri Health Plus home">
            <span class="brand-logo"><img src="assets/logo-mark.png" alt="" /></span>
            <span class="brand-text">
              <span class="brand-name">Sri Health Plus</span>
              <span class="brand-tag">Diagnostic Laboratory</span>
            </span>
          </a>

          <div class="showcase-body">
            <span class="eyebrow">One-time verification</span>
            <h1 class="showcase-title">Just one step<br/><span class="grad">to keep it secure.</span></h1>
            <p class="showcase-sub">
              We've sent a 6-digit code to your phone. Enter it to confirm it's really you —
              codes expire quickly for your safety.
            </p>

            <ul class="trust-list">
              <li class="trust-chip trust-chip--blue">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></i>
                SMS Verification
              </li>
              <li class="trust-chip trust-chip--emerald">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></i>
                Instant Access
              </li>
              <li class="trust-chip trust-chip--cyan">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></i>
                Secure Login
              </li>
              <li class="trust-chip trust-chip--violet">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></i>
                One-Time Code
              </li>
            </ul>
          </div>
        </section>

        <!-- ── Panel ── -->
        <section class="auth-panel-wrap">
          <div class="auth-panel">
            <a routerLink="/" class="panel-brand">
              <span class="brand-logo"><img src="assets/logo-mark.png" alt="" /></span>
              <span class="brand-name">Sri Health Plus</span>
            </a>

            <div class="panel-badge panel-badge--emerald">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
            </div>

            <div class="panel-head">
              <h2 class="panel-title">Verify your phone</h2>
              <p class="panel-sub">Enter the 6-digit code sent to<br/><strong>+91 {{ maskedPhone() }}</strong></p>
            </div>

            @if (error()) {
              <div class="alert alert--error" role="alert">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <span>{{ error() }}</span>
                <button type="button" class="alert-x" aria-label="Dismiss" (click)="error.set(null)">&times;</button>
              </div>
            }

            @if (resendSuccess()) {
              <div class="alert alert--success" role="status">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>OTP sent successfully!</span>
                <button type="button" class="alert-x" aria-label="Dismiss" (click)="resendSuccess.set(false)">&times;</button>
              </div>
            }

            <form (ngSubmit)="verifyOtp()" class="auth-form">
              <div class="otp-inputs" role="group" aria-label="One-time code">
                @for (i of [0,1,2,3,4,5]; track i) {
                  <input
                    #otpInput
                    type="text"
                    inputmode="numeric"
                    maxlength="1"
                    class="otp-box"
                    [class.is-filled]="otpDigits[i]"
                    [class.is-error]="error()"
                    [(ngModel)]="otpDigits[i]"
                    [name]="'otp' + i"
                    [attr.aria-label]="'Digit ' + (i + 1)"
                    (input)="onInput($event, i)"
                    (keydown)="onKeyDown($event, i)"
                    (paste)="onPaste($event)"
                    autocomplete="one-time-code"
                  />
                }
              </div>

              <button type="submit" class="btn btn-primary" [disabled]="loading() || !isOtpComplete()">
                @if (loading()) {
                  <svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  <span>Verifying…</span>
                } @else {
                  <span>Verify &amp; Continue</span>
                  <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                }
              </button>
            </form>

            <div class="resend">
              @if (resendTimer() > 0) {
                <p class="resend-text">Resend code in <strong>{{ formatTime(resendTimer()) }}</strong></p>
              } @else {
                <p class="resend-text">
                  Didn't receive the code?
                  <button type="button" class="link resend-btn" [disabled]="resendLoading()" (click)="resendOtp()">
                    {{ resendLoading() ? 'Sending…' : 'Resend OTP' }}
                  </button>
                </p>
              }
            </div>

            <div class="divider"><span></span></div>

            <div class="auth-alt" style="margin-top:0">
              <a routerLink="/auth/login" class="back-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                Back to sign in
              </a>
            </div>
          </div>

          <p class="panel-legal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Never share your OTP with anyone
          </p>
        </section>
      </div>
    </div>
  `,
  styleUrls: ['../auth-theme.scss'],
  styles: [`
    .otp-inputs { display: flex; justify-content: center; gap: 8px; }
    @media (min-width: 400px) { .otp-inputs { gap: 11px; } }
    .otp-box {
      width: 48px;
      height: 58px;
      padding: 0;
      border: 1.5px solid var(--line);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.75);
      font: 800 24px/1 var(--font-display);
      text-align: center;
      color: var(--ink);
      transition: border-color .18s, box-shadow .18s, background .18s, transform .18s;
    }
    @media (min-width: 400px) { .otp-box { width: 54px; height: 62px; } }
    .otp-box:focus {
      outline: none;
      border-color: var(--brand);
      background: #fff;
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.13);
      transform: translateY(-1px);
    }
    .otp-box.is-filled { border-color: var(--brand); background: var(--brand-soft); color: var(--brand-strong); }
    .otp-box.is-error { border-color: var(--error); animation: otpShake 0.3s ease-in-out; }
    @keyframes otpShake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }
    .resend { text-align: center; margin-top: 18px; }
    .resend-text { font-size: 14px; color: var(--ink-2); margin: 0; }
    .resend-text strong { color: var(--brand-strong); font-weight: 700; }
    .resend-btn { background: none; border: none; padding: 0; margin-left: 4px; cursor: pointer; }
    .resend-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    @media (prefers-reduced-motion: reduce) { .otp-box { transition: none; } .otp-box.is-error { animation: none; } }
  `]
})
export class OtpVerifyComponent implements OnInit, AfterViewInit {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authApi = inject(AuthApiService);
  private authState = inject(AuthStateService);

  currentYear = new Date().getFullYear();
  phone = '';
  type = 'login';
  name?: string;

  otpDigits: string[] = ['', '', '', '', '', ''];

  loading = signal(false);
  resendLoading = signal(false);
  error = signal<string | null>(null);
  resendSuccess = signal(false);
  resendTimer = signal(30);

  private timerInterval?: any;

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.phone = params['phone'] || '';
      this.type = params['type'] || 'login';
      this.name = params['name'];

      if (!this.phone) {
        this.router.navigate(['/auth/login']);
      }
    });

    this.startTimer();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.otpInputs.first?.nativeElement.focus();
    }, 100);
  }

  maskedPhone(): string {
    if (!this.phone) return '';
    return this.phone.substring(0, 2) + '****' + this.phone.substring(6);
  }

  isOtpComplete(): boolean {
    return this.otpDigits.every(d => d !== '');
  }

  getOtp(): string {
    return this.otpDigits.join('');
  }

  onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');

    if (value.length > 0) {
      this.otpDigits[index] = value[0];
      input.value = value[0];

      if (index < 5) {
        const inputs = this.otpInputs.toArray();
        inputs[index + 1]?.nativeElement.focus();
      }
    }
  }

  onKeyDown(event: KeyboardEvent, index: number): void {
    const inputs = this.otpInputs.toArray();

    if (event.key === 'Backspace') {
      if (!this.otpDigits[index] && index > 0) {
        inputs[index - 1]?.nativeElement.focus();
      }
      this.otpDigits[index] = '';
    } else if (event.key === 'ArrowLeft' && index > 0) {
      inputs[index - 1]?.nativeElement.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      inputs[index + 1]?.nativeElement.focus();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text').replace(/\D/g, '').substring(0, 6);

    if (pastedData) {
      for (let i = 0; i < pastedData.length && i < 6; i++) {
        this.otpDigits[i] = pastedData[i];
      }

      const inputs = this.otpInputs.toArray();
      const focusIndex = Math.min(pastedData.length, 5);
      inputs[focusIndex]?.nativeElement.focus();
    }
  }

  startTimer(): void {
    this.resendTimer.set(30);
    clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      const current = this.resendTimer();
      if (current > 0) {
        this.resendTimer.set(current - 1);
      } else {
        clearInterval(this.timerInterval);
      }
    }, 1000);
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs.toString().padStart(2, '0')}`;
  }

  verifyOtp(): void {
    if (!this.isOtpComplete()) return;

    this.loading.set(true);
    this.error.set(null);

    this.authApi.verifyOtp(this.phone, this.getOtp(), this.name).subscribe({
      next: (tokens) => {
        this.authState.setTokens(tokens.access_token, tokens.refresh_token);
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        let errorMessage = 'Invalid OTP. Please try again.';
        if (err.error) {
          if (typeof err.error === 'string') {
            errorMessage = err.error;
          } else if (err.error.detail) {
            errorMessage = typeof err.error.detail === 'string'
              ? err.error.detail
              : JSON.stringify(err.error.detail);
          } else if (err.error.message) {
            errorMessage = err.error.message;
          }
        }
        this.error.set(errorMessage);
        this.otpDigits = ['', '', '', '', '', ''];
        this.otpInputs.first?.nativeElement.focus();
      }
    });
  }

  resendOtp(): void {
    this.resendLoading.set(true);
    this.error.set(null);

    this.authApi.loginOtp(this.phone).subscribe({
      next: () => {
        this.resendLoading.set(false);
        this.resendSuccess.set(true);
        this.startTimer();
        setTimeout(() => this.resendSuccess.set(false), 3000);
      },
      error: (err) => {
        this.resendLoading.set(false);
        let errorMessage = 'Failed to resend OTP.';
        if (err.error) {
          if (typeof err.error === 'string') {
            errorMessage = err.error;
          } else if (err.error.detail) {
            errorMessage = typeof err.error.detail === 'string'
              ? err.error.detail
              : JSON.stringify(err.error.detail);
          } else if (err.error.message) {
            errorMessage = err.error.message;
          }
        }
        this.error.set(errorMessage);
      }
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.timerInterval);
  }
}
