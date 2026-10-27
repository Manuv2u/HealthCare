import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AdminApiService } from '../../../core/api/services/admin-api.service';
import { AdminUserRow, AdminUserStats, AdminUserFilters, AccountStatus } from '../../../core/api/api.types';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { istDatetimeLocalToUtcIso } from '../../../core/utils/ist.util';

interface SortState { field: string; dir: 'asc' | 'desc'; }

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent, SpinnerComponent, AvatarComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Customer Management</h1>
      <p class="page-sub">Search, segment and manage patient accounts</p>
    </div>
    <div class="header-actions">
      <button class="btn ghost" [disabled]="exporting()" (click)="exportUsers('csv')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        CSV
      </button>
      <button class="btn ghost" [disabled]="exporting()" (click)="exportUsers('xlsx')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Excel
      </button>
    </div>
  </div>

  <!-- Dashboard cards -->
  @if (stats(); as s) {
    <div class="cards">
      <div class="card"><span class="c-lbl">Total Users</span><span class="c-val">{{ s.total }}</span></div>
      <div class="card success"><span class="c-lbl">Active</span><span class="c-val">{{ s.active }}</span></div>
      <div class="card online"><span class="c-lbl">Online Now</span><span class="c-val">{{ s.online }}</span></div>
      <div class="card"><span class="c-lbl">New Today</span><span class="c-val">{{ s.new_today }}</span></div>
      <div class="card"><span class="c-lbl">New This Week</span><span class="c-val">{{ s.new_this_week }}</span></div>
      <div class="card"><span class="c-lbl">Total Bookings</span><span class="c-val">{{ s.total_bookings }}</span></div>
      <div class="card accent"><span class="c-lbl">Total Revenue</span><span class="c-val">₹{{ s.total_revenue | number:'1.0-0' }}</span></div>
      <div class="card"><span class="c-lbl">Home Collection</span><span class="c-val">{{ s.home_collection_users }}</span></div>
      <div class="card"><span class="c-lbl">Lab Visit</span><span class="c-val">{{ s.lab_visit_users }}</span></div>
      <div class="card warning"><span class="c-lbl">Pending Reports</span><span class="c-val">{{ s.pending_reports }}</span></div>
      <div class="card success"><span class="c-lbl">Completed Reports</span><span class="c-val">{{ s.completed_reports }}</span></div>
      <div class="card error"><span class="c-lbl">Blocked</span><span class="c-val">{{ s.blocked }}</span></div>
    </div>
  }

  <!-- Filter bar -->
  <div class="filter-bar">
    <div class="search-field">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input placeholder="Search name, email, mobile, user ID, booking ID…" [(ngModel)]="searchQ" (input)="onSearch()" />
    </div>
    <button class="btn" [class.active]="showFilters()" (click)="showFilters.set(!showFilters())">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
      Filters @if (activeFilterCount() > 0) { <span class="filter-count">{{ activeFilterCount() }}</span> }
    </button>
    @if (activeFilterCount() > 0) {
      <button class="btn ghost" (click)="resetFilters()">Clear</button>
    }
  </div>

  <!-- Advanced filters -->
  @if (showFilters()) {
    <div class="filters-panel">
      <div class="fp-group">
        <label class="fp-label">Role</label>
        <div class="chips">
          @for (r of roles; track r.value) {
            <button class="chip" [class.on]="f.role === r.value" (click)="setRole(r.value)">{{ r.label }}</button>
          }
        </div>
      </div>
      <div class="fp-group">
        <label class="fp-label">Account Status</label>
        <div class="chips">
          @for (st of statuses; track st) {
            <button class="chip" [class.on]="f.account_status?.includes(st)" (click)="toggleStatus(st)">{{ st | titlecase }}</button>
          }
        </div>
      </div>
      <div class="fp-group">
        <label class="fp-label">Verification</label>
        <div class="chips">
          <button class="chip" [class.on]="f.email_verified === true" (click)="triState('email_verified')">Email Verified</button>
          <button class="chip" [class.on]="f.phone_verified === true" (click)="triState('phone_verified')">Mobile Verified</button>
          <button class="chip" [class.on]="f.is_online === true" (click)="triState('is_online')">Online</button>
        </div>
      </div>
      <div class="fp-group">
        <label class="fp-label">Bookings</label>
        <div class="chips">
          <button class="chip" [class.on]="f.has_bookings === true" (click)="setBool('has_bookings', true)">With Bookings</button>
          <button class="chip" [class.on]="f.has_bookings === false" (click)="setBool('has_bookings', false)">Without</button>
          <button class="chip" [class.on]="f.collection_type === 'home'" (click)="setCollection('home')">Home Collection</button>
          <button class="chip" [class.on]="f.collection_type === 'lab'" (click)="setCollection('lab')">Lab Visit</button>
        </div>
      </div>
      <div class="fp-group">
        <label class="fp-label">Reports</label>
        <div class="chips">
          <button class="chip" [class.on]="f.report_status === 'pending'" (click)="setReport('pending')">Pending Reports</button>
          <button class="chip" [class.on]="f.report_status === 'completed'" (click)="setReport('completed')">Completed Reports</button>
        </div>
      </div>
      <div class="fp-group">
        <label class="fp-label">City</label>
        <input class="fp-input" placeholder="City" [(ngModel)]="cityInput" (change)="applyFilters()" />
      </div>
      <div class="fp-group">
        <label class="fp-label">State</label>
        <input class="fp-input" placeholder="State" [(ngModel)]="stateInput" (change)="applyFilters()" />
      </div>
      <div class="fp-group">
        <label class="fp-label">Pincode</label>
        <input class="fp-input" placeholder="Pincode" [(ngModel)]="f.pincode" (change)="applyFilters()" />
      </div>
      <div class="fp-group">
        <label class="fp-label">Registered From</label>
        <input class="fp-input" type="date" [(ngModel)]="registeredFrom" (change)="applyFilters()" />
      </div>
      <div class="fp-group">
        <label class="fp-label">Registered To</label>
        <input class="fp-input" type="date" [(ngModel)]="registeredTo" (change)="applyFilters()" />
      </div>
      <div class="fp-group">
        <label class="fp-label">Min Spent (₹)</label>
        <input class="fp-input" type="number" min="0" [(ngModel)]="f.min_spent" (change)="applyFilters()" />
      </div>
      <div class="fp-group">
        <label class="fp-label">Max Spent (₹)</label>
        <input class="fp-input" type="number" min="0" [(ngModel)]="f.max_spent" (change)="applyFilters()" />
      </div>
    </div>
  }

  @if (loading()) {
    <div class="load-wrap"><app-spinner size="md" /></div>
  } @else if (error()) {
    <div class="state-box error-box">
      <p>{{ error() }}</p>
      <button class="btn" (click)="load()">Retry</button>
    </div>
  } @else {
    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th (click)="sortBy('name')" class="sortable">User {{ sortIcon('name') }}</th>
            <th>Contact</th>
            <th>Role</th>
            <th>Status</th>
            <th>Verified</th>
            <th (click)="sortBy('total_bookings')" class="sortable num">Bookings {{ sortIcon('total_bookings') }}</th>
            <th class="num">Tests / Pkgs</th>
            <th (click)="sortBy('total_spent')" class="sortable num">Spent {{ sortIcon('total_spent') }}</th>
            <th>Collection</th>
            <th>Location</th>
            <th (click)="sortBy('created_at')" class="sortable">Registered {{ sortIcon('created_at') }}</th>
            <th (click)="sortBy('last_active')" class="sortable">Last Active {{ sortIcon('last_active') }}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @if (users().length === 0) {
            <tr><td colspan="13" class="empty-td">No users match your filters</td></tr>
          }
          @for (u of users(); track u.id) {
            <tr class="row" (click)="openUser(u)">
              <td>
                <div class="user-cell">
                  <app-avatar [name]="u.name" [src]="u.avatar_url || undefined" size="sm" [status]="u.is_online ? 'online' : 'offline'" />
                  <div class="uc-text">
                    <span class="user-name">{{ u.name }}</span>
                    <span class="user-id mono">{{ u.id.substring(0, 8) }}</span>
                  </div>
                </div>
              </td>
              <td>
                <div class="stack">
                  <span class="text-sm">{{ u.email || '—' }}</span>
                  <span class="mono text-2xs">{{ u.phone || '—' }}</span>
                </div>
              </td>
              <td><app-badge [color]="roleColor(u.role)" size="sm">{{ roleLabel(u.role) }}</app-badge></td>
              <td><app-badge [color]="statusColor(u.account_status)" size="sm">{{ u.account_status | titlecase }}</app-badge></td>
              <td>
                <div class="vbadges">
                  <span class="vdot" [class.on]="u.email_verified" title="Email">✉</span>
                  <span class="vdot" [class.on]="u.phone_verified" title="Mobile">📱</span>
                </div>
              </td>
              <td class="num strong">{{ u.total_bookings }}</td>
              <td class="num text-sm">{{ u.total_tests }} / {{ u.total_packages }}</td>
              <td class="num strong">₹{{ u.total_spent | number:'1.0-0' }}</td>
              <td>
                @if (u.preferred_collection_type) {
                  <app-badge [color]="u.preferred_collection_type === 'home' ? 'info' : 'secondary'" size="sm">
                    {{ u.preferred_collection_type === 'home' ? 'Home' : 'Lab' }}
                  </app-badge>
                } @else { <span class="text-muted">—</span> }
              </td>
              <td class="text-sm">{{ u.city || '—' }}<span class="text-muted" *ngIf="u.state">, {{ u.state }}</span></td>
              <td class="text-sm text-muted">{{ u.created_at | date:'dd MMM yyyy' }}</td>
              <td class="text-sm text-muted">{{ u.last_active_at ? (u.last_active_at | date:'dd MMM, HH:mm') : '—' }}</td>
              <td (click)="$event.stopPropagation()">
                <div class="row-actions">
                  <button class="act-btn" (click)="openUser(u)" title="View"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                  @if (u.account_status === 'blocked') {
                    <button class="act-btn success" (click)="unblock(u)" title="Unblock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg></button>
                  } @else {
                    <button class="act-btn danger" (click)="block(u)" title="Block"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></button>
                  }
                  <button class="act-btn danger" (click)="remove(u)" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (total() > 0) {
      <div class="pagination">
        <span class="pg-total">{{ total() }} users</span>
        <div class="pg-controls">
          <button class="pg-btn" [disabled]="page() === 1" (click)="onPage(page()-1)">Prev</button>
          <span class="pg-info">Page {{ page() }} of {{ totalPages() }}</span>
          <button class="pg-btn" [disabled]="page() >= totalPages()" (click)="onPage(page()+1)">Next</button>
        </div>
      </div>
    }
  }
</div>`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; }
    .page-title { font-size:1.5rem; font-weight:700; color:#0F172A; margin:0 0 0.25rem 0; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }
    .header-actions { display:flex; gap:0.5rem; }
    .cards { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:0.75rem; }
    .card { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:0.875rem; padding:0.875rem 1rem; display:flex; flex-direction:column; gap:0.25rem; }
    .c-lbl { font-size:0.7rem; color:#94A3B8; font-weight:600; text-transform:uppercase; letter-spacing:0.025em; }
    .c-val { font-size:1.375rem; font-weight:700; color:#0F172A; line-height:1.1; }
    .card.success .c-val { color:#2F855A; } .card.warning .c-val { color:#D97706; } .card.error .c-val { color:#DC2626; }
    .card.accent .c-val { color:#0284C7; } .card.online .c-val { color:#059669; }
    .filter-bar { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
    .search-field { display:flex; align-items:center; gap:0.5rem; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:0.75rem; padding:0.625rem 1rem; flex:1; min-width:260px; svg { width:18px; height:18px; color:#94A3B8; flex-shrink:0; } input { border:none; outline:none; font-size:0.875rem; color:#0F172A; background:transparent; width:100%; &::placeholder { color:#94A3B8; } } &:focus-within { border-color:#0047CC; box-shadow:0 0 0 3px rgba(0,71,204,.1); } }
    .btn { display:inline-flex; align-items:center; gap:0.4rem; height:40px; padding:0 1rem; font-size:0.85rem; font-weight:600; color:#0F172A; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:0.75rem; cursor:pointer; transition:all 150ms; svg { width:16px; height:16px; } &:hover { border-color:#0047CC; } &.active { border-color:#0047CC; background:#EEF4FF; color:#003399; } &.ghost { color:#475569; } &:disabled { opacity:.5; cursor:not-allowed; } }
    .filter-count { background:#0047CC; color:#FFF; border-radius:999px; padding:0 0.4rem; font-size:0.7rem; min-width:18px; text-align:center; }
    .filters-panel { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:1rem; background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; padding:1.25rem; }
    .fp-group { display:flex; flex-direction:column; gap:0.4rem; }
    .fp-label { font-size:0.72rem; color:#64748B; font-weight:600; text-transform:uppercase; letter-spacing:0.03em; }
    .fp-input { height:36px; padding:0 0.75rem; border:1px solid #E2E8F0; border-radius:0.5rem; font-size:0.85rem; color:#0F172A; outline:none; &:focus { border-color:#0047CC; } }
    .chips { display:flex; gap:0.4rem; flex-wrap:wrap; }
    .chip { padding:0.3rem 0.7rem; font-size:0.78rem; font-weight:500; border:1px solid #E2E8F0; border-radius:999px; background:#FFF; color:#475569; cursor:pointer; transition:all 120ms; &:hover { border-color:#CBD5E1; } &.on { background:#0047CC; border-color:#0047CC; color:#FFF; } }
    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .state-box { text-align:center; padding:2rem; background:#FFF; border:1px solid #F1F5F9; border-radius:1rem; }
    .error-box p { color:#DC2626; margin:0 0 1rem 0; }
    .table-wrap { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; overflow-x:auto; }
    .tbl { width:100%; border-collapse:collapse; min-width:1100px; }
    .tbl thead tr { background:#F8FAFC; }
    .tbl th { padding:0.75rem 1rem; text-align:left; font-size:0.72rem; font-weight:600; color:#94A3B8; text-transform:uppercase; letter-spacing:0.025em; border-bottom:1px solid #F1F5F9; white-space:nowrap; }
    .tbl th.sortable { cursor:pointer; user-select:none; &:hover { color:#0047CC; } }
    .tbl th.num, .tbl td.num { text-align:right; }
    .tbl td { padding:0.75rem 1rem; border-bottom:1px solid #F1F5F9; font-size:0.875rem; color:#0F172A; white-space:nowrap; }
    .tbl tbody tr:last-child td { border-bottom:none; }
    .row { cursor:pointer; &:hover td { background:#F8FAFC; } }
    .user-cell { display:flex; align-items:center; gap:0.65rem; }
    .uc-text { display:flex; flex-direction:column; }
    .user-name { font-weight:600; }
    .user-id { font-size:0.7rem; color:#94A3B8; }
    .stack { display:flex; flex-direction:column; }
    .mono { font-family:'JetBrains Mono','SF Mono',monospace; }
    .text-sm { font-size:0.82rem; } .text-2xs { font-size:0.7rem; color:#64748B; }
    .text-muted { color:#94A3B8; } .strong { font-weight:600; }
    .vbadges { display:flex; gap:0.3rem; }
    .vdot { font-size:0.8rem; opacity:0.3; filter:grayscale(1); &.on { opacity:1; filter:none; } }
    .empty-td { text-align:center; color:#94A3B8; padding:3rem !important; }
    .row-actions { display:flex; gap:0.4rem; }
    .act-btn { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFF; cursor:pointer; color:#475569; transition:all 150ms; svg { width:15px; height:15px; } &:hover { border-color:#0047CC; color:#0047CC; } &.danger:hover { border-color:#FCA5A5; color:#EF4444; background:#FEF2F2; } &.success:hover { border-color:#68D391; color:#38A169; background:#F0FFF4; } }
    .pagination { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
    .pg-total { font-size:0.82rem; color:#64748B; }
    .pg-controls { display:flex; align-items:center; gap:1rem; }
    .pg-btn { height:34px; padding:0 0.9rem; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFF; cursor:pointer; font-size:0.82rem; font-weight:500; &:hover:not(:disabled) { border-color:#0047CC; color:#003399; } &:disabled { opacity:.4; cursor:not-allowed; } }
    .pg-info { font-size:0.82rem; color:#475569; }
  `]
})
export class AdminUsersComponent implements OnInit {
  private adminApi = inject(AdminApiService);
  private confirm = inject(ConfirmDialogService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly statuses: AccountStatus[] = ['active', 'inactive', 'blocked'];
  readonly roles = [
    { value: 'user', label: 'Customer' },
    { value: 'technician', label: 'Technician' },
    { value: 'admin', label: 'Admin' },
  ];
  pageSize = 20;
  searchQ = '';
  cityInput = '';
  stateInput = '';
  registeredFrom = '';
  registeredTo = '';
  f: AdminUserFilters = {};
  sort: SortState = { field: 'created_at', dir: 'desc' };
  private searchTimer: any;

  loading = signal(false);
  exporting = signal(false);
  error = signal<string | null>(null);
  users = signal<AdminUserRow[]>([]);
  total = signal(0);
  page = signal(1);
  stats = signal<AdminUserStats | null>(null);
  showFilters = signal(false);

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  activeFilterCount = computed(() => {
    const f = this.f;
    let n = 0;
    if (f.account_status?.length) n++;
    for (const k of ['role', 'is_online', 'email_verified', 'phone_verified', 'has_bookings', 'collection_type', 'report_status', 'pincode', 'min_spent', 'max_spent'] as const) {
      if (f[k] !== undefined && f[k] !== null && f[k] !== '') n++;
    }
    if (this.cityInput) n++;
    if (this.stateInput) n++;
    if (this.registeredFrom || this.registeredTo) n++;
    return n;
  });

  ngOnInit(): void {
    // Hydrate filters from URL query params (shareable / back-button friendly).
    const qp = this.route.snapshot.queryParamMap;
    this.searchQ = qp.get('q') || '';
    this.page.set(Number(qp.get('page')) || 1);
    if (qp.get('sort')) this.sort = { field: qp.get('sort')!, dir: (qp.get('order') as 'asc' | 'desc') || 'desc' };
    this.adminApi.getUserStats().subscribe({ next: (s) => this.stats.set(s), error: () => {} });
    this.load();
  }

  private buildFilters(): AdminUserFilters {
    const f: AdminUserFilters = { ...this.f };
    if (this.searchQ) f.q = this.searchQ;
    if (this.cityInput) f.city = [this.cityInput];
    if (this.stateInput) f.state = [this.stateInput];
    if (this.registeredFrom) f.registered_from = istDatetimeLocalToUtcIso(`${this.registeredFrom}T00:00`);
    if (this.registeredTo) f.registered_to = istDatetimeLocalToUtcIso(`${this.registeredTo}T23:59`);
    f.sort = this.sort.field;
    f.order = this.sort.dir;
    f.page = this.page();
    f.page_size = this.pageSize;
    return f;
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const filters = this.buildFilters();
    this.syncUrl(filters);
    this.adminApi.getUsers(filters).subscribe({
      next: (r) => { this.users.set(r.items); this.total.set(r.total); this.loading.set(false); },
      error: () => { this.error.set('Failed to load users. Please try again.'); this.loading.set(false); },
    });
  }

  private syncUrl(f: AdminUserFilters): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: f.q || null, page: f.page !== 1 ? f.page : null, sort: f.sort, order: f.order },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onSearch(): void { clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 400); }
  applyFilters(): void { this.page.set(1); this.load(); }
  onPage(p: number): void { this.page.set(p); this.load(); }

  resetFilters(): void {
    this.f = {}; this.searchQ = ''; this.cityInput = ''; this.stateInput = '';
    this.registeredFrom = ''; this.registeredTo = '';
    this.page.set(1); this.load();
  }

  toggleStatus(st: AccountStatus): void {
    const cur = this.f.account_status || [];
    this.f.account_status = cur.includes(st) ? cur.filter((s) => s !== st) : [...cur, st];
    if (this.f.account_status.length === 0) delete this.f.account_status;
    this.applyFilters();
  }
  triState(key: 'is_online' | 'email_verified' | 'phone_verified'): void {
    this.f[key] = this.f[key] === true ? undefined : true;
    this.applyFilters();
  }
  setBool(key: 'has_bookings', val: boolean): void {
    this.f[key] = this.f[key] === val ? undefined : val;
    this.applyFilters();
  }
  setCollection(val: 'home' | 'lab'): void {
    this.f.collection_type = this.f.collection_type === val ? undefined : val;
    this.applyFilters();
  }
  setReport(val: 'pending' | 'completed'): void {
    this.f.report_status = this.f.report_status === val ? undefined : val;
    this.applyFilters();
  }
  setRole(val: string): void {
    this.f.role = this.f.role === val ? undefined : val;
    this.applyFilters();
  }

  sortBy(field: string): void {
    if (this.sort.field === field) this.sort.dir = this.sort.dir === 'asc' ? 'desc' : 'asc';
    else this.sort = { field, dir: 'desc' };
    this.load();
  }
  sortIcon(field: string): string { return this.sort.field === field ? (this.sort.dir === 'asc' ? '▲' : '▼') : ''; }

  openUser(u: AdminUserRow): void { this.router.navigate(['/admin/users', u.id]); }

  statusColor(s: AccountStatus): string {
    return s === 'active' ? 'success' : s === 'blocked' ? 'error' : 'warning';
  }

  roleLabel(role: string): string {
    return role === 'user' ? 'Customer' : role === 'technician' ? 'Technician' : role === 'admin' ? 'Admin' : role;
  }
  roleColor(role: string): string {
    return role === 'admin' ? 'error' : role === 'technician' ? 'info' : 'default';
  }

  async block(u: AdminUserRow): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Block ${u.name}?`,
      message: 'They will be signed out and unable to log in.',
      confirmLabel: 'Block',
      tone: 'danger',
    });
    if (!ok) return;
    this.adminApi.blockUser(u.id).subscribe({ next: () => this.patchRow(u.id, { account_status: 'blocked', is_active: false }) });
  }
  unblock(u: AdminUserRow): void {
    this.adminApi.unblockUser(u.id).subscribe({ next: () => this.patchRow(u.id, { account_status: 'active', is_active: true }) });
  }
  async remove(u: AdminUserRow): Promise<void> {
    const ok = await this.confirm.askDelete(u.name, 'This soft-deletes the account and revokes access.');
    if (!ok) return;
    this.adminApi.deleteUser(u.id).subscribe({ next: () => { this.users.set(this.users().filter((x) => x.id !== u.id)); this.total.set(this.total() - 1); } });
  }

  private patchRow(id: string, patch: Partial<AdminUserRow>): void {
    this.users.set(this.users().map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  exportUsers(format: 'csv' | 'xlsx'): void {
    this.exporting.set(true);
    this.adminApi.exportUsers(this.buildFilters(), format).subscribe({
      next: (blob) => { this.downloadBlob(blob, `users.${format}`); this.exporting.set(false); },
      error: () => { this.exporting.set(false); alert('Export failed.'); },
    });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}
