import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LabBranchApiService } from '../../../core/api/services/lab-branch-api.service';
import { LabBranch } from '../../../core/api/api.types';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { InputComponent } from '../../../shared/components/input/input.component';

@Component({
  selector: 'app-admin-lab-branches',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent, SpinnerComponent, ButtonComponent, ModalComponent, AlertComponent, InputComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div><h1 class="page-title">Lab Branches</h1><p class="page-sub">Manage collection centres and lab locations</p></div>
    <div class="header-actions">
      <label class="show-inactive">
        <input type="checkbox" [checked]="showInactive()" (change)="toggleShowInactive()" />
        Show inactive
      </label>
    <app-button variant="primary" (click)="openCreate()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Branch
    </app-button>
    </div>
  </div>
  @if (error()) { <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">{{ error() }}</app-alert> }
  @if (notice()) { <app-alert type="info" [dismissible]="true" (dismissed)="notice.set('')">{{ notice() }}</app-alert> }
  @if (loading()) { <div class="load-wrap"><app-spinner size="md" /></div>
  } @else {
    <div class="branches-grid">
      @if (branches().length === 0) { <div class="empty-card">No lab branches found.</div> }
      @for (b of branches(); track b.id) {
        <div class="branch-card" [class.inactive]="!b.is_active">
          <div class="branch-head">
            <div class="branch-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16"/><path d="M1 21h22"/><path d="M9 7h1"/><path d="M9 11h1"/><path d="M14 7h1"/><path d="M14 11h1"/></svg>
            </div>
            <app-badge [color]="b.is_active ? 'success' : 'default'" size="sm">{{ b.is_active ? 'Active' : 'Inactive' }}</app-badge>
          </div>
          <h3 class="branch-name">{{ b.name }}</h3>
          <div class="branch-info">
            <div class="info-line">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {{ b.address }}, {{ b.city }} - {{ b.pincode }}
            </div>
            <div class="info-line">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 10a16 16 0 0 0 5.91 5.91l.84-.84a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              {{ b.phone }}
            </div>
            @if (b.operating_hours) {
              <div class="info-line">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {{ b.operating_hours }}
              </div>
            }
          </div>
          <div class="branch-actions">
            <button class="act-btn" (click)="openEdit(b)">Edit</button>
            <button class="act-btn" [disabled]="busyId() === b.id" (click)="toggleActive(b)">
              {{ b.is_active ? 'Deactivate' : 'Activate' }}
            </button>
            <button class="act-btn danger" [disabled]="busyId() === b.id" (click)="remove(b)">Delete</button>
          </div>
        </div>
      }
    </div>
  }

  <app-modal [isOpen]="showModal()" [title]="editId() ? 'Edit Branch' : 'Add Branch'" size="lg" (close)="closeModal()">
    <div class="form-grid">
      <div class="span2">
        <app-input label="Branch Name" [required]="true" icon="location_city" placeholder="e.g. Hyderabad Main Branch" [(ngModel)]="f.name" />
      </div>
      <div class="span2">
        <app-input label="Address" [required]="true" icon="place" type="textarea" [rows]="2" [(ngModel)]="f.address" />
      </div>
      <app-input label="City" [required]="true" icon="apartment" [(ngModel)]="f.city" />
      <app-input label="Pincode" [required]="true" icon="pin_drop" inputmode="numeric" [maxlength]="6" [(ngModel)]="f.pincode" />
      <app-input label="Phone" [required]="true" icon="call" type="tel" [(ngModel)]="f.phone" />
      <app-input label="Operating Hours" icon="schedule" placeholder="e.g. Mon-Sat 7AM–8PM" [(ngModel)]="f.operating_hours" />
    </div>
    @if (formErr()) { <p class="form-err">{{ formErr() }}</p> }
    <div modal-footer>
      <app-button variant="outline" (click)="closeModal()">Cancel</app-button>
      <app-button variant="primary" [loading]="saving()" (click)="save()">{{ editId() ? 'Update' : 'Add' }} Branch</app-button>
    </div>
  </app-modal>
</div>`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; }
    .header-actions { display:flex; align-items:center; gap:1rem; flex-wrap:wrap; }
    .show-inactive { display:inline-flex; align-items:center; gap:0.5rem; font-size:0.875rem; color:#475569; cursor:pointer; user-select:none; input { width:16px; height:16px; cursor:pointer; accent-color:#003399; } }
    .page-title { font-size:1.5rem; font-weight:700; color:#0F172A; margin:0 0 0.25rem 0; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }
    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .branches-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:1.25rem; }
    .empty-card { grid-column:1/-1; text-align:center; padding:3rem; color:#94A3B8; font-size:0.875rem; background:#FFFFFF; border:2px dashed #E2E8F0; border-radius:1rem; }
    .branch-card { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; padding:1.5rem; display:flex; flex-direction:column; gap:1rem; transition:all 150ms; &:hover { border-color:#84A6FF; box-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1); } &.inactive { opacity:.7; } }
    .branch-head { display:flex; justify-content:space-between; align-items:center; }
    .branch-icon { width:44px; height:44px; border-radius:0.75rem; background:#D9E5FF; color:#003399; display:flex; align-items:center; justify-content:center; svg { width:22px; height:22px; } }
    .branch-name { font-size:1.125rem; font-weight:600; color:#0F172A; margin:0; }
    .branch-info { display:flex; flex-direction:column; gap:0.5rem; }
    .info-line { display:flex; align-items:flex-start; gap:0.5rem; font-size:0.875rem; color:#475569; svg { width:15px; height:15px; flex-shrink:0; margin-top:1px; color:#94A3B8; } }
    .branch-actions { display:flex; gap:0.5rem; }
    .act-btn { display:inline-flex; align-items:center; gap:0.5rem; padding:0.5rem 0.75rem; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFFFFF; font-size:0.75rem; font-weight:500; color:#475569; cursor:pointer; transition:all 150ms; &:hover:not(:disabled) { background:#EEF4FF; border-color:#84A6FF; color:#002577; } &.danger:hover:not(:disabled) { background:#FEF2F2; border-color:#FCA5A5; color:#DC2626; } &:disabled { opacity:.5; cursor:not-allowed; } }
    .form-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1rem; }
    .span2 { grid-column:span 2; }
    .form-err { font-size:0.875rem; color:#DC2626; margin:0.5rem 0 0 0; }
  `]
})
export class AdminLabBranchesComponent implements OnInit {
  loading = signal(false); saving = signal(false); error = signal(''); formErr = signal('');
  branches = signal<LabBranch[]>([]); showModal = signal(false); editId = signal<string|null>(null);
  busyId = signal<string|null>(null); showInactive = signal(false); notice = signal('');
  f = { name:'', address:'', city:'', pincode:'', phone:'', operating_hours:'' };

