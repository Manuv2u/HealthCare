import { Component, inject, signal, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthApiService } from '../../../core/api/services/auth-api.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { sanitizeIdentifierInput } from '../../../core/utils/phone.util';

type AuthMode = 'phone' | 'password';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, MatIconModule],
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
            <span class="eyebrow">Trusted Diagnostic Partner</span>
            <h1 class="showcase-title">Your health,<br/><span class="grad">in expert hands.</span></h1>
            <p class="showcase-sub">
              Book lab tests, track reports and manage appointments — all in one secure,
              beautifully simple place.
            </p>

            <ul class="trust-list">
              <li class="trust-chip trust-chip--emerald">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></i>
                NABL Certified Labs
              </li>
              <li class="trust-chip trust-chip--blue">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></i>
                Secure &amp; Encrypted
              </li>
              <li class="trust-chip trust-chip--cyan">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg></i>
                Reports in 24-48h
              </li>
              <li class="trust-chip trust-chip--violet">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></i>
                Home Sample Collection
              </li>
            </ul>
          </div>

          <div class="stat-row">
            <div class="stat"><b>50,000+</b><span>Happy patients</span></div>
            <div class="stat-div"></div>
            <div class="stat"><b>200+</b><span>Lab tests</span></div>
            <div class="stat-div"></div>
            <div class="stat"><b>4.9★</b><span>Avg. rating</span></div>
          </div>
        </section>

        <!-- ── Panel ── -->
        <section class="auth-panel-wrap">
          <div class="auth-panel">
            <a routerLink="/" class="panel-brand">
              <span class="brand-logo"><img src="assets/logo-mark.png" alt="" /></span>
              <span class="brand-name">Sri Health Plus</span>
            </a>

            <div class="panel-head">
              <p class="panel-eyebrow">Welcome back</p>
              <h2 class="panel-title">Sign in to your account</h2>
              <p class="panel-sub">Access your health dashboard and reports.</p>
            </div>

            <!-- OTP_LOGIN_DISABLED: Phone-OTP sign-in is turned off for now (password-only).
                 Flip otpLoginEnabled back to true to restore the mode switcher + phone form below. -->
            @if (otpLoginEnabled) {
              <div class="seg" role="tablist" aria-label="Sign-in method">
                <button type="button" role="tab" class="seg-btn" [class.is-active]="mode() === 'password'"
                  [attr.aria-selected]="mode() === 'password'" (click)="setMode('password')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  Password
                </button>
                <button type="button" role="tab" class="seg-btn" [class.is-active]="mode() === 'phone'"
                  [attr.aria-selected]="mode() === 'phone'" (click)="setMode('phone')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  Phone OTP
                </button>
              </div>
            }

            @if (error()) {
              <div class="alert alert--error" role="alert">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <span>
                  {{ error() }}
                  @if (unverifiedEmail()) {
                    <a [routerLink]="['/auth/verify-email']" [queryParams]="{ email: unverifiedEmail() }" class="link">Verify now</a>
                  }
                </span>
                <button type="button" class="alert-x" aria-label="Dismiss" (click)="error.set(null)">&times;</button>
              </div>
            }

            @if (mode() === 'password') {
              <form [formGroup]="passwordForm" (ngSubmit)="loginWithPassword()" class="auth-form" novalidate role="tabpanel">
                <div class="field">
                  <div class="field-control">
                    <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg>
                    <input id="identifier" type="text" formControlName="identifier" placeholder=" " autocomplete="username" (input)="sanitizeIdentifier($event)" />
                    <label for="identifier">Email or phone number</label>
                  </div>
                </div>

                <div class="field">
                  <div class="field-control">
                    <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    <input id="password" [type]="showPassword() ? 'text' : 'password'" formControlName="password" placeholder=" " autocomplete="current-password" />
                    <label for="password">Password</label>
                    <button type="button" class="field-eye" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'" (click)="showPassword.set(!showPassword())">
                      @if (showPassword()) {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      } @else {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>

                <div class="form-row">
                  <label class="check">
                    <input type="checkbox" [checked]="rememberMe()" (change)="toggleRememberMe()" />
                    <span>Remember me</span>
                  </label>
                  <a routerLink="/auth/forgot-password" class="link">Forgot password?</a>
                </div>

                <button type="submit" class="btn btn-primary" [disabled]="loading() || passwordForm.invalid">
                  @if (loading()) {
                    <svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  } @else {
                    <span>Sign In</span>
                    <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  }
                </button>
              </form>
            }

            @if (otpLoginEnabled && mode() === 'phone') {
              <form [formGroup]="phoneForm" (ngSubmit)="sendOtp()" class="auth-form" novalidate role="tabpanel">
                <div class="field">
                  <div class="field-control">
                    <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                    <input id="phone" type="tel" formControlName="phone" placeholder=" " autocomplete="tel" inputmode="numeric" />
                    <label for="phone">10-digit phone number</label>
                  </div>
                </div>

                <button type="submit" class="btn btn-primary" [disabled]="loading() || phoneForm.invalid">
                  @if (loading()) {
                    <svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  } @else {
                    <span>Send OTP</span>
                    <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  }
                </button>
              </form>
            }

            <div class="divider"><span>coming soon</span></div>

            <div class="social-row">
              <button type="button" class="btn-social" disabled title="Available soon">
                <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/><path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 010-4.22V7.05H2.18a11 11 0 000 9.9l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/></svg>
                Google
              </button>
              <button type="button" class="btn-social" disabled title="Available soon">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.36 12.7c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.75 2.28-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.29 1.15-.05 1.58-.74 2.97-.74 1.39 0 1.78.74 3 .72 1.24-.02 2.02-1.12 2.78-2.23.88-1.28 1.24-2.52 1.26-2.58-.03-.01-2.41-.93-2.43-3.68zM14.06 5.9c.64-.78 1.07-1.86.95-2.94-.92.04-2.04.61-2.7 1.39-.59.69-1.11 1.79-.97 2.85 1.03.08 2.08-.52 2.72-1.3z"/></svg>
                Apple
              </button>
            </div>

            <div class="auth-alt">
              Don't have an account?<a routerLink="/auth/register">Create account</a>
            </div>
          </div>

          <p class="panel-legal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            256-bit encrypted • Your data stays private
          </p>

          <p class="auth-legal-links">
            <a routerLink="/privacy-policy">Privacy Policy</a>
            <span aria-hidden="true">|</span>
            <a routerLink="/terms-of-service">Terms of Service</a>
          </p>
        </section>
      </div>
    </div>
  `,
  styleUrls: ['../auth-theme.scss'],
  styles: [`
    .auth-legal-links {
      display: flex; align-items: center; justify-content: center; gap: .55rem;
      margin: .5rem 0 0; font-size: .78rem; color: #94A3B8;
    }
    .auth-legal-links a { color: #64748B; font-weight: 600; text-decoration: none; }
    .auth-legal-links a:hover { color: #0047CC; text-decoration: underline; }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authApi = inject(AuthApiService);
  private authState = inject(AuthStateService);
  private ngZone = inject(NgZone);

  currentYear = new Date().getFullYear();
  /** OTP_LOGIN_DISABLED: password-only for now. Flip to true (and the two
   * template @if guards above) to bring back Phone-OTP sign-in. */
  readonly otpLoginEnabled = false;
  mode = signal<AuthMode>('password');
  loading = signal(false);
  error = signal<string | null>(null);
  rememberMe = signal(false);
  showPassword = signal(false);
  unverifiedEmail = signal<string | null>(null);

  phoneForm = this.fb.group({
    phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]]
  });

  passwordForm = this.fb.group({
    identifier: ['', Validators.required],
    password: ['', Validators.required]
  });

  sanitizeIdentifier(event: Event): void {
    sanitizeIdentifierInput(event, (v) => this.passwordForm.get('identifier')?.setValue(v));
  }

  setMode(newMode: AuthMode): void {
    this.mode.set(newMode);
    this.error.set(null);
  }

  toggleRememberMe(): void {
    this.rememberMe.update(v => !v);
  }

  sendOtp(): void {
    if (this.phoneForm.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    const phone = this.phoneForm.value.phone!;

    this.authApi.loginOtp(phone).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/auth/verify-otp'], {
          queryParams: { phone, type: 'login' }
        });
      },
      error: (err) => {
        this.loading.set(false);
        // Handle different error response formats
        let errorMessage = 'Failed to send OTP. Please try again.';
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

  loginWithPassword(): void {
    if (this.passwordForm.invalid) return;

    this.loading.set(true);
    this.error.set(null);
    this.unverifiedEmail.set(null);

    const { identifier, password } = this.passwordForm.value;

    this.authApi.login(identifier!, password!).subscribe({
      next: (tokens) => {
        this.authState.setTokens(tokens.access_token, tokens.refresh_token, !!tokens.is_temp_password);
        this.loading.set(false);

        // Use NgZone.run to ensure navigation happens inside Angular's zone
        // and use navigateByUrl for more reliable full URL navigation
        this.ngZone.run(() => {
          // Force password change on first login with a temporary password
          if (tokens.is_temp_password) {
            this.router.navigateByUrl('/auth/change-password?firstLogin=1', { replaceUrl: true });
            return;
          }
          const role = this.authState.role();
          let targetUrl = '/dashboard';
          if (role === 'admin') {
            targetUrl = '/admin/dashboard';
          } else if (role === 'technician') {
            targetUrl = '/technician';
          }
          // Use navigateByUrl with replaceUrl to ensure clean navigation
          this.router.navigateByUrl(targetUrl, { replaceUrl: true });
        });
      },
      error: (err) => {
        this.loading.set(false);
        // Handle different error response formats
        let errorMessage = 'Invalid credentials. Please try again.';
        if (err.error) {
          if (typeof err.error === 'string') {
            errorMessage = err.error;
          } else if (err.error.detail?.message) {
            errorMessage = err.error.detail.message;
          } else if (typeof err.error.detail === 'string') {
            errorMessage = err.error.detail;
          } else if (err.error.detail) {
            errorMessage = JSON.stringify(err.error.detail);
          } else if (err.error.message) {
            errorMessage = err.error.message;
          }
        }
        this.error.set(errorMessage);

        if (err.error?.detail?.error_code === 'EMAIL_NOT_VERIFIED' && identifier?.includes('@')) {
          this.unverifiedEmail.set(identifier);
        }
      }
    });
  }
}
