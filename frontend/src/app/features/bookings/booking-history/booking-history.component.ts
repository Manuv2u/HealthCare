import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { BookingApiService } from '../../../core/api/services/booking-api.service';
import { Booking } from '../../../core/api/api.types';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '../../../shared/components/search-input/search-input.component';
import { DashboardReadyService } from '../../../core/services/dashboard-ready.service';

@Component({
  selector: 'app-booking-history',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonComponent, AlertComponent,
    SpinnerComponent, BadgeComponent, EmptyStateComponent, SearchInputComponent],
  template: `
<div class="bookings-page">
  <header class="page-header">
    <div>
      <h1 class="page-title">My Bookings</h1>
      <p class="page-subtitle">Track and manage all your diagnostic test bookings</p>
    </div>
    <app-button variant="primary" routerLink="/booking">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Book New Test
    </app-button>
  </header>

  <div class="filters-bar">
    <div class="status-tabs" role="tablist" aria-label="Filter bookings by status">
      @for (tab of statusTabs; track tab.value) {
        <button class="tab-btn" role="tab" [attr.aria-selected]="activeStatus() === tab.value" [class.active]="activeStatus() === tab.value" (click)="setStatus(tab.value)">
          {{ tab.label }}
          @if (getCountByStatus(tab.value) > 0) {
            <span class="tab-count">{{ getCountByStatus(tab.value) }}</span>
          }
        </button>
      }
    </div>
    <app-search-input placeholder="Search reference…" (search)="searchQuery.set($event)" />
  </div>

  @if (error()) {
    <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">{{ error() }}</app-alert>
  }

  @if (loading()) {
    <div class="loading-wrap"><app-spinner size="lg" /><p>Loading bookings…</p></div>
  } @else if (filteredBookings().length === 0) {
    <app-empty-state [illustration]="searchQuery() ? 'empty-search' : 'empty-bookings'" [title]="searchQuery() ? 'No Results' : 'No Bookings Yet'"
      [description]="searchQuery() ? 'Try a different search term.' : 'You haven\\'t made any bookings yet.'">
      @if (!searchQuery()) {
        <app-button variant="primary" routerLink="/booking">Book Your First Test</app-button>
      }
    </app-empty-state>
  } @else {
    <div class="bookings-list">
      @for (b of paginatedBookings(); track b.id) {
        <div class="booking-card" (click)="viewBooking(b)" role="button" tabindex="0"
          (keyup.enter)="viewBooking(b)">
          <div class="card-top">
            <div class="ref-block">
              <span class="ref-label">REF</span>
              <span class="ref-number">{{ b.reference_number }}</span>
            </div>
            <app-badge [color]="statusColor(b.status)">{{ formatStatus(b.status) }}</app-badge>
          </div>
          <div class="card-mid">
            <div class="meta-row">
              <span class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {{ formatDate(b.booking_date) }}
              </span>
              <span class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                {{ b.collection_type === 'home' ? 'Home Collection' : 'Lab Visit' }}
              </span>
            </div>
            @if (b.items?.length) {
              <p class="tests-text">
                <strong>Tests:</strong> {{ getItemNames(b) }}
              </p>
            }
          </div>
          <div class="card-bot">
            <div class="amount-block">
              <span class="amount-label">Total</span>
              <span class="amount-val">₹{{ b.total_amount.toLocaleString('en-IN') }}</span>
            </div>
            <app-badge [color]="paymentColor(b.payment_status)" size="sm">{{ formatPayment(b.payment_status) }}</app-badge>
            <svg class="arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      }
    </div>

    @if (totalPages() > 1) {
      <div class="pagination">
        <button class="pg-btn" [disabled]="currentPage() === 1" (click)="currentPage.set(currentPage()-1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        @for (p of pageNumbers(); track p) {
          <button class="pg-btn" [class.active]="p === currentPage()" (click)="currentPage.set(p)">{{ p }}</button>
        }
        <button class="pg-btn" [disabled]="currentPage() === totalPages()" (click)="currentPage.set(currentPage()+1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    }
  }
</div>`,
  styles: [`
    :host {
      /* Realign shared design-tokens (app-button/app-badge/app-spinner/app-search-input)
         from the legacy teal palette to the app's indigo/orange theme. */
      --color-primary-50: #EEF4FF;
      --color-primary-100: #D9E5FF;
      --color-primary-500: #0047CC;
      --color-primary-600: #003399;
      --color-primary-700: #002577;
      --color-primary-800: #001B57;
      --color-accent-100: #EEF4FF;
      --color-accent-700: #001B57;
      --shadow-primary: 0 4px 14px 0 rgba(0, 51, 153, 0.28);
      display: block;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .bookings-page { max-width:900px; margin:0 auto; padding:2rem 1.5rem; display:flex; flex-direction:column; gap:1.5rem; animation: fadeIn .35s ease both; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; }
    .page-title { font-size:1.875rem; font-weight:800; letter-spacing:-0.02em; color:#0F172A; margin:0 0 0.25rem 0; }
    .page-subtitle { font-size:1rem; color:#475569; margin:0; }
    .filters-bar { display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; }
    .filters-bar app-search-input { width:280px; max-width:100%; margin-left:auto; }
    /* max-width is what lets the overflow-x actually engage: without it the strip
       sizes to its tabs (~471px) and widens the whole page on phones instead of
       scrolling. Capping rather than setting width:100% keeps the tabs and the
       search box sharing a row on desktop. */
    .status-tabs { display:flex; gap:0.25rem; background:#EEF4FF; padding:0.25rem; border-radius:0.75rem; overflow-x:auto; max-width:100%; }
    .tab-btn {
      display:inline-flex; align-items:center; gap:0.5rem; padding:0.5rem 1rem;
      border:none; background:transparent; border-radius:0.5rem; font-size:0.875rem;
      font-weight:600; color:#003399; cursor:pointer; transition:all 150ms; white-space:nowrap;
      &.active { background:#FFFFFF; color:#002577; box-shadow:0 2px 8px rgba(0, 71, 204,.18); }
      &:hover:not(.active) { color:#002577; background:rgba(255,255,255,.6); }
      &:focus-visible { outline:2px solid #0047CC; outline-offset:2px; }
    }
    .tab-count { background:#B3CAFF; color:#001B57; font-size:0.75rem; font-weight:700; padding:1px 6px; border-radius:9999px; }
    .tab-btn.active .tab-count { background:#003399; color:#FFFFFF; }
    .loading-wrap { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4rem; gap:1rem; color:#475569; }
    .bookings-list { display:flex; flex-direction:column; gap:1rem; }
    .booking-card {
      background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem;
      overflow:hidden; cursor:pointer; transition:all 150ms;
      &:hover { border-color:#84A6FF; box-shadow:0 8px 20px -4px rgba(0, 37, 119,.15); transform:translateY(-2px); }
      &:focus-visible { outline:2px solid #0047CC; outline-offset:2px; }
    }
    .card-top { display:flex; justify-content:space-between; align-items:center; padding:1rem 1.25rem; border-bottom:1px solid #F1F5F9; background:#F8FAFC; }
    .ref-block { display:flex; align-items:center; gap:0.5rem; }
    .ref-label { font-size:0.75rem; font-weight:700; color:#94A3B8; letter-spacing:0.05em; }
    .ref-number { font-size:1rem; font-weight:600; color:#0F172A; font-family:'JetBrains Mono','SF Mono','Fira Code',monospace; }
    .card-mid { padding:1rem 1.25rem; }
    .meta-row { display:flex; gap:1.25rem; margin-bottom:0.5rem; flex-wrap:wrap; }
    .meta-item { display:flex; align-items:center; gap:0.5rem; font-size:0.875rem; color:#475569; svg { color:#94A3B8; } }
    .tests-text { font-size:0.875rem; color:#475569; margin:0; strong { color:#0F172A; } }
    .card-bot { display:flex; align-items:center; gap:1rem; padding:0.75rem 1.25rem; border-top:1px solid #F1F5F9; background:#F8FAFC; }
    .amount-block { display:flex; align-items:baseline; gap:0.25rem; margin-right:auto; }
    .amount-label { font-size:0.75rem; color:#94A3B8; }
    .amount-val { font-size:1.125rem; font-weight:700; color:#0F172A; }
    .arrow { color:#94A3B8; transition:transform 150ms, color 150ms; }
    .booking-card:hover .arrow { color:#003399; transform:translateX(3px); }
    .pagination { display:flex; justify-content:center; align-items:center; gap:0.5rem; }
    .pg-btn {
      display:flex; align-items:center; justify-content:center; min-width:36px; height:36px;
      padding:0 0.5rem; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFFFFF;
      font-size:0.875rem; color:#475569; cursor:pointer; transition:all 150ms;
      &:hover:not(:disabled) { border-color:#0A50D8; color:#003399; }
      &:focus-visible { outline:2px solid #0047CC; outline-offset:2px; }
      &.active { background:#003399; border-color:#003399; color:#FFFFFF; }
      &:disabled { opacity:0.4; cursor:not-allowed; }
    }
    @media (prefers-reduced-motion: reduce) {
      .bookings-page { animation:none; }
      .booking-card:hover { transform:none; }
    }
    @media(max-width:640px) {
      .bookings-page { padding:1.25rem 1rem; }
      .page-header { flex-direction:column; }
      .filters-bar { flex-direction:column; align-items:stretch; }
      .filters-bar app-search-input { width:100%; margin-left:0; }
      .status-tabs { overflow-x:auto; }
      .meta-row { gap:0.75rem; }
    }
  `]
})
export class BookingHistoryComponent implements OnInit {
  allBookings = signal<Booking[]>([]);
  loading = signal(true);
  error = signal('');
  activeStatus = signal('all');
  searchQuery = signal('');
  currentPage = signal(1);
  readonly pageSize = 8;

