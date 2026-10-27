import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { PrescriptionApiService } from '../../../core/api/services/prescription-api.service';
import { PrescriptionRequest, PrescriptionStats, PrescriptionStatus } from '../../../core/api/api.types';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-admin-prescription-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, BadgeComponent, SpinnerComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Prescription Requests</h1>
      <p class="page-sub">Prescriptions uploaded via the "Upload Prescription" dialog — call back within 30 minutes</p>
    </div>
    <div class="header-actions">
      <button class="exp-btn" (click)="export('xlsx')" [disabled]="exporting()">
        <mat-icon>grid_on</mat-icon> Excel
      </button>
      <button class="exp-btn" (click)="export('pdf')" [disabled]="exporting()">
        <mat-icon>picture_as_pdf</mat-icon> PDF
      </button>
    </div>
  </div>

  @if (stats(); as s) {
    <div class="stats-row">
      <div class="mini-stat"><span class="ms-value">{{ s.today_requests }}</span><span class="ms-label">Today's Requests</span></div>
      <div class="mini-stat"><span class="ms-value">{{ s.pending_calls }}</span><span class="ms-label">Pending Calls</span></div>
      <div class="mini-stat"><span class="ms-value">{{ s.booked_from_prescription }}</span><span class="ms-label">Booked</span></div>
      <div class="mini-stat"><span class="ms-value">{{ s.conversion_rate }}%</span><span class="ms-label">Conversion</span></div>
    </div>
  }

  <div class="filter-bar">
    <div class="search-box">
      <mat-icon>search</mat-icon>
      <input type="text" placeholder="Search name, mobile, city, request ID…"
             [(ngModel)]="search" (keyup.enter)="onFilterChange()" />
      @if (search) {
        <button class="clear-btn" (click)="search=''; onFilterChange()" aria-label="Clear search">
          <mat-icon>close</mat-icon>
        </button>
      }
    </div>
    <select class="filter-sel" [(ngModel)]="statusFilter" (change)="onFilterChange()">
      <option value="">All Status</option>
      <option value="new">New</option>
      <option value="called">Called</option>
      <option value="booked">Booked</option>
      <option value="cancelled">Cancelled</option>
    </select>
  </div>

  @if (loading()) {
    <div class="load-wrap"><app-spinner size="md" /></div>
  } @else {
    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Request ID</th>
            <th class="sortable" (click)="onSort('patient_name')">Patient {{ sortIcon('patient_name') }}</th>
            <th>Mobile</th>
            <th class="sortable" (click)="onSort('city')">City {{ sortIcon('city') }}</th>
            <th>Files</th>
            <th class="sortable" (click)="onSort('created_at')">Created {{ sortIcon('created_at') }}</th>
            <th class="sortable" (click)="onSort('status')">Status {{ sortIcon('status') }}</th>
            <th>Assigned To</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @if (requests().length === 0) {
            <tr><td colspan="9" class="empty-td">No prescription requests found</td></tr>
          }
          @for (r of requests(); track r.id) {
            <tr>
              <td class="mono">{{ r.request_number }}</td>
              <td>{{ r.patient_name }}</td>
              <td class="mono">{{ r.mobile }}</td>
              <td>{{ r.city }}</td>
              <td><span class="files-pill"><mat-icon>attach_file</mat-icon>{{ r.files.length }}</span></td>
              <td class="text-sm text-muted">{{ r.created_at | date:'dd MMM yyyy, h:mm a' }}</td>
              <td><app-badge [color]="statusColor(r.status)" size="sm">{{ r.status | titlecase }}</app-badge></td>
              <td>{{ r.assigned_to || '—' }}</td>
              <td>
                <div class="row-actions">
                  <button class="act-btn" (click)="openDetail(r)" title="View & Download Files">
                    <mat-icon>visibility</mat-icon>
                  </button>
                  @if (r.status === 'new') {
                    <button class="act-btn success" (click)="updateStatus(r, 'called')" title="Call Completed">
                      <mat-icon>phone_in_talk</mat-icon>
                    </button>
                  }
                  @if (r.status === 'new' || r.status === 'called') {
                    <button class="act-btn book" (click)="updateStatus(r, 'booked')" title="Convert to Booking">
                      <mat-icon>event_available</mat-icon>
                    </button>
                    <button class="act-btn warn" (click)="updateStatus(r, 'cancelled')" title="Cancel">
                      <mat-icon>cancel</mat-icon>
                    </button>
                  }
                  <button class="act-btn danger" (click)="confirmDelete(r)" title="Delete">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (total() > pageSize) {
      <div class="pagination">
        <button class="pg-btn" [disabled]="page() === 1" (click)="onPage(page()-1)">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <span class="pg-info">Page {{ page() }} of {{ totalPages() }} · {{ total() }} requests</span>
        <button class="pg-btn" [disabled]="page() >= totalPages()" (click)="onPage(page()+1)">
          <mat-icon>chevron_right</mat-icon>
        </button>
      </div>
    }
  }
</div>

<!-- ── Detail drawer ── -->
@if (detail(); as d) {
  <div class="dd-backdrop" (click)="closeDetail()"></div>
  <div class="dd-panel" role="dialog" aria-modal="true" aria-label="Prescription request detail">
    <div class="dd-head">
      <div>
        <h3>{{ d.request_number }}</h3>
        <app-badge [color]="statusColor(d.status)" size="sm">{{ d.status | titlecase }}</app-badge>
      </div>
      <button class="dd-close" (click)="closeDetail()" aria-label="Close"><mat-icon>close</mat-icon></button>
    </div>

    @if (detailLoading()) {
      <div class="load-wrap"><app-spinner size="md" /></div>
    } @else {
      <div class="dd-body">
        <div class="dd-grid">
          <div class="dd-item"><span class="dd-k">Patient</span><span class="dd-v">{{ d.patient_name }}</span></div>
          <div class="dd-item"><span class="dd-k">Mobile</span><span class="dd-v mono">{{ d.mobile }} @if (d.otp_verified) { <mat-icon class="dd-verified" title="OTP verified">verified</mat-icon> }</span></div>
          <div class="dd-item"><span class="dd-k">City</span><span class="dd-v">{{ d.city }}</span></div>
          <div class="dd-item"><span class="dd-k">Email</span><span class="dd-v">{{ d.email || '—' }}</span></div>
          <div class="dd-item"><span class="dd-k">Callback Time</span><span class="dd-v">{{ d.callback_time || 'Any time' }}</span></div>
          <div class="dd-item"><span class="dd-k">Source</span><span class="dd-v">{{ d.source }}</span></div>
          <div class="dd-item"><span class="dd-k">Created</span><span class="dd-v">{{ d.created_at | date:'dd MMM yyyy, h:mm a' }}</span></div>
          <div class="dd-item"><span class="dd-k">Updated</span><span class="dd-v">{{ d.updated_at | date:'dd MMM yyyy, h:mm a' }}</span></div>
        </div>

        <div class="dd-section">
          <span class="dd-k">Prescription Files ({{ d.files.length }})</span>
          @for (f of d.files; track f.id) {
            <a class="dd-file" [href]="fileHref(f.download_url)" target="_blank" rel="noopener">
              <mat-icon>{{ f.content_type === 'application/pdf' ? 'picture_as_pdf' : 'image' }}</mat-icon>
              <span class="dd-file-name">{{ f.file_name }}</span>
              <span class="dd-file-size">{{ formatSize(f.file_size) }}</span>
              <mat-icon class="dd-dl">download</mat-icon>
            </a>
          }
        </div>

        <div class="dd-section">
          <label class="dd-k" for="dd-assign">Assigned To</label>
          <input id="dd-assign" class="dd-input" type="text" [(ngModel)]="assignInput"
                 placeholder="Technician or support member name" maxlength="120" />
        </div>

        <div class="dd-section">
          <label class="dd-k" for="dd-remarks">Remarks</label>
          <textarea id="dd-remarks" class="dd-input" rows="3" [(ngModel)]="remarksInput"
                    placeholder="Internal notes…" maxlength="500"></textarea>
        </div>

        <div class="dd-actions">
          <button class="dd-save" (click)="saveDetail(d)" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save Changes' }}
          </button>
          @if (d.status === 'new') {
            <button class="dd-status called" (click)="updateStatus(d, 'called')">Call Completed</button>
          }
          @if (d.status === 'new' || d.status === 'called') {
            <button class="dd-status booked" (click)="updateStatus(d, 'booked')">Convert to Booking</button>
          }
        </div>
      </div>
    }
  </div>
}

<!-- ── Delete confirmation ── -->
@if (deleteTarget(); as t) {
  <div class="dd-backdrop" (click)="deleteTarget.set(null)"></div>
  <div class="confirm-box" role="alertdialog" aria-modal="true">
    <mat-icon class="confirm-icon">warning_amber</mat-icon>
    <h4>Delete {{ t.request_number }}?</h4>
    <p>This permanently removes the request and its {{ t.files.length }} uploaded file(s).</p>
    <div class="confirm-actions">
      <button class="cf-btn" (click)="deleteTarget.set(null)">Keep</button>
      <button class="cf-btn danger" (click)="doDelete(t)" [disabled]="deleting()">
        {{ deleting() ? 'Deleting…' : 'Delete' }}
      </button>
    </div>
  </div>
}`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; }
    .page-title { font-size:1.5rem; font-weight:700; color:#0F172A; margin:0 0 0.25rem 0; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }
    .header-actions { display:flex; gap:0.5rem; }
    .exp-btn { display:inline-flex; align-items:center; gap:0.4rem; height:38px; padding:0 0.9rem; font-size:0.82rem; font-weight:600; color:#15803d; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:0.65rem; cursor:pointer; transition:all 150ms; }
    .exp-btn mat-icon { font-size:1rem; width:1rem; height:1rem; }
    .exp-btn:hover:not(:disabled) { background:#16a34a; border-color:#16a34a; color:#fff; }
    .exp-btn:disabled { opacity:.5; cursor:not-allowed; }

    .stats-row { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:0.75rem; }
    .mini-stat { display:flex; flex-direction:column; gap:0.15rem; background:#FFFFFF; border:1px solid #F1F5F9; border-left:4px solid #16a34a; border-radius:0.75rem; padding:0.8rem 1rem; }
    .ms-value { font-size:1.4rem; font-weight:700; color:#0F172A; }
    .ms-label { font-size:0.75rem; color:#64748B; font-weight:500; }

    .filter-bar { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
    .search-box { display:flex; align-items:center; gap:0.4rem; height:40px; padding:0 0.75rem; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:0.75rem; flex:1; min-width:220px; max-width:420px; }
    .search-box mat-icon { color:#94A3B8; font-size:1.1rem; width:1.1rem; height:1.1rem; }
    .search-box input { flex:1; min-width:0; border:none; outline:none; font:inherit; font-size:0.875rem; color:#0F172A; background:transparent; }
    .search-box:focus-within { border-color:#16a34a; }
    .clear-btn { display:flex; background:none; border:none; cursor:pointer; color:#94A3B8; padding:0; }
    .clear-btn mat-icon { font-size:1rem; width:1rem; height:1rem; }
    .filter-sel { height:40px; padding:0 1rem; font-size:0.875rem; color:#0F172A; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:0.75rem; cursor:pointer; }
    .filter-sel:focus { outline:none; border-color:#16a34a; }

    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .table-wrap { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; overflow-x:auto; }
    .tbl { width:100%; border-collapse:collapse; min-width:900px; }
    .tbl thead tr { background:#F8FAFC; }
    .tbl th { padding:0.75rem 1rem; text-align:left; font-size:0.75rem; font-weight:600; color:#94A3B8; text-transform:uppercase; letter-spacing:0.025em; border-bottom:1px solid #F1F5F9; white-space:nowrap; }
    .tbl th.sortable { cursor:pointer; user-select:none; }
    .tbl th.sortable:hover { color:#16a34a; }
    .tbl td { padding:0.875rem 1rem; border-bottom:1px solid #F1F5F9; font-size:0.875rem; color:#0F172A; }
    .tbl tbody tr:last-child td { border-bottom:none; }
    .tbl tbody tr:hover td { background:#F8FAFC; }
    .mono { font-family:'JetBrains Mono','SF Mono','Fira Code',monospace; font-size:0.75rem; }
    .text-sm { font-size:0.875rem; }
    .text-muted { color:#94A3B8; }
    .empty-td { text-align:center; color:#94A3B8; padding:3rem !important; }
    .files-pill { display:inline-flex; align-items:center; gap:0.2rem; padding:0.15rem 0.55rem; background:#f0fdf4; color:#15803d; border-radius:999px; font-size:0.75rem; font-weight:700; }
    .files-pill mat-icon { font-size:0.85rem; width:0.85rem; height:0.85rem; }

    .row-actions { display:flex; gap:0.4rem; }
    .act-btn { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFFFFF; cursor:pointer; color:#475569; transition:all 150ms; }
    .act-btn mat-icon { font-size:1rem; width:1rem; height:1rem; }
    .act-btn:hover { border-color:#94A3B8; }
    .act-btn.success { color:#16a34a; }
    .act-btn.success:hover { background:#f0fdf4; border-color:#86efac; }
    .act-btn.book { color:#0047CC; }
    .act-btn.book:hover { background:#EEF4FF; border-color:#B3CAFF; }
    .act-btn.warn { color:#D97706; }
    .act-btn.warn:hover { background:#FFFBEB; border-color:#FCD34D; }
    .act-btn.danger { color:#EF4444; }
    .act-btn.danger:hover { background:#FEF2F2; border-color:#FCA5A5; }

    .pagination { display:flex; align-items:center; justify-content:center; gap:1rem; }
    .pg-btn { display:flex; align-items:center; justify-content:center; width:36px; height:36px; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFFFFF; cursor:pointer; transition:all 150ms; }
    .pg-btn mat-icon { font-size:1.1rem; width:1.1rem; height:1.1rem; }
    .pg-btn:hover:not(:disabled) { border-color:#16a34a; color:#15803d; }
    .pg-btn:disabled { opacity:.4; cursor:not-allowed; }
    .pg-info { font-size:0.875rem; color:#475569; }

    /* Detail drawer */
    .dd-backdrop { position:fixed; inset:0; z-index:900; background:rgba(15,23,42,.45); }
    .dd-panel { position:fixed; top:0; right:0; bottom:0; z-index:901; width:min(460px, 100vw); background:#fff; box-shadow:-16px 0 40px rgba(15,23,42,.18); display:flex; flex-direction:column; animation:dd-in .22s ease; }
    @keyframes dd-in { from { transform:translateX(40px); opacity:.4; } to { transform:translateX(0); opacity:1; } }
    .dd-head { display:flex; align-items:center; justify-content:space-between; padding:1.1rem 1.25rem; border-bottom:1px solid #F1F5F9; }
    .dd-head h3 { margin:0 0 0.3rem; font-size:1.05rem; font-weight:700; color:#0F172A; font-family:'JetBrains Mono','SF Mono',monospace; }
    .dd-close { background:none; border:none; cursor:pointer; color:#94A3B8; border-radius:8px; padding:0.25rem; line-height:0; }
    .dd-close:hover { background:#F8FAFC; color:#0F172A; }
    .dd-body { padding:1.1rem 1.25rem; overflow-y:auto; display:flex; flex-direction:column; gap:1.1rem; }
    .dd-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.8rem; }
    .dd-item { display:flex; flex-direction:column; gap:0.15rem; }
    .dd-k { font-size:0.72rem; font-weight:600; color:#94A3B8; text-transform:uppercase; letter-spacing:0.04em; }
    .dd-v { font-size:0.875rem; color:#0F172A; display:inline-flex; align-items:center; gap:0.25rem; }
    .dd-verified { color:#16a34a; font-size:1rem; width:1rem; height:1rem; }
    .dd-section { display:flex; flex-direction:column; gap:0.45rem; }
    .dd-file { display:flex; align-items:center; gap:0.6rem; padding:0.55rem 0.7rem; border:1px solid #E2E8F0; border-radius:0.65rem; text-decoration:none; color:#0F172A; transition:all 150ms; }
    .dd-file:hover { border-color:#16a34a; background:#f0fdf4; }
    .dd-file mat-icon { color:#15803d; font-size:1.2rem; width:1.2rem; height:1.2rem; }
    .dd-file-name { flex:1; min-width:0; font-size:0.83rem; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .dd-file-size { font-size:0.72rem; color:#94A3B8; }
    .dd-dl { color:#94A3B8 !important; }
    .dd-input { width:100%; padding:0.6rem 0.75rem; border:1px solid #E2E8F0; border-radius:0.65rem; font:inherit; font-size:0.875rem; color:#0F172A; }
    .dd-input:focus { outline:none; border-color:#16a34a; box-shadow:0 0 0 3px rgba(0, 51, 153,.12); }
    textarea.dd-input { resize:vertical; }
    .dd-actions { display:flex; gap:0.5rem; flex-wrap:wrap; }
    .dd-save { padding:0.6rem 1.1rem; background:#16a34a; color:#fff; border:none; border-radius:0.65rem; font:inherit; font-size:0.85rem; font-weight:700; cursor:pointer; }
    .dd-save:hover:not(:disabled) { background:#15803d; }
    .dd-save:disabled { opacity:.6; cursor:not-allowed; }
    .dd-status { padding:0.6rem 1rem; background:#fff; border:1px solid #E2E8F0; border-radius:0.65rem; font:inherit; font-size:0.85rem; font-weight:600; cursor:pointer; transition:all 150ms; }
    .dd-status.called { color:#16a34a; }
    .dd-status.called:hover { border-color:#86efac; background:#f0fdf4; }
    .dd-status.booked { color:#0047CC; }
    .dd-status.booked:hover { border-color:#B3CAFF; background:#EEF4FF; }

    /* Delete confirmation */
    .confirm-box { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:901; width:min(380px, calc(100vw - 2rem)); background:#fff; border-radius:1rem; padding:1.5rem; text-align:center; box-shadow:0 24px 48px rgba(15,23,42,.3); }
    .confirm-icon { color:#D97706; font-size:2.2rem; width:2.2rem; height:2.2rem; }
    .confirm-box h4 { margin:0.5rem 0 0.3rem; font-size:1.05rem; color:#0F172A; }
    .confirm-box p { margin:0 0 1.1rem; font-size:0.85rem; color:#475569; }
    .confirm-actions { display:flex; gap:0.6rem; justify-content:center; }
    .cf-btn { padding:0.55rem 1.3rem; border:1px solid #E2E8F0; background:#fff; border-radius:0.65rem; font:inherit; font-size:0.85rem; font-weight:600; cursor:pointer; }
    .cf-btn.danger { background:#EF4444; border-color:#EF4444; color:#fff; }
    .cf-btn.danger:hover:not(:disabled) { background:#DC2626; }
    .cf-btn.danger:disabled { opacity:.6; cursor:not-allowed; }

    @media (max-width: 640px) {
      .dd-grid { grid-template-columns:1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      .dd-panel { animation:none; }
    }
  `],
})
export class AdminPrescriptionRequestsComponent implements OnInit {
  pageSize = 20;
  statusFilter = '';
  search = '';
  sort = 'created_at';
  order: 'asc' | 'desc' = 'desc';

