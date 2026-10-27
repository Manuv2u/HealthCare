import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UserApiService } from '../../../core/api/services/user-api.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { User } from '../../../core/api/api.types';
import {
  ButtonComponent,
  CardComponent,
  InputComponent,
  AlertComponent,
  SpinnerComponent,
  AvatarComponent,
  ModalComponent,
  BadgeComponent,
} from '../../../shared/components';
import { dobValidator, todayDateStr } from '../../../core/utils/dob-validator';

@Component({
  selector: 'app-profile-new',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonComponent,
    CardComponent,
    InputComponent,
    AlertComponent,
    SpinnerComponent,
    AvatarComponent,
    ModalComponent,
    BadgeComponent,
  ],
  template: `
    <div class="profile-page">
      <!-- Page Header -->
      <header class="page-header">
        <div class="header-content">
          <h1 class="page-title">My Profile</h1>
          <p class="page-subtitle">Manage your personal information and account settings</p>
        </div>
      </header>

      <!-- Loading State -->
      @if (loading()) {
        <div class="loading-container">
          <app-spinner size="lg" />
          <p>Loading your profile...</p>
        </div>
      }

      <!-- Error State -->
      @if (error()) {
        <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">
          {{ error() }}
        </app-alert>
      }

      <!-- Profile Content -->
      @if (!loading() && user()) {
        <div class="profile-layout">
          <!-- Profile Card -->
          <section class="profile-card">
            <div class="profile-header">
              <div class="avatar-section">
                <app-avatar 
                  [name]="user()!.name" 
                  size="2xl"
                  status="online"
                />
                <div class="profile-info">
                  <h2 class="user-name">{{ user()!.name }}</h2>
                  <p class="user-role">
                    <app-badge [color]="getRoleBadgeColor(user()!.role)">
                      {{ formatRole(user()!.role) }}
                    </app-badge>
                  </p>
                  <p class="member-since">Member since {{ formatDate(user()!.created_at) }}</p>
                </div>
              </div>
              
              <div class="profile-actions">
                @if (!isEditing() && !isAdmin()) {
                  <app-button variant="primary" (click)="startEditing()">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit Profile
                  </app-button>
                }
              </div>
            </div>

            <!-- View Mode -->
            @if (!isEditing()) {
              <div class="profile-details">
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="detail-label">Full Name</span>
                    <span class="detail-value">{{ user()!.name }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Phone Number</span>
                    <span class="detail-value">{{ user()!.phone || 'Not provided' }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Email Address</span>
                    <span class="detail-value">{{ user()!.email || 'Not provided' }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Date of Birth</span>
                    <span class="detail-value">{{ user()!.date_of_birth ? formatDate(user()!.date_of_birth!) : 'Not provided' }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Gender</span>
                    <span class="detail-value">{{ formatGender(user()!.gender) }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Account Status</span>
                    <span class="detail-value">
                      <app-badge [color]="user()!.is_active ? 'success' : 'error'">
                        {{ user()!.is_active ? 'Active' : 'Inactive' }}
                      </app-badge>
                    </span>
                  </div>
                </div>
              </div>
            }

            <!-- Edit Mode -->
            @if (isEditing() && !isAdmin()) {
              <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" class="edit-form">
                <div class="form-grid">
                  <app-input
                    label="Full Name"
                    size="lg"
                    formControlName="name"
                    placeholder="Enter your full name"
                    [error]="getFieldError('name')"
                  />
                  <app-input
                    label="Phone Number"
                    size="lg"
                    formControlName="phone"
                    placeholder="Enter your phone number"
                    [error]="getFieldError('phone')"
                  />
                  <app-input
                    label="Email Address"
                    size="lg"
                    type="email"
                    formControlName="email"
                    placeholder="Enter your email address"
                    [error]="getFieldError('email')"
                  />
                  <app-input
                    label="Date of Birth"
                    size="lg"
                    type="date"
                    formControlName="date_of_birth"
                    [max]="maxDob"
                    [error]="getFieldError('date_of_birth')"
                  />
                  <div class="gender-field">
                    <label class="field-label">Gender</label>
                    <div class="gender-options">
                      @for (option of genderOptions; track option.value) {
                        <label class="gender-option" [class.selected]="profileForm.get('gender')?.value === option.value">
                          <input 
                            type="radio" 
                            formControlName="gender" 
                            [value]="option.value"
                          />
                          <span class="option-label">{{ option.label }}</span>
                        </label>
                      }
                    </div>
                  </div>
                </div>
                
                <div class="form-actions">
                  <app-button variant="outline" type="button" (click)="cancelEditing()">
                    Cancel
                  </app-button>
                  <app-button variant="primary" type="submit" [loading]="saving()">
                    Save Changes
                  </app-button>
                </div>
              </form>
            }
          </section>

          <!-- Quick Links -->
          <section class="quick-links">
            <h3 class="section-title">Quick Links</h3>
            <div class="links-grid">
              <a routerLink="/profile/family" class="quick-link-card">
                <div class="link-icon family">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div class="link-content">
                  <span class="link-title">Family Members</span>
                  <span class="link-desc">Manage family profiles</span>
                </div>
                <svg class="link-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </a>
              
              <a routerLink="/profile/addresses" class="quick-link-card">
                <div class="link-icon addresses">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <div class="link-content">
                  <span class="link-title">My Addresses</span>
                  <span class="link-desc">Manage saved addresses</span>
                </div>
                <svg class="link-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </a>
              
              <a routerLink="/bookings" class="quick-link-card">
                <div class="link-icon bookings">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div class="link-content">
                  <span class="link-title">My Bookings</span>
                  <span class="link-desc">View booking history</span>
                </div>
                <svg class="link-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </a>
            </div>
          </section>

          <!-- Danger Zone -->
          @if (!isAdmin()) {
            <section class="danger-zone">
              <h3 class="section-title danger">Danger Zone</h3>
              <app-card variant="outlined">
                <div class="danger-content">
                  <div class="danger-info">
                    <h4>Delete Account</h4>
                    <p>Once you delete your account, there is no going back. Please be certain.</p>
                  </div>
                  <app-button variant="danger" (click)="showDeleteModal.set(true)">
                    Delete Account
                  </app-button>
                </div>
              </app-card>
            </section>
          }
        </div>
      }

      <!-- Delete Account Modal -->
      <app-modal
        [isOpen]="showDeleteModal()"
        title="Delete Account"
        size="sm"
        (close)="showDeleteModal.set(false)"
      >
        <div class="delete-modal-content">
          <div class="warning-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <p class="delete-warning">
            Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.
          </p>
        </div>
        <div modal-footer>
          <app-button variant="outline" (click)="showDeleteModal.set(false)">
            Cancel
          </app-button>
          <app-button variant="danger" [loading]="deleting()" (click)="deleteAccount()">
            Yes, Delete My Account
          </app-button>
        </div>
      </app-modal>
    </div>
  `,
  styles: [`
    .profile-page {
      max-width: 900px;
      margin: 0 auto;
      padding: 1.5rem;
    }
    
    .page-header {
      margin-bottom: 2rem;
    }
    
    .page-title {
      font-size: 1.875rem;
      font-weight: 700;
      color: #0F172A;
      margin: 0 0 0.5rem 0;
    }
    
    .page-subtitle {
      font-size: 1rem;
      color: #475569;
      margin: 0;
    }
    
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      gap: 1rem;
      color: #475569;
    }
    
    .profile-layout {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    
    .profile-card {
      background: #FFFFFF;
      border-radius: 1.25rem;
      box-shadow: 0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px -1px rgba(0,0,0,.1);
      border: 1px solid #F1F5F9;
      overflow: hidden;
    }
    
    .profile-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 2rem;
      background: linear-gradient(135deg, #EEF4FF 0%, #D9E5FF 100%);
      border-bottom: 1px solid #F1F5F9;
    }
    
    .avatar-section {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }
    
    .profile-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    
    .user-name {
      font-size: 1.5rem;
      font-weight: 700;
      color: #0F172A;
      margin: 0;
    }
    
    .user-role {
      margin: 0.25rem 0;
    }
    
    .member-since {
      font-size: 0.875rem;
      color: #475569;
      margin: 0;
    }
    
    .profile-actions {
      .btn-icon {
        width: 18px;
        height: 18px;
        margin-right: 0.5rem;
      }
    }
    
    .profile-details {
      padding: 2rem;
    }
    
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
    }
    
    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    
    .detail-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }
    
    .detail-value {
      font-size: 1rem;
      color: #0F172A;
    }
    
    .edit-form {
      padding: 2rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem 1.75rem;
    }
    
    .gender-field {
      grid-column: span 2;
    }
    
    .field-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: #0F172A;
      margin-bottom: 0.5rem;
    }
    
    .gender-options {
      display: flex;
      gap: 0.75rem;
    }
    
    .gender-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 48px;
      padding: 0 1.25rem;
      border: 1px solid #E2E8F0;
      border-radius: 0.75rem;
      cursor: pointer;
      transition: all 150ms;
      
      input {
        width: 18px;
        height: 18px;
        accent-color: #003399;
      }
      
      .option-label {
        font-size: 0.875rem;
        color: #0F172A;
      }
      
      &:hover {
        border-color: #0A50D8;
        background: #EEF4FF;
      }
      
      &.selected {
        border-color: #003399;
        background: #EEF4FF;
      }
    }
    
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #F1F5F9;
    }
    
    .section-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #0F172A;
      margin: 0 0 1rem 0;
      
      &.danger {
        color: #DC2626;
      }
    }
    
    .links-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }
    
    .quick-link-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem;
      background: #FFFFFF;
      border: 1px solid #F1F5F9;
      border-radius: 1rem;
      text-decoration: none;
      transition: all 150ms;
      
      &:hover {
        border-color: #0A50D8;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1);
        transform: translateY(-2px);
        
        .link-arrow {
          transform: translateX(4px);
        }
      }
    }
    
    .link-icon {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.75rem;
      
      svg {
        width: 24px;
        height: 24px;
      }
      
      &.family {
        background: #D9E5FF;
        color: #003399;
      }
      
      &.addresses {
        background: #D9E5FF;
        color: #002577;
      }
      
      &.bookings {
        background: #D9E5FF;
        color: #003399;
      }
    }
    
    .link-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }
    
    .link-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #0F172A;
    }
    
    .link-desc {
      font-size: 0.75rem;
      color: #475569;
    }
    
    .link-arrow {
      width: 20px;
      height: 20px;
      color: #94A3B8;
      transition: transform 150ms;
    }
    
    .danger-zone {
      padding-top: 1rem;
      border-top: 1px solid #F1F5F9;
    }
    
    .danger-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      
      h4 {
        font-size: 1rem;
        font-weight: 600;
        color: #0F172A;
        margin: 0 0 0.25rem 0;
      }
      
      p {
        font-size: 0.875rem;
        color: #475569;
        margin: 0;
      }
    }
    
    .delete-modal-content {
      text-align: center;
    }
    
    .warning-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #FEE2E2;
      border-radius: 9999px;
      
      svg {
        width: 32px;
        height: 32px;
        color: #DC2626;
      }
    }
    
    .delete-warning {
      font-size: 0.875rem;
      color: #475569;
      line-height: 1.625;
    }
    
    @media (max-width: 768px) {
      .profile-page {
        padding: 1rem;
      }
      
      .profile-header {
        flex-direction: column;
        gap: 1rem;
      }
      
      .avatar-section {
        flex-direction: column;
        text-align: center;
      }
      
      .profile-actions {
        width: 100%;
        
        app-button {
          width: 100%;
        }
      }
      
      .detail-grid,
      .form-grid {
        grid-template-columns: 1fr;
      }
      
      .gender-field {
        grid-column: span 1;
      }
      
      .links-grid {
        grid-template-columns: 1fr;
      }
      
      .danger-content {
        flex-direction: column;
        text-align: center;
      }
    }
    
    @media (prefers-reduced-motion: reduce) {
      .quick-link-card:hover {
        transform: none;
      }
    }
  `]
})
export class ProfileNewComponent implements OnInit {
  user = signal<User | null>(null);
  loading = signal(true);
  error = signal('');
  isEditing = signal(false);
  saving = signal(false);
  deleting = signal(false);
  showDeleteModal = signal(false);

