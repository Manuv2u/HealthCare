import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UserApiService } from '../../../core/api/services/user-api.service';
import { UserAddress } from '../../../core/api/api.types';
import {
  ButtonComponent,
  CardComponent,
  InputComponent,
  AlertComponent,
  SpinnerComponent,
  ModalComponent,
  BadgeComponent,
  EmptyStateComponent,
} from '../../../shared/components';

@Component({
  selector: 'app-address-book-new',
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
    ModalComponent,
    BadgeComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="address-page">
      <!-- Page Header -->
      <header class="page-header">
        <div class="header-content">
          <a routerLink="/profile" class="back-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to Profile
          </a>
          <h1 class="page-title">My Addresses</h1>
          <p class="page-subtitle">Manage your saved addresses for quick home sample collection</p>
        </div>
        <app-button variant="primary" (click)="openAddModal()">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add New Address
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
          <p>Loading your addresses...</p>
        </div>
      }

      <!-- Empty State -->
      @if (!loading() && addresses().length === 0) {
        <app-empty-state
          illustration="home-collection"
          title="No Saved Addresses"
          description="Add your addresses to quickly book home sample collection services."
        >
          <app-button variant="primary" (click)="openAddModal()">
            Add Your First Address
          </app-button>
        </app-empty-state>
      }

      <!-- Addresses Grid -->
      @if (!loading() && addresses().length > 0) {
        <div class="addresses-grid">
          @for (address of addresses(); track address.id) {
            <div class="address-card" [class.default]="address.is_default">
              <div class="card-header">
                <div class="label-badge" [class]="getLabelClass(address.label)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    @switch (address.label.toLowerCase()) {
                      @case ('home') {
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                      }
                      @case ('work') {
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                      }
                      @default {
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      }
                    }
                  </svg>
                  {{ address.label }}
                </div>
                @if (address.is_default) {
                  <app-badge color="success">Default</app-badge>
                }
              </div>
              
              <div class="card-body">
                <p class="address-line">{{ address.address_line1 }}</p>
                @if (address.address_line2) {
                  <p class="address-line secondary">{{ address.address_line2 }}</p>
                }
                <p class="address-city">
                  {{ address.city }}, {{ address.state }} - {{ address.pincode }}
                </p>
              </div>
              
              <div class="card-footer">
                @if (!address.is_default) {
                  <button class="text-btn" (click)="setAsDefault(address)">
                    Set as default
                  </button>
                }
                <div class="action-buttons">
                  <button class="action-btn" (click)="openEditModal(address)" title="Edit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button class="action-btn danger" (click)="confirmDelete(address)" title="Delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Add/Edit Modal -->
      <app-modal
        [isOpen]="showFormModal()"
        [title]="editingAddress() ? 'Edit Address' : 'Add New Address'"
        size="lg"
        (close)="closeFormModal()"
      >
        <form [formGroup]="addressForm" (ngSubmit)="saveAddress()" class="address-form">
          <div class="form-row">
            <div class="form-group">
              <label class="field-label">Address Label</label>
              <div class="label-options">
                @for (opt of labelOptions; track opt) {
                  <label class="label-option" [class.selected]="addressForm.get('label')?.value === opt">
                    <input type="radio" formControlName="label" [value]="opt" />
                    <span>{{ opt }}</span>
                  </label>
                }
              </div>
            </div>
          </div>
          
          <app-input
            label="Address Line 1"
            formControlName="address_line1"
            placeholder="House/Flat No., Building Name, Street"
            [error]="getFieldError('address_line1')"
          />
          
          <app-input
            label="Address Line 2 (Optional)"
            formControlName="address_line2"
            placeholder="Area, Landmark"
          />
          
          <div class="form-row three-col">
            <app-input
              label="City"
              formControlName="city"
              placeholder="City"
              [error]="getFieldError('city')"
            />
            <app-input
              label="State"
              formControlName="state"
              placeholder="State"
              [error]="getFieldError('state')"
            />
            <app-input
              label="Pincode"
              formControlName="pincode"
              placeholder="6-digit pincode"
              [error]="getFieldError('pincode')"
            />
          </div>
          
          <label class="checkbox-field">
            <input type="checkbox" formControlName="is_default" />
            <span class="checkbox-label">Set as default address</span>
          </label>
        </form>
        
        <div modal-footer>
          <app-button variant="outline" (click)="closeFormModal()">
            Cancel
          </app-button>
          <app-button 
            variant="primary" 
            [loading]="saving()" 
            (click)="saveAddress()"
          >
            {{ editingAddress() ? 'Update' : 'Save' }} Address
          </app-button>
        </div>
      </app-modal>

      <!-- Delete Confirmation Modal -->
      <app-modal
        [isOpen]="showDeleteModal()"
        title="Delete Address"
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
            Are you sure you want to delete this <strong>{{ addressToDelete()?.label }}</strong> address?
          </p>
        </div>
        <div modal-footer>
          <app-button variant="outline" (click)="showDeleteModal.set(false)">
            Cancel
          </app-button>
          <app-button variant="danger" [loading]="deleting()" (click)="deleteAddress()">
            Yes, Delete
          </app-button>
        </div>
      </app-modal>
    </div>
  `,
  styles: [`
    .address-page {
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
    
    .addresses-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 1.25rem;
    }
    
    .address-card {
      background: #FFFFFF;
      border: 1px solid #F1F5F9;
      border-radius: 1rem;
      overflow: hidden;
      transition: all 150ms;
      
      &:hover {
        border-color: #84A6FF;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1);
      }
      
      &.default {
        border-color: #68D391;
        
        .card-header {
          background: linear-gradient(135deg, #F0FFF4 0%, #F8FAFC 100%);
        }
      }
    }
    
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      background: linear-gradient(135deg, #EEF4FF 0%, #F8FAFC 100%);
      border-bottom: 1px solid #F1F5F9;
    }
    
    .label-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.5rem;
      
      svg {
        width: 16px;
        height: 16px;
      }
      
      &.home {
        background: #D9E5FF;
        color: #002577;
      }
      
      &.work {
        background: #D9E5FF;
        color: #001B57;
      }
      
      &.other {
        background: #E2E8F0;
        color: #334155;
      }
    }
    
    .card-body {
      padding: 1.25rem;
    }
    
    .address-line {
      font-size: 1rem;
      color: #0F172A;
      margin: 0 0 0.25rem 0;
      
      &.secondary {
        font-size: 0.875rem;
        color: #475569;
      }
    }
    
    .address-city {
      font-size: 0.875rem;
      color: #475569;
      margin: 0.5rem 0 0 0;
    }
    
    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border-top: 1px solid #F1F5F9;
      background: #F8FAFC;
    }
    
    .text-btn {
      background: none;
      border: none;
      color: #003399;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      padding: 0;
      transition: color 150ms;
      
      &:hover {
        color: #002577;
        text-decoration: underline;
      }
    }
    
    .action-buttons {
      display: flex;
      gap: 0.5rem;
    }
    
    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 0.5rem;
      cursor: pointer;
      transition: all 150ms;
      
      svg {
        width: 16px;
        height: 16px;
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
    
    .address-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    
    .form-row {
      &.three-col {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
      }
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
    
    .label-options {
      display: flex;
      gap: 0.75rem;
    }
    
    .label-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1rem;
      border: 1px solid #E2E8F0;
      border-radius: 0.75rem;
      cursor: pointer;
      transition: all 150ms;
      
      input {
        width: 16px;
        height: 16px;
        accent-color: #003399;
      }
      
      span {
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
    
    .checkbox-field {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      
      input {
        width: 18px;
        height: 18px;
        accent-color: #003399;
      }
      
      .checkbox-label {
        font-size: 0.875rem;
        color: #0F172A;
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
      
      strong {
        color: #0F172A;
      }
    }
    
    @media (max-width: 768px) {
      .address-page {
        padding: 1rem;
      }
      
      .page-header {
        flex-direction: column;
      }
      
      .addresses-grid {
        grid-template-columns: 1fr;
      }
      
      .form-row.three-col {
        grid-template-columns: 1fr;
      }
      
      .label-options {
        flex-wrap: wrap;
      }
    }
  `]
})
export class AddressBookNewComponent implements OnInit {
  addresses = signal<UserAddress[]>([]);
  loading = signal(true);
  error = signal('');
  successMessage = signal('');
  saving = signal(false);
  deleting = signal(false);
  showFormModal = signal(false);
  showDeleteModal = signal(false);
  editingAddress = signal<UserAddress | null>(null);
  addressToDelete = signal<UserAddress | null>(null);
  
  addressForm: FormGroup;
  labelOptions = ['Home', 'Work', 'Other'];
  
  constructor(
    private fb: FormBuilder,
    private userApi: UserApiService
  ) {
    this.addressForm = this.fb.group({
      label: ['Home', Validators.required],
      address_line1: ['', [Validators.required, Validators.minLength(5)]],
      address_line2: [''],
      city: ['', Validators.required],
      state: ['', Validators.required],
      pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      is_default: [false],
    });
  }
  
  ngOnInit(): void {
    this.loadAddresses();
  }
  
  loadAddresses(): void {
    this.loading.set(true);
    this.userApi.getAddresses().subscribe({
      next: (response) => {
        this.addresses.set(response.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load addresses. Please try again.');
        this.loading.set(false);
        console.error('Addresses load error:', err);
      }
    });
  }
  
  openAddModal(): void {
    this.editingAddress.set(null);
    this.addressForm.reset({ label: 'Home', is_default: false });
    this.showFormModal.set(true);
  }
  
  openEditModal(address: UserAddress): void {
    this.editingAddress.set(address);
    this.addressForm.patchValue({
      label: address.label,
      address_line1: address.address_line1,
      address_line2: address.address_line2 || '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      is_default: address.is_default,
    });
    this.showFormModal.set(true);
  }
  
  closeFormModal(): void {
    this.showFormModal.set(false);
    this.editingAddress.set(null);
    this.addressForm.reset({ label: 'Home', is_default: false });
  }
  
  saveAddress(): void {
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      return;
    }
    
    this.saving.set(true);
    const formValue = this.addressForm.value;
    
    const request = this.editingAddress()
      ? this.userApi.updateAddress(this.editingAddress()!.id, formValue)
      : this.userApi.addAddress(formValue);
    
    request.subscribe({
      next: () => {
        this.successMessage.set(
          this.editingAddress() 
            ? 'Address updated successfully' 
            : 'Address added successfully'
        );
        this.closeFormModal();
        this.loadAddresses();
        this.saving.set(false);
        
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (err) => {
        this.error.set('Failed to save address. Please try again.');
        this.saving.set(false);
        console.error('Save address error:', err);
      }
    });
  }
  
  setAsDefault(address: UserAddress): void {
    this.userApi.updateAddress(address.id, { is_default: true }).subscribe({
      next: () => {
        this.successMessage.set('Default address updated');
        this.loadAddresses();
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (err) => {
        this.error.set('Failed to update default address.');
        console.error('Set default error:', err);
      }
    });
  }
  
  confirmDelete(address: UserAddress): void {
    this.addressToDelete.set(address);
    this.showDeleteModal.set(true);
  }
  
  deleteAddress(): void {
    if (!this.addressToDelete()) return;
    
    this.deleting.set(true);
    this.userApi.deleteAddress(this.addressToDelete()!.id).subscribe({
      next: () => {
        this.successMessage.set('Address deleted successfully');
        this.showDeleteModal.set(false);
        this.addressToDelete.set(null);
        this.loadAddresses();
        this.deleting.set(false);
        
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (err) => {
        this.error.set('Failed to delete address. Please try again.');
        this.deleting.set(false);
        console.error('Delete address error:', err);
      }
    });
  }
  
  getFieldError(fieldName: string): string {
    const control = this.addressForm.get(fieldName);
    if (control?.touched && control?.errors) {
      if (control.errors['required']) return `${this.capitalizeField(fieldName)} is required`;
      if (control.errors['minlength']) return `${this.capitalizeField(fieldName)} is too short`;
      if (control.errors['pattern']) return 'Please enter a valid 6-digit pincode';
    }
    return '';
  }
  
  capitalizeField(field: string): string {
    return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  getLabelClass(label: string): string {
    return label.toLowerCase();
  }
}
