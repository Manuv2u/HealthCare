import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UserApiService } from '../../../core/api/services/user-api.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorBannerComponent } from '../../../shared/components/error-banner.component';

@Component({
  selector: 'app-profile-edit',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatButtonModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatIconModule, MatSnackBarModule,
    LoadingSpinnerComponent, ErrorBannerComponent,
  ],
  template: `
    <div class="edit-page">

      <!-- Header -->
      <div class="edit-header">
        <button class="back-btn" (click)="goBack()" aria-label="Go back">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="header-text">
          <h1>Edit Profile</h1>
          <p>Update your personal details</p>
        </div>
      </div>

      @if (loading()) {
        <div class="state-center">
          <div class="spinner"></div>
          <span>Loading profile…</span>
        </div>
      } @else if (loadError()) {
        <app-error-banner [message]="loadError()!" retryLabel="Retry" (retry)="load()" />
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()" class="edit-body">

          <!-- Avatar block -->
          <div class="avatar-block">
            <div class="avatar-ring">
              <div class="avatar">{{ initials() }}</div>
            </div>
            <div class="phone-block">
              <div class="phone-row">
                <mat-icon class="phone-icon">smartphone</mat-icon>
                <span class="phone-num">{{ phone() }}</span>
              </div>
              <span class="phone-hint">Phone number cannot be changed</span>
            </div>
          </div>

          <!-- Fields -->
          <div class="fields-section">
            <div class="field-group">
              <label class="field-label">Full Name <span class="req">*</span></label>
              <mat-form-field appearance="outline" class="field">
                <input matInput formControlName="name" placeholder="Your full name" />
                <mat-error>Name is required</mat-error>
              </mat-form-field>
            </div>

            <div class="field-group">
              <label class="field-label">Email Address</label>
              <mat-form-field appearance="outline" class="field">
                <input matInput formControlName="email" type="email" placeholder="you@example.com" />
                <mat-error>Enter a valid email</mat-error>
              </mat-form-field>
            </div>

            <div class="field-row-2">
              <div class="field-group">
                <label class="field-label">Date of Birth</label>
                <mat-form-field appearance="outline" class="field">
                  <input matInput formControlName="date_of_birth" type="date" />
                </mat-form-field>
              </div>

              <div class="field-group">
                <label class="field-label">Gender</label>
                <mat-form-field appearance="outline" class="field">
                  <mat-select formControlName="gender">
                    <mat-option value="">Prefer not to say</mat-option>
                    <mat-option value="male">Male</mat-option>
                    <mat-option value="female">Female</mat-option>
                    <mat-option value="other">Other</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="form-actions">
            <button type="button" class="btn-cancel" (click)="goBack()">Cancel</button>
            <button type="submit" class="btn-save" [disabled]="form.invalid || saving()">
              @if (saving()) {
                <span class="btn-spinner"></span>
                Saving…
              } @else {
                <mat-icon>check</mat-icon>
                Save Changes
              }
            </button>
          </div>

        </form>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .edit-page {
      min-height: 100vh;
      background: #F8F9FF;
      font-family: 'Inter', -apple-system, sans-serif;
    }

    /* ── Header ── */
    .edit-header {
      background: linear-gradient(135deg, #0047CC 0%, #003399 100%);
      color: #fff;
      padding: 1.25rem 1.5rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .back-btn {
      background: rgba(255,255,255,.15);
      border: none;
      color: #fff;
      border-radius: 10px;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: background .15s;
      mat-icon { font-size: 1.2rem; width: 1.2rem; height: 1.2rem; }
      &:hover { background: rgba(255,255,255,.25); }
    }
    .header-text {
      h1 { margin: 0 0 .15rem; font-size: 1.2rem; font-weight: 700; letter-spacing: -.01em; }
      p { margin: 0; font-size: .8rem; opacity: .75; }
    }

    /* ── Loading state ── */
    .state-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: .85rem;
      padding: 4rem 1.5rem;
      color: #94A3B8;
      font-size: .9rem;
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid #E2E8F0;
      border-top-color: #0047CC;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Form body ── */
    .edit-body {
      max-width: 540px;
      margin: 0 auto;
      padding: 1.5rem 1.25rem 3rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* ── Avatar block ── */
    .avatar-block {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      background: #fff;
      border-radius: 16px;
      border: 1px solid #E2E8F0;
      padding: 1.25rem;
      box-shadow: 0 1px 4px rgba(0, 71, 204,.06);
    }
    .avatar-ring {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0047CC, #003399);
      padding: 2.5px;
      flex-shrink: 0;
      box-shadow: 0 4px 14px rgba(0, 71, 204,.35);
    }
    .avatar {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: linear-gradient(135deg, #0047CC, #003399);
      border: 2.5px solid #fff;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -.02em;
      box-sizing: border-box;
    }
    .phone-block {
      display: flex;
      flex-direction: column;
      gap: .25rem;
    }
    .phone-row {
      display: flex;
      align-items: center;
      gap: .4rem;
    }
    .phone-icon {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
      color: #0047CC;
    }
    .phone-num {
      font-size: .95rem;
      font-weight: 600;
      color: #0F172A;
      letter-spacing: .01em;
    }
    .phone-hint {
      font-size: .73rem;
      color: #94A3B8;
    }

    /* ── Fields ── */
    .fields-section {
      background: #fff;
      border-radius: 16px;
      border: 1px solid #E2E8F0;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: .75rem;
      box-shadow: 0 1px 4px rgba(0, 71, 204,.06);
    }
    .field-group {
      display: flex;
      flex-direction: column;
      gap: .35rem;
    }
    .field-label {
      font-size: .78rem;
      font-weight: 600;
      color: #475569;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .req { color: #EF4444; }
    .field { width: 100%; }
    .field-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    /* ── Actions ── */
    .form-actions {
      display: flex;
      gap: .75rem;
      align-items: center;
    }
    .btn-cancel {
      flex: 0 0 auto;
      height: 48px;
      padding: 0 1.25rem;
      border-radius: 999px;
      border: 1.5px solid #E2E8F0;
      background: #fff;
      color: #475569;
      font-size: .9rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: border-color .15s, color .15s;
      &:hover { border-color: #0047CC; color: #0047CC; }
    }
    .btn-save {
      flex: 1;
      height: 48px;
      border-radius: 999px;
      border: none;
      background: linear-gradient(135deg, #0047CC, #003399);
      color: #fff;
      font-size: .95rem;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .45rem;
      transition: opacity .15s, transform .1s;
      box-shadow: 0 4px 14px rgba(0, 71, 204,.35);
      mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; }
      &:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
      &:disabled { opacity: .55; cursor: not-allowed; transform: none; box-shadow: none; }
    }
    .btn-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @media (max-width: 600px) {
      .field-row-2 { grid-template-columns: 1fr; }
      .edit-body { padding: 1.25rem 1rem 3rem; }
    }
  `],
})
export class ProfileEditComponent implements OnInit {
  loading = signal(true);
  saving = signal(false);
  loadError = signal<string | null>(null);
  phone = signal('');
  initials = signal('U');