  /** Admin details are managed at the source; the profile page is read-only for them. */
  isAdmin = computed(() => this.user()?.role === 'admin');

  profileForm: FormGroup;
  maxDob = todayDateStr();

  genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ];
  
  constructor(
    private fb: FormBuilder,
    private userApi: UserApiService,
    private authState: AuthStateService,
    private router: Router
  ) {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.pattern(/^\+?[\d\s-]{10,}$/)]],
      email: ['', [Validators.email]],
      date_of_birth: ['', [dobValidator]],
      gender: [''],
    });
  }
  
  ngOnInit(): void {
    this.loadProfile();
  }
  
  loadProfile(): void {
    this.loading.set(true);
    this.userApi.getProfile().subscribe({
      next: (user) => {
        this.user.set(user);
        this.populateForm(user);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load profile. Please try again.');
        this.loading.set(false);
        console.error('Profile load error:', err);
      }
    });
  }
  
  populateForm(user: User): void {
    this.profileForm.patchValue({
      name: user.name,
      phone: user.phone || '',
      email: user.email || '',
      date_of_birth: user.date_of_birth || '',
      gender: user.gender || '',
    });
  }
  
  startEditing(): void {
    if (this.isAdmin()) return;
    this.isEditing.set(true);
  }
  
  cancelEditing(): void {
    this.isEditing.set(false);
    if (this.user()) {
      this.populateForm(this.user()!);
    }
  }
  
  saveProfile(): void {
    if (this.isAdmin()) return;
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    
    this.saving.set(true);
    const formValue = this.profileForm.value;
    
    this.userApi.updateProfile(formValue).subscribe({
      next: (updatedUser) => {
        this.user.set(updatedUser);
        this.isEditing.set(false);
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set('Failed to update profile. Please try again.');
        this.saving.set(false);
        console.error('Profile update error:', err);
      }
    });
  }
  
  deleteAccount(): void {
    if (this.isAdmin()) return;
    this.deleting.set(true);
    this.userApi.requestAccountDeletion().subscribe({
      next: () => {
        this.showDeleteModal.set(false);
        this.deleting.set(false);
        this.authState.clearSession();
        this.router.navigate(['/auth/login']);
      },
      error: (err) => {
        this.error.set('Failed to delete account. Please try again.');
        this.deleting.set(false);
        console.error('Account deletion error:', err);
      }
    });
  }
  
  getFieldError(fieldName: string): string {
    const control = this.profileForm.get(fieldName);
    if (control?.touched && control?.errors) {
      if (control.errors['required']) return `${this.capitalizeField(fieldName)} is required`;
      if (control.errors['minlength']) return `${this.capitalizeField(fieldName)} is too short`;
      if (control.errors['email']) return 'Please enter a valid email';
      if (control.errors['pattern']) return 'Please enter a valid phone number';
      if (control.errors['dobFuture']) return 'Date of birth cannot be in the future';
      if (control.errors['dobTooOld']) return 'Please enter a valid date of birth';
    }
    return '';
  }
  
  capitalizeField(field: string): string {
    return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  formatGender(gender?: string): string {
    if (!gender) return 'Not provided';
    return gender.charAt(0).toUpperCase() + gender.slice(1);
  }
  
  formatRole(role: string): string {
    const roles: Record<string, string> = {
      'user': 'Patient',
      'admin': 'Administrator',
      'technician': 'Lab Technician'
    };
    return roles[role] || role;
  }
  
  getRoleBadgeColor(role: string): string {
    const colors: Record<string, string> = {
      'user': 'primary',
      'admin': 'secondary',
      'technician': 'accent'
    };
    return colors[role] || 'default';
  }
}
