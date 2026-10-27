import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UserApiService } from '../../../core/api/services/user-api.service';
import { FamilyMember } from '../../../core/api/api.types';
import { RELATIONSHIP_OPTIONS, normalizeRelationship, relationshipLabel } from '../../../core/constants/relationships';
import { dobValidator, todayDateStr } from '../../../core/utils/dob-validator';
import {
  ButtonComponent,
  CardComponent,
  InputComponent,
  AlertComponent,
  SpinnerComponent,
  AvatarComponent,
  ModalComponent,
  BadgeComponent,
  EmptyStateComponent,
} from '../../../shared/components';

@Component({
  selector: 'app-family-members-new',
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
    EmptyStateComponent,
  ],
  template: `
    <div class="family-page">
      <!-- Page Header -->
      <header class="page-header">
        <div class="header-content">
          <a routerLink="/profile" class="back-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to Profile
          </a>
          <h1 class="page-title">Family Members</h1>
          <p class="page-subtitle">Manage family members to easily book tests for them</p>
        </div>
        <app-button variant="primary" (click)="openAddModal()">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Family Member
        </app-button>
      </header>

      <!-- Alert Messages -->
      @if (successMessage()) {
        <app-alert type="success" [dismissible]="true" (dismissed)="successMessage.set('')">
          {{ successMessage() }}
        </app-alert>
      }
      
      @if (error()) {
        <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">
          {{ error() }}
        </app-alert>
      }

      <!-- Loading State -->
      @if (loading()) {
        <div class="loading-container">
          <app-spinner size="lg" />
          <p>Loading family members...</p>
        </div>
      }

      <!-- Empty State -->
      @if (!loading() && members().length === 0) {
        <app-empty-state
          illustration="family-health"
          title="No Family Members"
          description="Add your family members to easily book tests for them without entering their details every time."
        >
          <app-button variant="primary" (click)="openAddModal()">
            Add Your First Family Member
          </app-button>
        </app-empty-state>
      }

      <!-- Members Grid -->
      @if (!loading() && members().length > 0) {
        <div class="members-grid">
          @for (member of members(); track member.id) {
            <div class="member-card" [class.inactive]="!member.is_active">
              <div class="card-header">
                <app-avatar [name]="member.name" size="lg" />
                <div class="member-info">
                  <h3 class="member-name">{{ member.name }}</h3>
                  <app-badge [color]="getRelationshipColor(member.relationship)">
                    {{ relationshipLabel(member.relationship) }}
                  </app-badge>
                </div>
                <div class="card-actions">
                  <button class="action-btn" (click)="openEditModal(member)" title="Edit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button class="action-btn danger" (click)="confirmDelete(member)" title="Delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div class="card-body">
                <div class="detail-row">
                  <span class="detail-label">Date of Birth</span>
                  <span class="detail-value">{{ member.date_of_birth ? formatDate(member.date_of_birth) : 'Not provided' }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Gender</span>
                  <span class="detail-value">{{ formatGender(member.gender) }}</span>
                </div>
                @if (!member.is_active) {
                  <div class="inactive-badge">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                    </svg>
                    Inactive
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Add/Edit Modal -->
      <app-modal
        [isOpen]="showFormModal()"
        [title]="editingMember() ? 'Edit Family Member' : 'Add Family Member'"
        size="md"
        (close)="closeFormModal()"
      >
        <form [formGroup]="memberForm" (ngSubmit)="saveMember()" class="member-form">
          <app-input
            label="Full Name"
            formControlName="name"
            placeholder="Enter full name"
            [error]="getFieldError('name')"
          />
          
          <div class="form-row">
            <div class="form-group">
              <label class="field-label">Relationship</label>
              <select formControlName="relationship" class="form-select">
                <option value="">Select relationship</option>
                @for (rel of relationships; track rel.value) {
                  <option [value]="rel.value">{{ rel.label }}</option>
                }
              </select>
              @if (getFieldError('relationship')) {
                <span class="field-error">{{ getFieldError('relationship') }}</span>
              }
            </div>
            
            <div class="form-group">
              <label class="field-label">Gender</label>
              <select formControlName="gender" class="form-select">
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          
          <app-input
            label="Date of Birth"
            type="date"
            formControlName="date_of_birth"
            [max]="maxDob"
            [error]="getFieldError('date_of_birth')"
          />
        </form>
        
        <div modal-footer>
          <app-button variant="outline" (click)="closeFormModal()">
            Cancel
          </app-button>
          <app-button 
            variant="primary" 
            [loading]="saving()" 
            (click)="saveMember()"
          >
            {{ editingMember() ? 'Update' : 'Add' }} Member
          </app-button>
        </div>
      </app-modal>

      <!-- Delete Confirmation Modal -->
      <app-modal
        [isOpen]="showDeleteModal()"
        title="Delete Family Member"
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
            Are you sure you want to remove <strong>{{ memberToDelete()?.name }}</strong> from your family members?
          </p>
        </div>
        <div modal-footer>
          <app-button variant="outline" (click)="showDeleteModal.set(false)">
            Cancel
          </app-button>
          <app-button variant="danger" [loading]="deleting()" (click)="deleteMember()">
            Yes, Remove
          </app-button>
        </div>
      </app-modal>
    </div>
  `,
  styles: [`
    .family-page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 1.5rem;
    }
    
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
      gap: 1rem;
    }
    
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #475569;
      text-decoration: none;
      margin-bottom: 0.75rem;
      transition: color 150ms;
      
      svg {
        width: 18px;
        height: 18px;
      }
      
      &:hover {
        color: #003399;
      }
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
    
    .btn-icon {
      width: 18px;
      height: 18px;
      margin-right: 0.5rem;
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
    
    .members-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 1.25rem;
    }
    
    .member-card {
      background: #FFFFFF;
      border: 1px solid #F1F5F9;
      border-radius: 1rem;
      overflow: hidden;
      transition: all 150ms;
      
      &:hover {
        border-color: #84A6FF;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1);
      }
      
      &.inactive {
        opacity: 0.7;
        
        .card-header {
          background: #F1F5F9;
        }
      }
    }
    
    .card-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem;
      background: linear-gradient(135deg, #EEF4FF 0%, #F8FAFC 100%);
      border-bottom: 1px solid #F1F5F9;
    }
    
    .member-info {
      flex: 1;
      min-width: 0;
    }
    
    .member-name {
      font-size: 1.125rem;
      font-weight: 600;
      color: #0F172A;
      margin: 0 0 0.25rem 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .card-actions {
      display: flex;
      gap: 0.5rem;
    }
    
    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 0.75rem;
      cursor: pointer;
      transition: all 150ms;
      
      svg {
        width: 18px;
        height: 18px;
        color: #475569;
      }
      
      &:hover {
        background: #EEF4FF;
        border-color: #84A6FF;
        
        svg { color: #003399; }
      }
      
      &.danger:hover {
        background: #FEF2F2;
        border-color: #FCA5A5;
        
        svg { color: #DC2626; }
      }
    }
    
    .card-body {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .detail-label {
      font-size: 0.875rem;
      color: #475569;
    }
    
    .detail-value {
      font-size: 0.875rem;
      font-weight: 500;
      color: #0F172A;
    }
    
    .inactive-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: #FEF2F2;
      color: #DC2626;
      font-size: 0.75rem;
      font-weight: 500;
      border-radius: 0.5rem;
      margin-top: 0.5rem;
      
      svg {
        width: 14px;
        height: 14px;
      }
    }
    
    .member-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    
    .form-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .field-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #0F172A;
    }
    
    .form-select {
      height: 40px;
      padding: 0 1rem;
      font-size: 0.875rem;
      color: #0F172A;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 0.75rem;
      cursor: pointer;
      transition: border-color 150ms;
      
      &:focus {
        outline: none;
        border-color: #0047CC;
        box-shadow: 0 0 0 3px rgba(#0047CC, 0.1);
      }
    }
    
    .field-error {
      font-size: 0.75rem;
      color: #DC2626;
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
      
      strong {
        color: #0F172A;
      }
    }
    
    @media (max-width: 768px) {
      .family-page {
        padding: 1rem;
      }
      
      .page-header {
        flex-direction: column;
      }
      
      .members-grid {
        grid-template-columns: 1fr;
      }
      
      .form-row {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class FamilyMembersNewComponent implements OnInit {
  members = signal<FamilyMember[]>([]);
  loading = signal(true);
  error = signal('');
  successMessage = signal('');
  saving = signal(false);
  deleting = signal(false);
  showFormModal = signal(false);
  showDeleteModal = signal(false);
  editingMember = signal<FamilyMember | null>(null);
  memberToDelete = signal<FamilyMember | null>(null);
  
  memberForm: FormGroup;
  maxDob = todayDateStr();
  
  relationships = RELATIONSHIP_OPTIONS;
  relationshipLabel = relationshipLabel;
  
  constructor(
    private fb: FormBuilder,
    private userApi: UserApiService
  ) {
    this.memberForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      relationship: ['', Validators.required],
      date_of_birth: ['', [dobValidator]],
      gender: [''],
    });
  }
  
  ngOnInit(): void {
    this.loadMembers();
  }
  
  loadMembers(): void {
    this.loading.set(true);
    this.userApi.getFamilyMembers().subscribe({
      next: (members) => {
        this.members.set(members);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load family members. Please try again.');
        this.loading.set(false);
        console.error('Family members load error:', err);
      }
    });
  }
  
  openAddModal(): void {
    this.editingMember.set(null);
    this.memberForm.reset();
    this.showFormModal.set(true);
  }
  
  openEditModal(member: FamilyMember): void {
    this.editingMember.set(member);
    this.memberForm.patchValue({
      name: member.name,
      // Legacy rows carry mixed casing ("Sibling" vs "sibling"); without this the
      // stored value matches no <option> and the dropdown renders blank.
      relationship: normalizeRelationship(member.relationship),
      gender: member.gender || '',
      date_of_birth: member.date_of_birth || '',
    });
    this.showFormModal.set(true);
  }
  
  closeFormModal(): void {
    this.showFormModal.set(false);
    this.editingMember.set(null);
    this.memberForm.reset();
  }
  
  saveMember(): void {
    if (this.memberForm.invalid) {
      this.memberForm.markAllAsTouched();
      return;
    }
    
    this.saving.set(true);
    const formValue = this.memberForm.value;
    
    const request = this.editingMember()
      ? this.userApi.updateFamilyMember(this.editingMember()!.id, formValue)
      : this.userApi.addFamilyMember(formValue);
    
    request.subscribe({
      next: () => {
        this.successMessage.set(
          this.editingMember() 
            ? 'Family member updated successfully' 
            : 'Family member added successfully'
        );
        this.closeFormModal();
        this.loadMembers();
        this.saving.set(false);
        
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (err) => {
        this.error.set('Failed to save family member. Please try again.');
        this.saving.set(false);
        console.error('Save family member error:', err);
      }
    });
  }
  
  confirmDelete(member: FamilyMember): void {
    this.memberToDelete.set(member);
    this.showDeleteModal.set(true);
  }
  
  deleteMember(): void {
    if (!this.memberToDelete()) return;
    
    this.deleting.set(true);
    this.userApi.deleteFamilyMember(this.memberToDelete()!.id).subscribe({
      next: () => {
        this.successMessage.set('Family member removed successfully');
        this.showDeleteModal.set(false);
        this.memberToDelete.set(null);
        this.loadMembers();
        this.deleting.set(false);
        
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (err) => {
        this.error.set('Failed to remove family member. Please try again.');
        this.deleting.set(false);
        console.error('Delete family member error:', err);
      }
    });
  }
  
  getFieldError(fieldName: string): string {
    const control = this.memberForm.get(fieldName);
    if (control?.touched && control?.errors) {
      if (control.errors['required']) return `${this.capitalizeField(fieldName)} is required`;
      if (control.errors['minlength']) return `${this.capitalizeField(fieldName)} is too short`;
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
    return date.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric' });
  }
  
  formatGender(gender?: string): string {
    if (!gender) return 'Not specified';
    return gender.charAt(0).toUpperCase() + gender.slice(1);
  }
  
  getRelationshipColor(relationship: string): string {
    // Keyed on canonical lowercase values — the stored data is mixed case.
    const colors: Record<string, string> = {
      spouse: 'primary',
      parent: 'secondary',
      child: 'accent',
      sibling: 'info',
      grandparent: 'warning',
      grandchild: 'success',
    };
    return colors[normalizeRelationship(relationship)] || 'default';
  }
}