  constructor(private api: LabBranchApiService, private confirm: ConfirmDialogService) {}
  ngOnInit() { this.load(); }
  load() { this.loading.set(true); this.api.listAdmin(this.showInactive()).subscribe({ next: b => { this.branches.set(b); this.loading.set(false); }, error: () => { this.error.set('Failed to load.'); this.loading.set(false); } }); }
  toggleShowInactive() { this.showInactive.set(!this.showInactive()); this.load(); }
  openCreate() { this.editId.set(null); this.f = { name:'', address:'', city:'', pincode:'', phone:'', operating_hours:'' }; this.formErr.set(''); this.showModal.set(true); }
  openEdit(b: LabBranch) { this.editId.set(b.id); this.f = { name:b.name, address:b.address, city:b.city, pincode:b.pincode, phone:b.phone, operating_hours:b.operating_hours||'' }; this.formErr.set(''); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.editId.set(null); }
  save() {
    if (!this.f.name.trim() || !this.f.address.trim() || !this.f.city.trim() || !this.f.phone.trim()) { this.formErr.set('Name, address, city and phone are required.'); return; }
    this.saving.set(true);
    const id = this.editId();
    const obs = id ? this.api.update(id, this.f) : this.api.create(this.f);
    obs.subscribe({ next: () => { this.saving.set(false); this.closeModal(); this.load(); }, error: err => { this.formErr.set(err.error?.detail?.message || 'Failed to save.'); this.saving.set(false); } });
  }
  async toggleActive(b: LabBranch) {
    this.error.set('');
    this.busyId.set(b.id);
    this.api.update(b.id, { is_active: !b.is_active }).subscribe({
      next: () => { this.busyId.set(null); this.load(); },
      error: () => { this.error.set(`Failed to ${b.is_active ? 'deactivate' : 'activate'} "${b.name}".`); this.busyId.set(null); },
    });
  }

  async remove(b: LabBranch) {
    const ok = await this.confirm.askDelete(`branch "${b.name}"`, 'It will be permanently removed. This cannot be undone — deactivate it instead if you only want to hide it from patients.');
    if (!ok) return;
    this.error.set(''); this.notice.set('');
    this.busyId.set(b.id);
    this.api.delete(b.id).subscribe({
      next: res => { if (res?.action === 'deactivated') { this.notice.set(res.message); } this.busyId.set(null); this.load(); },
      error: err => { this.error.set(err.error?.detail?.message || 'Failed to delete branch.'); this.busyId.set(null); },
    });
  }
}
