import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CouponApiService } from '../../../core/api/services/coupon-api.service';
import { PackageApiService } from '../../../core/api/services/package-api.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { Coupon, CouponPayload, DiscountType, Package } from '../../../core/api/api.types';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import { isoToIstDatetimeLocal, istDatetimeLocalToUtcIso } from '../../../core/utils/ist.util';

interface CouponForm {
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  package_ids: string[];
  valid_from: string;
  valid_until: string;
  usage_limit: number | null;
  per_user_limit: number | null;
  is_active: boolean;
}

const DISCOUNT_TYPES: { value: DiscountType; label: string }[] = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'fixed', label: 'Fixed Amount (₹)' },
];

@Component({
  selector: 'app-admin-coupons',
  standalone: true,
  imports: [
    CommonModule, FormsModule, BadgeComponent, SpinnerComponent,
    ButtonComponent, ModalComponent, AlertComponent, InputComponent, SelectComponent,
  ],
  template: `
<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Coupons</h1>
      <p class="page-sub">Create discount codes customers can apply at checkout — configure eligible packages, validity and usage limits.</p>
    </div>
    <app-button variant="primary" (click)="openCreate()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Coupon
    </app-button>
  </div>

  @if (error()) { <app-alert variant="error" [dismissible]="true" (dismiss)="error.set('')">{{ error() }}</app-alert> }
  @if (notice()) { <app-alert variant="success" [dismissible]="true" (dismiss)="notice.set('')">{{ notice() }}</app-alert> }

  @if (loading()) {
    <div class="load-wrap"><app-spinner size="md" /></div>
  } @else {
    @if (coupons().length === 0) {
      <div class="empty-card">No coupons yet. Click "Add Coupon" to create your first discount code.</div>
    } @else {
      <div class="list">
        @for (c of coupons(); track c.id) {
          <div class="row" [class.inactive]="!c.is_active">
            <div class="row-main">
              <div class="row-title">{{ c.code }}</div>
              <div class="row-sub">{{ packageNames(c) }}</div>
              <div class="row-meta">
                <app-badge [color]="'info'" size="sm">{{ discountLabel(c) }}</app-badge>
                <app-badge [color]="c.is_active ? 'success' : 'warning'" size="sm">{{ c.is_active ? 'Active' : 'Inactive' }}</app-badge>
                <app-badge [color]="'default'" size="sm">{{ c.times_used }}{{ c.usage_limit ? ' / ' + c.usage_limit : '' }} used</app-badge>
                @if (isExpired(c)) { <app-badge [color]="'error'" size="sm">Expired</app-badge> }
              </div>
            </div>
            <div class="row-actions">
              <button class="act-btn" (click)="toggleActive(c)">{{ c.is_active ? 'Deactivate' : 'Activate' }}</button>
              <button class="act-btn" (click)="openEdit(c)">Edit</button>
              <button class="act-btn danger" (click)="remove(c)">Delete</button>
            </div>
          </div>
        }
      </div>
    }
  }

  <!-- ── Create / Edit modal ─────────────────────────────────────────────── -->
  <app-modal [isOpen]="showModal()" [title]="editId() ? 'Edit Coupon' : 'Add Coupon'" size="xl" (close)="closeModal()">
    <div class="form-grid">
      <app-input label="Coupon Code" icon="local_offer" placeholder="e.g. HEALTH100" [(ngModel)]="f.code" />
      <div class="active-toggle">
        <label class="pkg-item">
          <input type="checkbox" [(ngModel)]="f.is_active" />
          <span>Active</span>
        </label>
      </div>

      <app-select label="Discount Type" [options]="discountTypes" [(ngModel)]="f.discount_type" />
      <app-input
        [label]="f.discount_type === 'percentage' ? 'Discount Value (%)' : 'Discount Value (₹)'"
        type="number"
        [(ngModel)]="f.discount_value"
      />

      <app-input label="Valid From" type="datetime-local" [(ngModel)]="f.valid_from" hint="Leave blank to start immediately." />
      <app-input label="Valid Until" type="datetime-local" [(ngModel)]="f.valid_until" hint="Leave blank for no expiry." />

      <app-input label="Total Usage Limit" type="number" [(ngModel)]="f.usage_limit" hint="Leave blank for unlimited." />
      <app-input label="Per-User Limit" type="number" [(ngModel)]="f.per_user_limit" hint="Leave blank for unlimited." />

      <div class="span2">
        <label class="pkg-label">Applicable Health Package(s)</label>
        @if (packagesLoading()) {
          <p class="hint">Loading packages…</p>
        } @else if (!packages().length) {
          <p class="hint">No packages found.</p>
        } @else {
          <div class="pkg-list">
            @for (pkg of packages(); track pkg.id) {
              <label class="pkg-item">
                <input type="checkbox" [checked]="isPackageSelected(pkg.id)" (change)="togglePackage(pkg.id)" />
                <span>{{ pkg.name }}</span>
              </label>
            }
          </div>
        }
      </div>
    </div>

    @if (formErr()) { <p class="form-err">{{ formErr() }}</p> }
    <div modal-footer>
      <app-button variant="primary" (click)="save()" [loading]="saving()">{{ editId() ? 'Save Changes' : 'Create Coupon' }}</app-button>
    </div>
  </app-modal>
</div>`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; }
    .page-title { font-size:1.5rem; font-weight:700; color:#0F172A; margin:0 0 0.25rem 0; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }
    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .empty-card { text-align:center; padding:3rem; color:#94A3B8; font-size:0.875rem; background:#FFF; border:2px dashed #E2E8F0; border-radius:1rem; }

    .list { display:flex; flex-direction:column; gap:0.75rem; }
    .row { display:flex; align-items:center; gap:1rem; background:#FFF; border:1px solid #F1F5F9; border-radius:1rem; padding:0.875rem 1rem; transition:box-shadow 150ms, border-color 150ms; }
    .row:hover { border-color:#84A6FF; box-shadow:0 4px 6px -1px rgba(0,0,0,.08); }
    .row.inactive { opacity:.65; }
    .row-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:0.35rem; }
    .row-title { font-weight:700; letter-spacing:0.02em; color:#0F172A; font-size:1rem; }
    .row-sub { font-size:0.8rem; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .row-meta { display:flex; gap:0.4rem; flex-wrap:wrap; }
    .row-actions { display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end; }
    .act-btn { padding:0.4rem 0.65rem; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFF; font-size:0.75rem; font-weight:500; color:#475569; cursor:pointer; transition:all 150ms; white-space:nowrap; }
    .act-btn:hover { background:#EEF4FF; border-color:#84A6FF; color:#002577; }
    .act-btn.danger:hover { background:#FEF2F2; border-color:#FCA5A5; color:#DC2626; }

    .form-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1rem; align-items:start; }
    .span2 { grid-column:span 2; }
    .active-toggle { display:flex; align-items:center; }

    .pkg-label { font-size:0.8rem; font-weight:500; color:#0F172A; display:block; margin-bottom:0.375rem; }
    .pkg-list { display:grid; grid-template-columns:repeat(2,1fr); gap:0.5rem; max-height:180px; overflow-y:auto; border:1px solid #E2E8F0; border-radius:0.5rem; padding:0.75rem; }
    .pkg-item { display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:#334155; cursor:pointer; }
    .hint { font-size:0.8rem; color:#94A3B8; margin:0; }

    .form-err { font-size:0.875rem; color:#DC2626; margin:0.75rem 0 0; }

    @media (max-width:720px) {
      .form-grid { grid-template-columns:1fr; }
      .span2 { grid-column:span 1; }
      .row { flex-wrap:wrap; }
    }
  `],
})
export class AdminCouponsComponent implements OnInit {
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  notice = signal('');
  formErr = signal('');
  coupons = signal<Coupon[]>([]);
  showModal = signal(false);
  editId = signal<string | null>(null);
  packages = signal<Package[]>([]);
  packagesLoading = signal(false);

  discountTypes = DISCOUNT_TYPES;
  f: CouponForm = this.blank();

  constructor(
    private api: CouponApiService,
    private packageApi: PackageApiService,
    private confirm: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadPackages();
  }

  private blank(): CouponForm {
    return {
      code: '', discount_type: 'fixed', discount_value: 0, package_ids: [],
      valid_from: '', valid_until: '', usage_limit: null, per_user_limit: null,
      is_active: true,
    };
  }

  private loadPackages(): void {
    this.packagesLoading.set(true);
    this.packageApi.list({ page_size: 100 }).subscribe({
      next: (res) => { this.packages.set(res.items ?? []); this.packagesLoading.set(false); },
      error: () => this.packagesLoading.set(false),
    });
  }

  isPackageSelected(id: string): boolean {
    return this.f.package_ids.includes(id);
  }

  togglePackage(id: string): void {
    this.f.package_ids = this.isPackageSelected(id)
      ? this.f.package_ids.filter((p) => p !== id)
      : [...this.f.package_ids, id];
  }

  packageNames(c: Coupon): string {
    if (!c.package_ids.length) return 'No packages linked';
    const names = c.package_ids
      .map((id) => this.packages().find((p) => p.id === id)?.name)
      .filter(Boolean);
    return names.length ? names.join(', ') : `${c.package_ids.length} package(s)`;
  }

  discountLabel(c: Coupon): string {
    return c.discount_type === 'percentage' ? `${c.discount_value}% off` : `₹${c.discount_value} off`;
  }

  isExpired(c: Coupon): boolean {
    return !!c.valid_until && new Date(c.valid_until).getTime() < Date.now();
  }

  load(): void {
    this.loading.set(true);
    this.api.listAll().subscribe({
      next: (list) => { this.coupons.set(list); this.loading.set(false); },
      error: () => { this.error.set('Failed to load coupons.'); this.loading.set(false); },
    });
  }

  openCreate(): void {
    this.editId.set(null);
    this.f = this.blank();
    this.formErr.set('');
    this.showModal.set(true);
  }

  openEdit(c: Coupon): void {
    this.editId.set(c.id);
    this.f = {
      code: c.code,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      package_ids: [...c.package_ids],
      valid_from: c.valid_from ? isoToIstDatetimeLocal(c.valid_from) : '',
      valid_until: c.valid_until ? isoToIstDatetimeLocal(c.valid_until) : '',
      usage_limit: c.usage_limit ?? null,
      per_user_limit: c.per_user_limit ?? null,
      is_active: c.is_active,
    };
    this.formErr.set('');
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editId.set(null);
    this.formErr.set('');
  }

  private buildPayload(): CouponPayload {
    return {
      code: this.f.code.trim().toUpperCase(),
      discount_type: this.f.discount_type,
      discount_value: Number(this.f.discount_value) || 0,
      package_ids: this.f.package_ids,
      valid_from: this.f.valid_from ? istDatetimeLocalToUtcIso(this.f.valid_from) : null,
      valid_until: this.f.valid_until ? istDatetimeLocalToUtcIso(this.f.valid_until) : null,
      usage_limit: this.f.usage_limit || null,
      per_user_limit: this.f.per_user_limit || null,
      is_active: this.f.is_active,
    };
  }

  save(): void {
    if (this.f.code.trim().length < 3) {
      this.formErr.set('Enter a coupon code of at least 3 characters.');
      return;
    }
    if (!this.f.discount_value || Number(this.f.discount_value) <= 0) {
      this.formErr.set('Enter a discount value greater than 0.');
      return;
    }
    this.formErr.set('');
    this.notice.set('');
    this.error.set('');
    this.saving.set(true);
    const payload = this.buildPayload();
    const id = this.editId();
    const obs = id ? this.api.update(id, payload) : this.api.create(payload);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.notice.set(id ? 'Coupon updated.' : 'Coupon created.');
        this.load();
      },
      error: (err) => {
        this.formErr.set(err.error?.detail?.message || 'Failed to save coupon. Please try again.');
        this.saving.set(false);
      },
    });
  }

  async toggleActive(c: Coupon): Promise<void> {
    const ok = await this.confirm.askLiveChange(
      'Checkout coupon validation',
      [c.is_active ? `Deactivate coupon "${c.code}"` : `Activate coupon "${c.code}"`],
    );
    if (!ok) return;
    this.api.update(c.id, { is_active: !c.is_active }).subscribe({
      next: () => { this.notice.set(c.is_active ? 'Coupon deactivated.' : 'Coupon activated.'); this.load(); },
      error: () => this.error.set('Failed to update coupon.'),
    });
  }

  async remove(c: Coupon): Promise<void> {
    const ok = await this.confirm.askDelete(`coupon "${c.code}"`, 'This cannot be undone.');
    if (!ok) return;
    this.api.delete(c.id).subscribe({
      next: () => { this.notice.set('Coupon deleted.'); this.load(); },
      error: (err) => this.error.set(err?.error?.detail?.message ?? 'Failed to delete coupon.'),
    });
  }
}
