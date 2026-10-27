import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { from, Observable, of } from 'rxjs';
import { catchError, map, mergeMap, tap, toArray } from 'rxjs/operators';
import { ServiceArea } from '../../../core/api/api.types';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { InputComponent } from '../../../shared/components/input/input.component';

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  action: () => void;
}

interface OpResult {
  id: string;
  ok: boolean;
  msg?: string;
}

@Component({
  selector: 'app-admin-service-areas',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent, SpinnerComponent, ButtonComponent, ModalComponent, AlertComponent, InputComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div><h1 class="page-title">Service Areas</h1><p class="page-sub">Manage serviceable pincodes for home collection</p></div>
    <app-button variant="primary" (click)="openCreate()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Area
    </app-button>
  </div>
  @if (error()) { <app-alert variant="error" [dismissible]="true" (dismiss)="error.set('')">{{ error() }}</app-alert> }
  @if (toast()) { <app-alert variant="success" [dismissible]="true" (dismiss)="toast.set('')">{{ toast() }}</app-alert> }

  <div class="filter-bar">
    <div class="search-field">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input placeholder="Search city, area, taluk, district, pincode…" [(ngModel)]="searchQ" (input)="applyFilter()" />
    </div>
    <select class="filter-select" [(ngModel)]="filterState" (change)="applyFilter()" aria-label="Filter by state">
      <option value="">All states</option>
      @for (s of states(); track s) { <option [value]="s">{{ s }}</option> }
    </select>
    <select class="filter-select" [(ngModel)]="filterDistrict" (change)="applyFilter()" aria-label="Filter by district">
      <option value="">All districts</option>
      @for (d of districts(); track d) { <option [value]="d">{{ d }}</option> }
    </select>
    <select class="filter-select" [(ngModel)]="filterStatus" (change)="applyFilter()" aria-label="Filter by status">
      <option value="">All status</option>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
    @if (searchQ || filterState || filterDistrict || filterStatus) {
      <button class="clear-filters" (click)="clearFilters()">Clear filters</button>
    }
    <span class="count-badge">{{ filtered().length }} areas</span>
  </div>

  @if (selectedCount() > 0) {
    <div class="bulk-bar">
      <span class="bulk-count">{{ selectedCount() }} service area{{ selectedCount() === 1 ? '' : 's' }} selected</span>
      @if (progress(); as p) {
        <span class="bulk-progress">Processing {{ p.done }} of {{ p.total }}…</span>
      }
      <div class="bulk-acts">
        <app-button variant="outline" size="sm" [disabled]="busy()" (click)="bulkSetActive(true)">Enable Selected</app-button>
        <app-button variant="outline" size="sm" [disabled]="busy()" (click)="bulkSetActive(false)">Disable Selected</app-button>
        <app-button variant="danger" size="sm" [disabled]="busy()" (click)="bulkDelete()">Delete Selected</app-button>
        <app-button variant="ghost" size="sm" [disabled]="busy()" (click)="clearSelection()">Clear</app-button>
      </div>
    </div>
  }

  @if (loading()) { <div class="load-wrap"><app-spinner size="md" /></div>
  } @else {
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr>
          <th class="chk-col">
            <input type="checkbox" class="chk" aria-label="Select all service areas"
              [checked]="allSelected()"
              [indeterminate]="selectedCount() > 0 && !allSelected()"
              [disabled]="busy() || filtered().length === 0"
              (change)="toggleAll($event)" />
          </th>
          <th>City</th><th>Area</th><th>Taluk</th><th>District</th><th>State</th><th>Pincode</th><th>Status</th><th>Added</th><th>Actions</th>
        </tr></thead>
        <tbody>
          @if (filtered().length === 0) { <tr><td colspan="10" class="empty-td">No service areas found.</td></tr> }
          @for (a of filtered(); track a.id) {
            <tr [class.row-selected]="selected().has(a.id)">
              <td class="chk-col">
                <input type="checkbox" class="chk" [attr.aria-label]="'Select ' + a.city + ' ' + a.pincode"
                  [checked]="selected().has(a.id)"
                  [disabled]="busy()"
                  (change)="toggleRow(a.id)" />
              </td>
              <td class="fw-med">{{ a.city }}</td>
              <td>{{ a.area || '—' }}</td>
              <td>{{ a.taluk || '—' }}</td>
              <td>{{ a.district }}</td>
              <td>{{ a.state || '—' }}</td>
              <td class="mono">{{ a.pincode }}</td>
              <td><app-badge [color]="a.is_active ? 'success' : 'error'" size="sm">{{ a.is_active ? 'Active' : 'Inactive' }}</app-badge></td>
              <td class="text-sm text-muted">{{ a.created_at | date:'dd MMM yyyy' }}</td>
              <td>
                <div class="row-acts">
                  <button class="act-btn" [disabled]="busy()" (click)="toggleActive(a)">{{ a.is_active ? 'Disable' : 'Enable' }}</button>
                  <button class="act-btn danger" [disabled]="busy()" (click)="remove(a)">Delete</button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }

  <app-modal [isOpen]="showModal()" title="Add Service Area" size="md" (close)="closeModal()">
    <div class="form-grid">
      <app-input label="City" [required]="true" icon="apartment" placeholder="e.g. Hyderabad" [(ngModel)]="f.city" />
      <app-input label="Area" icon="place" placeholder="e.g. Gachibowli" [(ngModel)]="f.area" />
      <app-input label="Taluk" icon="map" placeholder="e.g. Serilingampally" [(ngModel)]="f.taluk" />
      <app-input label="District" [required]="true" icon="location_city" placeholder="e.g. Rangareddy" [(ngModel)]="f.district" />
      <app-input label="State" icon="public" placeholder="e.g. Telangana" [(ngModel)]="f.state" />
      <app-input label="Pincode" [required]="true" icon="pin_drop" inputmode="numeric" [maxlength]="6" placeholder="6-digit pincode" [(ngModel)]="f.pincode" />
    </div>
    @if (formErr()) { <p class="form-err">{{ formErr() }}</p> }
    <div modal-footer>
      <app-button variant="outline" (click)="closeModal()">Cancel</app-button>
      <app-button variant="primary" [loading]="saving()" (click)="save()">Add Area</app-button>
    </div>
  </app-modal>

  <app-modal [isOpen]="confirmState() !== null" [title]="confirmState()?.title || ''" size="sm" (close)="closeConfirm()">
    <p class="confirm-msg">{{ confirmState()?.message }}</p>
    <div modal-footer>
      <app-button variant="outline" [disabled]="busy()" (click)="closeConfirm()">Cancel</app-button>
      <app-button variant="danger" [loading]="busy()" (click)="runConfirm()">{{ confirmState()?.confirmLabel }}</app-button>
    </div>
  </app-modal>
</div>`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; }
    .page-title { font-size:1.5rem; font-weight:700; color:#0F172A; margin:0 0 0.25rem 0; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }
    .filter-bar { display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap; }
    .search-field { display:flex; align-items:center; gap:0.5rem; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:0.75rem; padding:0.625rem 1rem; flex:1; min-width:220px; svg { width:18px; height:18px; color:#94A3B8; flex-shrink:0; } input { border:none; outline:none; font-size:0.875rem; color:#0F172A; background:transparent; width:100%; } &:focus-within { border-color:#0047CC; } }
    .filter-select { background:#FFFFFF; border:1px solid #E2E8F0; border-radius:0.75rem; padding:0.625rem 0.875rem; font-size:0.875rem; color:#0F172A; cursor:pointer; outline:none; &:focus { border-color:#0047CC; } }
    .clear-filters { background:transparent; border:none; font-size:0.8125rem; font-weight:500; color:#0047CC; cursor:pointer; padding:0.375rem 0.5rem; &:hover { text-decoration:underline; } }
    .count-badge { font-size:0.875rem; color:#94A3B8; white-space:nowrap; font-weight:500; }
    .bulk-bar { display:flex; align-items:center; gap:1rem; background:#EEF4FF; border:1px solid #84A6FF; border-radius:0.75rem; padding:0.625rem 1rem; flex-wrap:wrap; }
    .bulk-count { font-size:0.875rem; font-weight:600; color:#002577; }
    .bulk-progress { font-size:0.8125rem; color:#002577; }
    .bulk-acts { display:flex; gap:0.5rem; margin-left:auto; flex-wrap:wrap; }
    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .table-wrap { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; overflow:hidden; }
    .tbl { width:100%; border-collapse:collapse; thead tr { background:#F8FAFC; } th { padding:0.75rem 1rem; text-align:left; font-size:0.75rem; font-weight:600; color:#94A3B8; text-transform:uppercase; letter-spacing:0.025em; border-bottom:1px solid #F1F5F9; } td { padding:0.875rem 1rem; border-bottom:1px solid #F1F5F9; font-size:0.875rem; color:#0F172A; } tbody tr:last-child td { border-bottom:none; } tbody tr:hover td { background:#F8FAFC; } tbody tr.row-selected td { background:#EEF4FF; } }
    .chk-col { width:2.5rem; padding-right:0 !important; }
    .chk { width:1rem; height:1rem; accent-color:#0047CC; cursor:pointer; &:disabled { cursor:not-allowed; } }
    .fw-med { font-weight:500; }
    .mono { font-family:'JetBrains Mono','SF Mono','Fira Code',monospace; font-size:0.75rem; letter-spacing:0.025em; }
    .text-sm { font-size:0.875rem; }
    .text-muted { color:#94A3B8; }
    .empty-td { text-align:center; color:#94A3B8; padding:3rem !important; }
    .row-acts { display:flex; gap:0.5rem; }
    .act-btn { display:inline-flex; padding:0.375rem 0.75rem; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFFFFF; font-size:0.75rem; font-weight:500; color:#475569; cursor:pointer; transition:all 150ms; &:hover:not(:disabled) { background:#EEF4FF; border-color:#84A6FF; color:#002577; } &.danger:hover:not(:disabled) { background:#FEF2F2; border-color:#FCA5A5; color:#DC2626; } &:disabled { opacity:0.5; cursor:not-allowed; } }
    .confirm-msg { font-size:0.9375rem; color:#334155; margin:0; line-height:1.5; }
    .form-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1rem; }
    .span2 { grid-column:span 2; }
    .form-err { font-size:0.875rem; color:#DC2626; margin:0.5rem 0 0 0; }
  `]
})
export class AdminServiceAreasComponent implements OnInit {
  loading = signal(false); saving = signal(false); error = signal(''); formErr = signal('');
  all = signal<ServiceArea[]>([]); filtered = signal<ServiceArea[]>([]);
  showModal = signal(false); searchQ = '';
  filterState = ''; filterDistrict = ''; filterStatus = '';
  f = { city:'', area:'', taluk:'', district:'', state:'', pincode:'' };

