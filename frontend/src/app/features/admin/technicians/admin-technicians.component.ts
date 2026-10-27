import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../../core/api/services/admin-api.service';
import { Technician } from '../../../core/api/api.types';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';

@Component({
  selector: 'app-admin-technicians',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent, SpinnerComponent, ButtonComponent, ModalComponent, AlertComponent, AvatarComponent, InputComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div><h1 class="page-title">Technicians</h1><p class="page-sub">Manage field staff and lab technicians</p></div>
    <app-button variant="primary" (click)="openCreate()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Technician
    </app-button>
  </div>

  @if (error()) { <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">{{ error() }}</app-alert> }
  @if (success()) { <app-alert type="success" [dismissible]="true" (dismissed)="success.set('')">{{ success() }}</app-alert> }

  @if (loading()) {
    <div class="load-wrap"><app-spinner size="md" /></div>
  } @else {
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>Technician</th><th>Phone</th><th>Email</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody>
          @if (techs().length === 0) { <tr><td colspan="6" class="empty-td">No technicians found.</td></tr> }
          @for (t of techs(); track t.id) {
            <tr>
              <td>
                <div class="user-cell">
                  <app-avatar [name]="t.name" size="sm" />
                  <span class="user-name">{{ t.name }}</span>
                </div>
              </td>
              <td class="mono">{{ t.phone }}</td>
              <td class="text-sm">{{ t.email }}</td>
              <td><app-badge [color]="t.is_active ? 'success' : 'error'" size="sm">{{ t.is_active ? 'Active' : 'Inactive' }}</app-badge></td>
              <td class="text-sm text-muted">{{ t.created_at | date:'dd MMM yyyy' }}</td>
              <td>
                <div class="row-acts">
                  <button class="act-btn" (click)="openEdit(t)" title="Edit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="act-btn danger" (click)="remove(t)" title="Delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                  </button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }

  <!-- Modal -->
  <app-modal [isOpen]="showModal()" [title]="editId() ? 'Edit Technician' : 'Add Technician'" size="md" (close)="closeModal()">
    <div class="form-grid">
      <div class="span2">
        <app-input label="Full Name" [required]="true" icon="person" placeholder="Enter full name" [(ngModel)]="f.name" />
      </div>
      <app-input label="Phone" [required]="true" icon="phone" type="tel" placeholder="+91 XXXXX XXXXX" [(ngModel)]="f.phone" />
      <app-input label="Email" [required]="true" icon="mail" type="email" placeholder="email@example.com" [(ngModel)]="f.email" />
      @if (!editId()) {
        <div class="span2">
          <app-input
            label="Temporary Password"
            [required]="true"
            icon="lock"
            type="password"
            placeholder="Min 8 chars: 1 upper, 1 lower, 1 digit, 1 special"
            hint="The technician must change this password on first login."
            [(ngModel)]="f.password"
          />
        </div>
      }
      <div class="field span2">
        <label>Status</label>
        <div class="radio-group">
          <label class="radio-opt" [class.checked]="f.is_active === true"><input type="radio" [(ngModel)]="f.is_active" [value]="true" /><span>Active</span></label>
          <label class="radio-opt" [class.checked]="f.is_active === false"><input type="radio" [(ngModel)]="f.is_active" [value]="false" /><span>Inactive</span></label>
        </div>
      </div>
    </div>
    @if (formErr()) { <p class="form-err">{{ formErr() }}</p> }
    <div modal-footer>
      <app-button variant="outline" (click)="closeModal()">Cancel</app-button>
      <app-button variant="primary" [loading]="saving()" (click)="save()">{{ editId() ? 'Update' : 'Add' }} Technician</app-button>
    </div>
  </app-modal>
</div>`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; }
    .page-title { font-size:1.5rem; font-weight:700; color:#0F172A; margin:0 0 0.25rem 0; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }
    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .table-wrap { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; overflow:hidden; }
    .tbl { width:100%; border-collapse:collapse; thead tr { background:#F8FAFC; } th { padding:0.75rem 1rem; text-align:left; font-size:0.75rem; font-weight:600; color:#94A3B8; text-transform:uppercase; letter-spacing:0.025em; border-bottom:1px solid #F1F5F9; } td { padding:0.875rem 1rem; border-bottom:1px solid #F1F5F9; font-size:0.875rem; color:#0F172A; } tbody tr:last-child td { border-bottom:none; } tbody tr:hover td { background:#F8FAFC; } }
    .user-cell { display:flex; align-items:center; gap:0.75rem; }
    .user-name { font-weight:500; }
    .mono { font-family:'JetBrains Mono','SF Mono','Fira Code',monospace; font-size:0.75rem; }
    .text-sm { font-size:0.875rem; }
    .text-muted { color:#94A3B8; }
    .empty-td { text-align:center; color:#94A3B8; padding:3rem !important; }
    .row-acts { display:flex; gap:0.5rem; }
    .act-btn { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFFFFF; cursor:pointer; transition:all 150ms; color:#475569; svg { width:15px; height:15px; } &:hover { background:#EEF4FF; border-color:#84A6FF; color:#003399; } &.danger:hover { background:#FEF2F2; border-color:#FCA5A5; color:#DC2626; } }
    .form-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1rem; }
    .field { display:flex; flex-direction:column; gap:0.375rem; &.span2 { grid-column:span 2; } label { font-size:0.875rem; font-weight:500; color:#0F172A; } }
    .span2 { grid-column:span 2; }
    .radio-group { display:flex; gap:0.75rem; }
    .radio-opt { display:flex; align-items:center; gap:0.5rem; padding:0.625rem 1rem; border:1px solid #E2E8F0; border-radius:0.75rem; cursor:pointer; font-size:0.875rem; transition:all 150ms; input { accent-color:#003399; } &:hover, &.checked { border-color:#0047CC; background:#EEF4FF; color:#002577; } }
    .form-err { font-size:0.875rem; color:#DC2626; margin:0.5rem 0 0 0; }
  `]
})
export class AdminTechniciansComponent implements OnInit {
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal('');
  formErr = signal('');
  techs = signal<Technician[]>([]);
  showModal = signal(false);
  editId = signal<string | null>(null);
  f = { name:'', phone:'', email:'', password:'', is_active:true };

  constructor(private adminApi: AdminApiService, private confirm: ConfirmDialogService) {}
  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.adminApi.getTechnicians().subscribe({
      next: (r: any) => { this.techs.set(r.items || r); this.loading.set(false); },
      error: () => { this.error.set('Failed to load technicians.'); this.loading.set(false); }
    });
  }

  openCreate() { this.editId.set(null); this.f = { name:'', phone:'', email:'', password:'', is_active:true }; this.formErr.set(''); this.showModal.set(true); }
  openEdit(t: Technician) { this.editId.set(t.id); this.f = { name:t.name, phone:t.phone, email:t.email, password:'', is_active:t.is_active }; this.formErr.set(''); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.editId.set(null); }

  save() {
    if (!this.f.name.trim()) { this.formErr.set('Name is required.'); return; }
    if (!this.f.phone.trim()) { this.formErr.set('Phone is required.'); return; }
    if (!this.f.email.trim()) { this.formErr.set('Email is required.'); return; }
    const id = this.editId();
    if (!id && this.f.password.trim().length < 8) {
      this.formErr.set('Temporary password must be at least 8 characters.');
      return;
    }
    this.saving.set(true);
    this.formErr.set('');
    if (id) {
      this.adminApi.updateTechnician(id, { name: this.f.name, phone: this.f.phone, email: this.f.email, is_active: this.f.is_active }).subscribe({
        next: () => { this.saving.set(false); this.closeModal(); this.load(); },
        error: err => { this.formErr.set(this.errMsg(err, 'Failed to save.')); this.saving.set(false); }
      });
    } else {
      this.adminApi.createTechnicianAccount({ name: this.f.name.trim(), phone: this.f.phone.trim(), email: this.f.email.trim().toLowerCase(), password: this.f.password }).subscribe({
        next: () => {
          this.saving.set(false);
          this.success.set(`Technician account created for ${this.f.name.trim()}. They can sign in with their email/phone and the temporary password, and will be asked to change it on first login.`);
          this.closeModal();
          this.load();
        },
        error: err => { this.formErr.set(this.errMsg(err, 'Failed to create account.')); this.saving.set(false); }
      });
    }
  }

  private errMsg(err: any, fallback: string): string {
    const d = err?.error?.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
    if (d?.message) return d.message;
    return fallback;
  }

  async remove(t: Technician) {
    const ok = await this.confirm.askDelete(t.name, 'They will lose access to the technician app. This cannot be undone.');
    if (!ok) return;
    this.adminApi.deleteTechnician(t.id).subscribe({ next: () => this.load() });
  }
}