  form = this.fb.group({
    name:          ['', Validators.required],
    email:         ['', Validators.email],
    date_of_birth: [''],
    gender:        [''],
  });

  constructor(
    private fb: FormBuilder,
    private userApi: UserApiService,
    private authState: AuthStateService,
    private router: Router,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.userApi.getProfile().subscribe({
      next: (user) => {
        this.phone.set(user.phone ?? '');
        const name = user.name ?? '';
        this.initials.set(name ? name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) : 'U');
        this.form.patchValue({
          name:          user.name ?? '',
          email:         user.email ?? '',
          date_of_birth: user.date_of_birth ?? '',
          gender:        user.gender ?? '',
        });
        this.loading.set(false);
      },
      error: () => { this.loadError.set('Failed to load profile.'); this.loading.set(false); },
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.userApi.updateProfile(this.form.value as object).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.authState.setUser({
          id:    this.authState.currentUser()?.id ?? '',
          name:  updated.name,
          role:  (updated.role as 'user' | 'admin' | 'technician'),
          phone: updated.phone,
          email: updated.email,
        });
        this.snack.open('Profile updated successfully.', 'OK', { duration: 3000 });
        this.router.navigate(['/profile']);
      },
      error: () => { this.snack.open('Failed to update profile.', 'OK', { duration: 3000 }); this.saving.set(false); },
    });
  }

  goBack(): void { this.router.navigate(['/profile']); }
}
