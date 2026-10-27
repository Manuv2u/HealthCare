import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthApiService } from '../../../core/api/services/auth-api.service';
import { sanitizePhoneInput } from '../../../core/utils/phone.util';

type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

@Component({
  selector: 'app-register',
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
            <span class="eyebrow">Join 50,000+ patients</span>
            <h1 class="showcase-title">Start your<br/><span class="grad">health journey today.</span></h1>
            <p class="showcase-sub">
              Create a free account to book tests, store digital reports and manage your
              family's health — securely, from anywhere.
            </p>

            <ul class="trust-list">
              <li class="trust-chip trust-chip--blue">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></i>
                Easy Online Booking
              </li>
              <li class="trust-chip trust-chip--emerald">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></i>
                Digital Health Records
              </li>
              <li class="trust-chip trust-chip--violet">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></svg></i>
                Family Health Profiles
              </li>
              <li class="trust-chip trust-chip--cyan">
                <i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></i>
                24/7 Support
              </li>
            </ul>
          </div>

          <div class="stat-row">
            <div class="stat"><b>NABL</b><span>Certified labs</span></div>
            <div class="stat-div"></div>
            <div class="stat"><b>Free</b><span>Home collection</span></div>
            <div class="stat-div"></div>
            <div class="stat"><b>24-48h</b><span>Fast reports</span></div>
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
              <p class="panel-eyebrow">Get started</p>
              <h2 class="panel-title">Create your account</h2>
              <p class="panel-sub">It only takes a minute — no charges to sign up.</p>
            </div>

            @if (error()) {
              <div class="alert alert--error" role="alert">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <span>{{ error() }}</span>
                <button type="button" class="alert-x" aria-label="Dismiss" (click)="error.set(null)">&times;</button>
              </div>
            }

            <form [formGroup]="registerForm" (ngSubmit)="register()" class="auth-form" novalidate>
              <div class="field" [class.field--invalid]="registerForm.get('name')?.invalid && registerForm.get('name')?.touched">
                <div class="field-control">
                  <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <input id="name" type="text" formControlName="name" placeholder=" " autocomplete="name" />
                  <label for="name">Full name</label>
                </div>
                @if (registerForm.get('name')?.invalid && registerForm.get('name')?.touched) {
                  <p class="field-msg field-msg--error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{{ getNameError() }}</p>
                }
              </div>

              <div class="field" [class.field--invalid]="registerForm.get('phone')?.invalid && registerForm.get('phone')?.touched">
                <div class="field-control">
                  <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  <input id="phone" type="tel" formControlName="phone" placeholder=" " autocomplete="tel" inputmode="numeric" (input)="sanitizePhone($event)" />
                  <label for="phone">Phone number</label>
                </div>
                @if (registerForm.get('phone')?.invalid && registerForm.get('phone')?.touched) {
                  <p class="field-msg field-msg--error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Please enter a valid 10-digit phone number</p>
                }
              </div>

              <div class="field" [class.field--invalid]="registerForm.get('email')?.invalid && registerForm.get('email')?.touched">
                <div class="field-control">
                  <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg>
                  <input id="email" type="email" formControlName="email" placeholder=" " autocomplete="email" />
                  <label for="email">Email address</label>
                </div>
                @if (registerForm.get('email')?.invalid && registerForm.get('email')?.touched) {
                  <p class="field-msg field-msg--error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Please enter a valid email address</p>
                }
              </div>

              <div class="field" [class.field--invalid]="registerForm.get('password')?.invalid && registerForm.get('password')?.touched">
                <div class="field-control">
                  <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  <input id="password" [type]="showPassword() ? 'text' : 'password'" formControlName="password" placeholder=" " autocomplete="new-password" (input)="onPasswordInput($event)" />
                  <label for="password">Password</label>
                  <button type="button" class="field-eye" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'" (click)="showPassword.set(!showPassword())">
                    @if (showPassword()) {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    } @else {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                @if (passwordValue()) {
                  <div class="strength">
                    <div class="strength-bar"><div class="strength-fill" [class]="'is-' + passwordStrength()"></div></div>
                    <span class="strength-text" [class]="'is-' + passwordStrength()">{{ passwordStrengthText() }}</span>
                  </div>
                }
                @if (registerForm.get('password')?.invalid && registerForm.get('password')?.touched) {
                  <p class="field-msg field-msg--error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{{ getPasswordError() }}</p>
                }
              </div>

              <div class="field" [class.field--invalid]="registerForm.get('confirmPassword')?.hasError('mismatch') && registerForm.get('confirmPassword')?.touched">
                <div class="field-control">
                  <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  <input id="confirmPassword" type="password" formControlName="confirmPassword" placeholder=" " autocomplete="new-password" />
                  <label for="confirmPassword">Confirm password</label>
                </div>
                @if (registerForm.get('confirmPassword')?.hasError('mismatch') && registerForm.get('confirmPassword')?.touched) {
                  <p class="field-msg field-msg--error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Passwords do not match</p>
                }
              </div>

              <div class="field field--check" [class.field--invalid]="registerForm.get('acceptTerms')?.invalid && registerForm.get('acceptTerms')?.touched">
                <label class="check">
                  <input type="checkbox" formControlName="acceptTerms" required />
                  <span>I agree to the <a routerLink="/terms-of-service" target="_blank" rel="noopener">Terms of Service</a> and <a routerLink="/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a></span>
                </label>
                @if (registerForm.get('acceptTerms')?.invalid && registerForm.get('acceptTerms')?.touched) {
                  <p class="field-msg field-msg--error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Please accept the Terms of Service and Privacy Policy.</p>
                }
              </div>

              <button type="submit" class="btn btn-primary" [disabled]="loading() || registerForm.invalid">
                @if (loading()) {
                  <svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  <span>Creating account…</span>
                } @else {
                  <span>Create Account</span>
                  <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                }
              </button>
            </form>

            <div class="auth-alt">
              Already have an account?<a routerLink="/auth/login">Sign in</a>
            </div>
          </div>

          <p class="panel-legal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Your information is protected &amp; never shared
          </p>
        </section>
      </div>
    </div>
  `,
  styleUrls: ['../auth-theme.scss'],
  styles: [`
    .strength { margin-top: 2px; display: flex; flex-direction: column; gap: 5px; }
    .strength-bar { height: 5px; background: #E5E7EB; border-radius: 999px; overflow: hidden; }
    .strength-fill { height: 100%; border-radius: 999px; width: 25%; transition: width .3s var(--ease), background .3s; }
    .strength-fill.is-weak   { width: 25%;  background: #EF4444; }
    .strength-fill.is-fair   { width: 50%;  background: #F59E0B; }
    .strength-fill.is-good   { width: 75%;  background: #06B6D4; }
    .strength-fill.is-strong { width: 100%; background: #22C55E; }
    .strength-text { font-size: 12px; font-weight: 600; }
    .strength-text.is-weak   { color: #EF4444; }
    .strength-text.is-fair   { color: #D97706; }
    .strength-text.is-good   { color: #0891B2; }
    .strength-text.is-strong { color: #16A34A; }
  `]
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authApi = inject(AuthApiService);

  currentYear = new Date().getFullYear();
  loading = signal(false);
  error = signal<string | null>(null);
  passwordValue = signal('');
  showPassword = signal(false);

  registerForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), this.passwordStrengthValidator]],
    confirmPassword: ['', Validators.required],
    acceptTerms: [false, Validators.requiredTrue]
  }, {
    validators: this.passwordMatchValidator
  });

  // Computed password strength
  passwordStrength = computed<PasswordStrength>(() => {
    const password = this.passwordValue();
    if (!password) return 'weak';

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return 'weak';
    if (score <= 3) return 'fair';
    if (score <= 4) return 'good';
    return 'strong';
  });

  passwordStrengthText = computed(() => {
    const strength = this.passwordStrength();
    const texts: Record<PasswordStrength, string> = {
      weak: 'Weak - Add more characters',
      fair: 'Fair - Add numbers or symbols',
      good: 'Good - Almost there!',
      strong: 'Strong - Great password!'
    };
    return texts[strength];
  });

  passwordStrengthValidator(control: AbstractControl): { [key: string]: boolean } | null {
    const value = control.value;
    if (!value) return null;
    const hasNumber = /\d/.test(value);
    if (!hasNumber) return { noNumber: true };
    return null;
  }

  passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    if (password && confirmPassword && password !== confirmPassword) {
      group.get('confirmPassword')?.setErrors({ mismatch: true });
      return { mismatch: true };
    }
    return null;
  }

  onPasswordInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.passwordValue.set(input.value);
  }

  sanitizePhone(event: Event): void {
    sanitizePhoneInput(event, (v) => this.registerForm.get('phone')?.setValue(v));
  }

  getPasswordError(): string {
    const control = this.registerForm.get('password');
    if (control?.hasError('required')) return 'Password is required';
    if (control?.hasError('minlength')) return 'Password must be at least 8 characters';
    if (control?.hasError('noNumber')) return 'Password must contain at least one number';
    return 'Invalid password';
  }

  getNameError(): string {
    const control = this.registerForm.get('name');
    if (control?.hasError('required')) return 'Full name is required';
    if (control?.hasError('minlength')) return 'Name must be at least 2 characters';
    return 'Invalid name';
  }

  register(): void {
    if (this.registerForm.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    const { name, phone, email, password } = this.registerForm.value;

    this.authApi.register(name!, phone!, email!, password!).subscribe({
      next: (result) => {
        this.loading.set(false);
        this.router.navigate(['/auth/verify-email'], { queryParams: { email: result.email } });
      },
      error: (err) => {
        this.loading.set(false);
        const errorMessage = err.status === 409
          ? 'This phone number or email is already registered. Please use a different one or sign in.'
          : this.friendlyError(err, 'Registration failed. Please try again.');
        this.error.set(errorMessage);
      }
    });
  }

  /** Turn a FastAPI/Pydantic error response into a human-readable message. */
  private friendlyError(err: any, fallback: string): string {
    const detail = err?.error?.detail;

    // Pydantic 422: detail is an array of { loc, msg, ... }
    if (Array.isArray(detail) && detail.length) {
      const first = detail[0];
      if (first?.msg) {
        const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : '';
        const msg = String(first.msg).replace(/^Value error,\s*/i, '').trim();
        const label = this.fieldLabel(field);
        const clean = msg.charAt(0).toUpperCase() + msg.slice(1);
        return label ? `${label}: ${clean}` : clean;
      }
    }
    // Custom HTTPException: detail is { error_code, message }
    if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
      return detail.message;
    }
    if (typeof detail === 'string') return detail;
    if (typeof err?.error?.message === 'string') return err.error.message;
    if (typeof err?.error === 'string') return err.error;
    return fallback;
  }

  private fieldLabel(field: string): string {
    const map: Record<string, string> = {
      email: 'Email', phone: 'Phone number', name: 'Full name', password: 'Password',
    };
    return map[field] || '';
  }
}
