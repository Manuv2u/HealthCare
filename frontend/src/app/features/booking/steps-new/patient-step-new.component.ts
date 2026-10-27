import { Component, inject, Input, OnInit, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserApiService } from '../../../core/api/services/user-api.service';
import { BookingWizardStore } from '../../../core/store/booking-wizard.store';
import { FamilyMember, User } from '../../../core/api/api.types';
import { RELATIONSHIP_OPTIONS } from '../../../core/constants/relationships';
import { todayIstDateStr } from '../../../core/utils/ist.util';
import {
  ButtonComponent, SpinnerComponent, InputComponent, SelectComponent, ModalComponent, SelectOption
} from '../../../shared/components';

@Component({
  selector: 'app-patient-step-new',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    SpinnerComponent,
    InputComponent,
    SelectComponent,
    ModalComponent
  ],
  template: `
    <div class="patient-step">
      @if (loading()) {
        <div class="loading-state">
          <app-spinner size="lg" />
          <p>Loading patient information...</p>
        </div>
      } @else if (error()) {
        <div class="error-state">
          <div class="error-state__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h3>Unable to load patients</h3>
          <p>{{ error() }}</p>
          <app-button variant="outline" (click)="load()">Try Again</app-button>
        </div>
      } @else {
        <div class="patient-picker">
          <div class="patient-picker__select-wrap">
            <span class="patient-picker__select-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
            <app-select
              class="patient-picker__select"
              [options]="patientOptions()"
              [ngModel]="selectedId()"
              (ngModelChange)="selectPatient($event)"
              placeholder="Select patient"
            />
          </div>
          <button type="button" class="add-user-btn" (click)="openAddModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            Add New User
          </button>
        </div>

        <!-- Actions -->
        @if (!embedded) {
          <div class="step-actions">
            <app-button variant="primary" size="lg" [disabled]="!canProceed()" (click)="onNext()">
              Continue
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </app-button>
          </div>
        }
      }

      <!-- Add Member Modal -->
      <app-modal [isOpen]="showAddModal()" (close)="closeAddModal()" title="Add Family Member" size="md">
        <div class="add-form">
          <div class="add-form__grid">
            <div class="add-form__field add-form__field--full">
              <label class="add-form__label">Full Name <span class="required">*</span></label>
              <input 
                type="text" 
                class="add-form__input"
                placeholder="Enter full name"
                [(ngModel)]="newMember.name"
              />
            </div>
            
            <div class="add-form__field">
              <label class="add-form__label">Relationship <span class="required">*</span></label>
              <select class="add-form__input add-form__select" [(ngModel)]="newMember.relationship">
                <option value="">Select relationship</option>
                @for (rel of relationships; track rel.value) {
                  <option [value]="rel.value">{{ rel.label }}</option>
                }
              </select>
            </div>
            
            <div class="add-form__field">
              <label class="add-form__label">Gender</label>
              <select class="add-form__input add-form__select" [(ngModel)]="newMember.gender">
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div class="add-form__field add-form__field--full">
              <label class="add-form__label">Date of Birth</label>
              <input 
                type="date" 
                class="add-form__input"
                [max]="todayStr"
                [(ngModel)]="newMember.dob"
              />
            </div>
          </div>

          @if (addError()) {
            <div class="add-form__error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {{ addError() }}
            </div>
          }
        </div>

        <div modal-footer class="add-form__actions">
          <app-button variant="outline" (click)="closeAddModal()" [disabled]="addLoading()">Cancel</app-button>
          <app-button 
            variant="primary" 
            [loading]="addLoading()"
            [disabled]="!newMember.name.trim() || !newMember.relationship"
            (click)="saveMember()"
          >
            Save Member
          </app-button>
        </div>
      </app-modal>
    </div>
  `,
  styles: [`
    :host {
      --color-primary-50: #EEF4FF;
      --color-primary-100: #D9E5FF;
      --color-primary-500: #0047CC;
      --color-primary-600: #003399;
      --color-primary-700: #002577;
      --color-primary-800: #001B57;
      --shadow-primary: 0 4px 14px 0 rgba(0, 51, 153, 0.28);
      display: block;
    }

    .patient-step {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .loading-state,
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      text-align: center;
      gap: 1rem;
    }

    .loading-state p,
    .error-state p {
      color: #475569;
      margin: 0;
    }

    .error-state__icon {
      width: 64px;
      height: 64px;
      border-radius: 9999px;
      background: #FEF2F2;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #EF4444;

      svg {
        width: 32px;
        height: 32px;
      }
    }

    .error-state h3 {
      font-size: 1.125rem;
      font-weight: 600;
      color: #0F172A;
      margin: 0;
    }

    /* Patient Picker */
    .patient-picker {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .patient-picker__select-wrap {
      position: relative;
      flex: 1;
      min-width: 0;
    }

    .patient-picker__select-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      width: 28px;
      height: 28px;
      border-radius: 9999px;
      background: #EEF4FF;
      color: #0047CC;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      pointer-events: none;

      svg {
        width: 16px;
        height: 16px;
      }
    }

    /* Shared app-select's internal padding isn't exposed as an Input, so this
       reaches past encapsulation to make room for the leading avatar icon —
       scoped to this one instance via the wrapper class, not global. */
    .patient-picker__select-wrap ::ng-deep .select__container {
      padding-left: 46px;
    }

    .add-user-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      height: var(--input-height-md, 44px);
      padding: 0 1rem;
      background: #FFFFFF;
      border: 1px solid #B3CAFF;
      border-radius: 0.625rem;
      color: #0047CC;
      font-size: 0.875rem;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      transition: border-color 150ms, background 150ms;

      svg {
        width: 18px;
        height: 18px;
      }

      &:hover {
        background: #EEF4FF;
        border-color: #0047CC;
      }
    }

    /* Step Actions */
    .step-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 1rem;
      border-top: 1px solid #F1F5F9;
    }

    .btn-icon {
      width: 18px;
      height: 18px;
      margin-left: 0.5rem;
    }

    /* Add Form */
    .add-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .add-form__grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }

    .add-form__field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .add-form__field--full {
      grid-column: 1 / -1;
    }

    .add-form__label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #475569;
    }

    .required {
      color: #EF4444;
    }

    .add-form__input {
      width: 100%;
      padding: 0.75rem;
      border: 1.5px solid #E2E8F0;
      border-radius: 0.75rem;
      background: #F8FAFC;
      font-size: 1rem;
      color: #0F172A;
      transition: all 150ms;

      &:focus {
        outline: none;
        border-color: #0047CC;
        background: #FFFFFF;
        box-shadow: 0 0 0 4px #B3CAFF;
      }

      &::placeholder {
        color: #94A3B8;
      }
    }

    .add-form__select {
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      padding-right: 2.5rem;
    }

    .add-form__error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem;
      background: #FEF2F2;
      color: #B91C1C;
      border-radius: 0.75rem;
      font-size: 0.875rem;

      svg {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
      }
    }

    .add-form__actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }

  `]
})
export class PatientStepNewComponent implements OnInit {
  @Input() embedded = false;