  loading = signal(false);
  requests = signal<PrescriptionRequest[]>([]);
  total = signal(0);
  page = signal(1);
  totalPages = computed(() => Math.ceil(this.total() / this.pageSize));
  stats = signal<PrescriptionStats | null>(null);

  detail = signal<PrescriptionRequest | null>(null);
  detailLoading = signal(false);
  assignInput = '';
  remarksInput = '';
  saving = signal(false);

  deleteTarget = signal<PrescriptionRequest | null>(null);
  deleting = signal(false);
  exporting = signal(false);

  constructor(private api: PrescriptionApiService) {}

  ngOnInit(): void {
    this.load();
    this.loadStats();
  }

  load(): void {
    this.loading.set(true);
    const p: any = { page: this.page(), page_size: this.pageSize, sort: this.sort, order: this.order };
    if (this.statusFilter) p.status = this.statusFilter;
    if (this.search.trim()) p.q = this.search.trim();
    this.api.list(p).subscribe({
      next: (r) => { this.requests.set(r.items); this.total.set(r.total); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  loadStats(): void {
    this.api.stats().subscribe({ next: (s) => this.stats.set(s), error: () => {} });
  }

  onFilterChange(): void { this.page.set(1); this.load(); }
  onPage(p: number): void { this.page.set(p); this.load(); }

  onSort(column: string): void {
    if (this.sort === column) {
      this.order = this.order === 'asc' ? 'desc' : 'asc';
    } else {
      this.sort = column;
      this.order = column === 'created_at' ? 'desc' : 'asc';
    }
    this.page.set(1);
    this.load();
  }

  sortIcon(column: string): string {
    if (this.sort !== column) return '';
    return this.order === 'asc' ? '↑' : '↓';
  }

  statusColor(status: PrescriptionStatus | string): string {
    const m: Record<string, string> = { new: 'info', called: 'warning', booked: 'success', cancelled: 'error' };
    return m[status] ?? 'default';
  }

  formatSize(bytes: number): string {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
    return bytes + ' B';
  }

  /** Signed download URLs are API-relative paths (e.g. /api/v1/files/download/…). */
  fileHref(url?: string | null): string {
    return url ?? '#';
  }

  openDetail(r: PrescriptionRequest): void {
    this.detail.set(r);
    this.assignInput = r.assigned_to ?? '';
    this.remarksInput = r.remarks ?? '';
    this.detailLoading.set(true);
    this.api.get(r.id).subscribe({
      next: (full) => {
        this.detail.set(full);
        this.assignInput = full.assigned_to ?? '';
        this.remarksInput = full.remarks ?? '';
        this.detailLoading.set(false);
      },
      error: () => this.detailLoading.set(false),
    });
  }

  closeDetail(): void { this.detail.set(null); }

  saveDetail(d: PrescriptionRequest): void {
    this.saving.set(true);
    this.api.update(d.id, {
      assigned_to: this.assignInput.trim() || undefined,
      remarks: this.remarksInput.trim() || undefined,
    }).subscribe({
      next: () => { this.saving.set(false); this.closeDetail(); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  updateStatus(r: PrescriptionRequest, status: PrescriptionStatus): void {
    this.api.update(r.id, { status }).subscribe({
      next: () => {
        if (this.detail()?.id === r.id) this.closeDetail();
        this.load();
        this.loadStats();
      },
    });
  }

  confirmDelete(r: PrescriptionRequest): void { this.deleteTarget.set(r); }

  doDelete(r: PrescriptionRequest): void {
    this.deleting.set(true);
    this.api.delete(r.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        if (this.detail()?.id === r.id) this.closeDetail();
        this.load();
        this.loadStats();
      },
      error: () => this.deleting.set(false),
    });
  }

  export(format: 'xlsx' | 'pdf'): void {
    this.exporting.set(true);
    const params: any = {};
    if (this.statusFilter) params.status = this.statusFilter;
    if (this.search.trim()) params.q = this.search.trim();
    this.api.export(format, params).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prescription_requests.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.exporting.set(false),
    });
  }
}