  statusTabs = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  filteredBookings = computed(() => {
    let list = this.allBookings();
    if (this.activeStatus() !== 'all') list = list.filter(b => b.status === this.activeStatus());
    const q = this.searchQuery().toLowerCase();
    if (q) list = list.filter(b => b.reference_number.toLowerCase().includes(q));
    return list;
  });

  paginatedBookings = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredBookings().slice(start, start + this.pageSize);
  });

  totalPages = computed(() => Math.ceil(this.filteredBookings().length / this.pageSize));

  pageNumbers = computed(() => {
    const total = this.totalPages();
    return Array.from({ length: Math.min(total, 7) }, (_, i) => i + 1);
  });

  constructor(
    private bookingApi: BookingApiService,
    private router: Router,
    private dashboardReady: DashboardReadyService,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.bookingApi.list({ page_size: 100 }).subscribe({
      next: r => { this.allBookings.set(r.items); this.loading.set(false); this.dashboardReady.markReady(); },
      error: () => { this.error.set('Failed to load bookings.'); this.loading.set(false); this.dashboardReady.markReady(); }
    });
  }

  setStatus(s: string) { this.activeStatus.set(s); this.currentPage.set(1); }
  getCountByStatus(s: string) { return s === 'all' ? 0 : this.allBookings().filter(b => b.status === s).length; }
  getItemNames(b: Booking): string {
    if (!b.items?.length) return '';
    const names = b.items.slice(0, 3).map(i => i.item_name).join(', ');
    return b.items.length > 3 ? `${names} +${b.items.length - 3} more` : names;
  }
  viewBooking(b: Booking) { this.router.navigate(['/bookings', b.id]); }
  formatDate(d: string) { return new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }); }
  formatStatus(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
  formatPayment(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
  statusColor(s: string): string {
    const m: Record<string,string> = { pending:'warning', confirmed:'info', in_progress:'primary', completed:'success', cancelled:'error' };
    return m[s] ?? 'default';
  }
  paymentColor(s: string): string {
    const m: Record<string,string> = { paid:'success', pending:'warning', failed:'error', refunded:'info' };
    return m[s] ?? 'default';
  }
}