  next = output<void>();

  private userApi = inject(UserApiService);
  readonly store = inject(BookingWizardStore);

  /* State */
  loading = signal(false);
  error = signal<string | null>(null);
  profile = signal<User | null>(null);
  familyMembers = signal<FamilyMember[]>([]);
  selectedId = signal<string>('self');

  /* Add modal state */
  showAddModal = signal(false);
  addLoading = signal(false);
  addError = signal<string | null>(null);
  relationships = RELATIONSHIP_OPTIONS;
  newMember = { name: '', relationship: '', gender: '', dob: '' };

  readonly todayStr = todayIstDateStr();

  patientOptions = computed<SelectOption[]>(() => [
    { value: 'self', label: `${this.profile()?.name || 'Myself'} (Primary)` },
    ...this.familyMembers().map(member => ({
      value: member.id,
      label: `${member.name} (${this.titlecase(member.relationship)}${member.date_of_birth ? ', ' + this.memberAge(member.date_of_birth) + ' yrs' : ''})`,
    })),
  ]);

  private titlecase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

  private memberAge(dob: string): number {
    const today = new Date();
    const birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  ngOnInit(): void {
    /* Resuming a persisted session: reflect the prior choice locally too, not
       just in the store, so the card shows as selected instead of resetting to Self. */
    this.selectedId.set(this.store.patientId() ?? 'self');
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.userApi.getProfile().subscribe({
      next: (user) => {
        this.profile.set(user);
        this.userApi.getFamilyMembers().subscribe({
          next: (members) => {
            this.familyMembers.set(members.filter(m => m.is_active && !m.deleted_at));
            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => {
        this.error.set('Unable to load your profile. Please try again.');
        this.loading.set(false);
      }
    });
  }

  selectPatient(id: string): void {
    this.selectedId.set(id);
    this.commitSelection();
  }

  /** Patches the store immediately so an embedded sibling step (or a refresh) sees the choice right away. */
  private commitSelection(): void {
    const isSelf = this.selectedId() === 'self';
    const patientId = isSelf ? null : this.selectedId();
    const patientName = isSelf
      ? (this.profile()?.name ?? null)
      : (this.familyMembers().find(m => m.id === this.selectedId())?.name ?? null);

    this.store.patch({ patientId, patientName });
  }

  canProceed(): boolean {
    return !!this.selectedId();
  }

  openAddModal(): void {
    this.showAddModal.set(true);
    this.addError.set(null);
    this.newMember = { name: '', relationship: '', gender: '', dob: '' };
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
  }

  saveMember(): void {
    if (!this.newMember.name.trim() || !this.newMember.relationship) return;

    this.addLoading.set(true);
    this.addError.set(null);

    const payload: Partial<FamilyMember> = {
      name: this.newMember.name.trim(),
      relationship: this.newMember.relationship,
      gender: this.newMember.gender || undefined,
      date_of_birth: this.newMember.dob || undefined
    };

    this.userApi.addFamilyMember(payload).subscribe({
      next: (member) => {
        this.familyMembers.update(list => [...list, member]);
        this.selectedId.set(member.id);
        this.commitSelection();
        this.addLoading.set(false);
        this.closeAddModal();
      },
      error: () => {
        this.addError.set('Failed to add family member. Please try again.');
        this.addLoading.set(false);
      }
    });
  }

  onNext(): void {
    if (!this.canProceed()) return;
    this.commitSelection();
    this.next.emit();
  }
}