  states = computed(() =>
    [...new Set(this.all().map(a => a.state).filter(Boolean))].sort((x, y) => x!.localeCompare(y!))
  );
  districts = computed(() =>
    [...new Set(this.all().map(a => a.district).filter(Boolean))].sort((x, y) => x.localeCompare(y))
  );

  toast = signal('');
  busy = signal(false);
  selected = signal<Set<string>>(new Set());
  progress = signal<{ done: number; total: number } | null>(null);
  confirmState = signal<ConfirmState | null>(null);

  selectedCount = computed(() => this.selected().size);
  allSelected = computed(() => {
    const rows = this.filtered();
    return rows.length > 0 && rows.every(a => this.selected().has(a.id));
  });

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private http: HttpClient) {}
  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    const p = new HttpParams().set('page_size', '500');
    this.http.get<any>('/service-areas', { params: p }).subscribe({
      next: r => {
        this.all.set(r.items || r);
        this.applyFilter();
        // Drop selections that no longer exist (e.g. deleted rows)
        const ids = new Set(this.all().map(a => a.id));
        this.selected.set(new Set([...this.selected()].filter(id => ids.has(id))));
        this.loading.set(false);
      },
      error: err => { this.error.set(this.errMsg(err, 'Failed to load service areas.')); this.loading.set(false); }
    });
  }

  applyFilter() {
    const q = this.searchQ.trim().toLowerCase();
    const state = this.filterState;
    const dist = this.filterDistrict;
    const status = this.filterStatus;
    this.filtered.set(this.all().filter(a => {
      if (state && a.state !== state) return false;
      if (dist && a.district !== dist) return false;
      if (status === 'active' && !a.is_active) return false;
      if (status === 'inactive' && a.is_active) return false;
      if (q) {
        const hay = [a.city, a.area, a.taluk, a.district, a.state, a.pincode]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }));
  }
  clearFilters() { this.searchQ = ''; this.filterState = ''; this.filterDistrict = ''; this.filterStatus = ''; this.applyFilter(); }
  openCreate() { this.f = { city:'', area:'', taluk:'', district:'', state:'', pincode:'' }; this.formErr.set(''); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); }

  save() {
    if (!this.f.city.trim() || !this.f.pincode.trim()) { this.formErr.set('City and pincode are required.'); return; }
    if (!/^\d{6}$/.test(this.f.pincode)) { this.formErr.set('Pincode must be 6 digits.'); return; }
    this.saving.set(true);
    this.http.post('/service-areas', this.f).subscribe({
      next: () => { this.saving.set(false); this.closeModal(); this.showToast('Service area added.'); this.load(); },
      error: err => { this.formErr.set(this.errMsg(err, 'Failed to save.')); this.saving.set(false); }
    });
  }

  // --- selection ---

  toggleRow(id: string) {
    const next = new Set(this.selected());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selected.set(next);
  }

  toggleAll(ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    const next = new Set(this.selected());
    for (const a of this.filtered()) checked ? next.add(a.id) : next.delete(a.id);
    this.selected.set(next);
  }

  clearSelection() { this.selected.set(new Set()); }

  // --- confirm dialog ---

  private askConfirm(state: ConfirmState) { this.confirmState.set(state); }
  closeConfirm() { if (!this.busy()) this.confirmState.set(null); }
  runConfirm() {
    const state = this.confirmState();
    if (!state || this.busy()) return;
    state.action();
  }

  // --- single-row actions ---

  toggleActive(a: ServiceArea) {
    if (this.busy()) return;
    if (a.is_active) {
      this.askConfirm({
        title: 'Disable Service Area',
        message: `Disable ${a.city} - ${a.pincode}? Customers in this pincode will no longer be able to book home collection.`,
        confirmLabel: 'Disable',
        action: () => this.doSetActive(a, false)
      });
    } else {
      this.doSetActive(a, true);
    }
  }

  private doSetActive(a: ServiceArea, active: boolean) {
    this.busy.set(true);
    this.http.put(`/service-areas/${a.id}`, { is_active: active }).subscribe({
      next: () => {
        this.busy.set(false);
        this.confirmState.set(null);
        this.showToast(`${a.city} - ${a.pincode} ${active ? 'enabled' : 'disabled'}.`);
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.confirmState.set(null);
        this.error.set(this.errMsg(err, `Failed to ${active ? 'enable' : 'disable'} ${a.city} - ${a.pincode}.`));
      }
    });
  }

  remove(a: ServiceArea) {
    if (this.busy()) return;
    this.askConfirm({
      title: 'Delete Service Area',
      message: `Delete ${a.city} - ${a.pincode}? This permanently removes the service area and cannot be undone.`,
      confirmLabel: 'Delete',
      action: () => {
        this.busy.set(true);
        this.http.delete(`/service-areas/${a.id}`).subscribe({
          next: () => {
            this.busy.set(false);
            this.confirmState.set(null);
            this.showToast(`${a.city} - ${a.pincode} deleted.`);
            this.load();
          },
          error: err => {
            this.busy.set(false);
            this.confirmState.set(null);
            this.error.set(this.errMsg(err, `Failed to delete ${a.city} - ${a.pincode}.`));
          }
        });
      }
    });
  }

  // --- bulk actions ---

  bulkSetActive(active: boolean) {
    if (this.busy() || this.selectedCount() === 0) return;
    const run = () => this.runBulk(
      id => this.http.put(`/service-areas/${id}`, { is_active: active }),
      active ? 'enabled' : 'disabled'
    );
    if (active) { run(); return; }
    this.askConfirm({
      title: 'Disable Selected',
      message: `Disable ${this.selectedCount()} service area${this.selectedCount() === 1 ? '' : 's'}? Customers in these pincodes will no longer be able to book home collection.`,
      confirmLabel: 'Disable',
      action: run
    });
  }

  bulkDelete() {
    if (this.busy() || this.selectedCount() === 0) return;
    this.askConfirm({
      title: 'Delete Selected',
      message: `Delete ${this.selectedCount()} service area${this.selectedCount() === 1 ? '' : 's'}? This permanently removes them and cannot be undone.`,
      confirmLabel: 'Delete',
      action: () => this.runBulk(id => this.http.delete(`/service-areas/${id}`), 'deleted')
    });
  }

  private runBulk(makeReq: (id: string) => Observable<unknown>, verb: string) {
    const ids = [...this.selected()];
    this.busy.set(true);
    this.error.set('');
    this.progress.set({ done: 0, total: ids.length });

    from(ids).pipe(
      mergeMap(id =>
        makeReq(id).pipe(
          map((): OpResult => ({ id, ok: true })),
          catchError((err: HttpErrorResponse) => of<OpResult>({ id, ok: false, msg: this.errMsg(err, 'Request failed') })),
          tap(() => {
            const p = this.progress();
            if (p) this.progress.set({ done: p.done + 1, total: p.total });
          })
        ), 4),
      toArray()
    ).subscribe(results => {
      this.busy.set(false);
      this.progress.set(null);
      this.confirmState.set(null);

      const failed = results.filter(r => !r.ok);
      const okCount = results.length - failed.length;
      if (failed.length === 0) {
        this.clearSelection();
        this.showToast(`${okCount} service area${okCount === 1 ? '' : 's'} ${verb}.`);
      } else {
        // Keep failed rows selected so the user can retry them
        this.selected.set(new Set(failed.map(r => r.id)));
        const suffix = failed[0].msg ? ` First error: ${failed[0].msg}` : '';
        this.error.set(`${okCount} of ${results.length} ${verb}; ${failed.length} failed and remain selected.${suffix}`);
        if (okCount > 0) this.showToast(`${okCount} service area${okCount === 1 ? '' : 's'} ${verb}.`);
      }
      this.load();
    });
  }

  // --- helpers ---

  private showToast(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 4000);
  }

  private errMsg(err: HttpErrorResponse, fallback: string): string {
    const detail = err?.error?.detail;
    if (typeof detail === 'string') return detail;
    if (detail?.message) return detail.message;
    if (err?.status === 0) return 'Cannot reach the server. Check your connection.';
    if (err?.status === 401 || err?.status === 403) return 'You are not authorized to perform this action.';
    return fallback;
  }
}
