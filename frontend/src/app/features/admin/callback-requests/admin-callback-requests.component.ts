import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CallbackRequestApiService } from '../../../core/api/services/callback-request-api.service';
import { CallbackRequest } from '../../../core/api/api.types';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-admin-callback-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent, SpinnerComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Callback Requests</h1>
      <p class="page-sub">Leads from the quick-help callback widget and the contact page's message form</p>
    </div>
  </div>

  <div class="filter-bar">
    <select class="filter-sel" [(ngModel)]="statusFilter" (change)="onFilterChange()">
      <option value="">All Status</option>
      <option value="new">New</option>
      <option value="contacted">Contacted</option>
      <option value="closed">Closed</option>
    </select>
    <select class="filter-sel" [(ngModel)]="sourceFilter" (change)="onFilterChange()">
      <option value="">All Sources</option>
      <option value="callback">Callback Widget</option>
      <option value="contact">Contact Form</option>
    </select>
  </div>

  @if (loading()) {
    <div class="load-wrap"><app-spinner size="md" /></div>
  } @else {
    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Source</th><th>Name</th><th>Contact</th><th>Message</th><th>Status</th><th>Submitted</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @if (requests().length === 0) {
            <tr><td colspan="7" class="empty-td">No callback requests found</td></tr>
          }
          @for (r of requests(); track r.id) {
            <tr>
              <td><app-badge [color]="sourceColor(r.source)" size="sm">{{ sourceLabel(r.source) }}</app-badge></td>
              <td>{{ r.name || '—' }}</td>
              <td>
                <div class="contact-cell">
                  <a class="mono" [href]="'tel:+91' + r.phone">{{ r.phone }}</a>
                  @if (r.email) { <a class="email-link" [href]="'mailto:' + r.email">{{ r.email }}</a> }
                </div>
              </td>
              <td>
                <div class="msg-cell">
                  @if (r.subject) { <span class="subject-tag">{{ subjectLabel(r.subject) }}</span> }
                  @if (r.preferred_time) { <span class="pref-time">Prefers: {{ r.preferred_time }}</span> }
                  @if (r.message) { <span class="msg-text" [title]="r.message">{{ r.message }}</span> }
                  @if (r.notes) { <span class="admin-note" [title]="r.notes">Note: {{ r.notes }}</span> }
                  @if (!r.subject && !r.preferred_time && !r.message && !r.notes) { <span class="text-muted">—</span> }
                </div>
              </td>
              <td><app-badge [color]="statusColor(r.status)" size="sm">{{ r.status | titlecase }}</app-badge></td>
              <td class="text-sm text-muted">{{ r.created_at | date:'dd MMM yyyy, h:mm a' }}</td>
              <td>
                <div class="row-actions">
                  @if (r.status !== 'contacted') {
                    <button class="act-btn success" (click)="updateStatus(r, 'contacted')" title="Mark Contacted">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </button>
                  }
                  @if (r.status !== 'closed') {
                    <button class="act-btn danger" (click)="updateStatus(r, 'closed')" title="Close">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    </button>
                  }
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="pg-info">Page {{ page() }} of {{ totalPages() }}</span>
        <button class="pg-btn" [disabled]="page() >= totalPages()" (click)="onPage(page()+1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    }
  }
</div>`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; }
    .page-title { font-size:1.5rem; font-weight:700; color:#0F172A; margin:0 0 0.25rem 0; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }
    .filter-bar { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
    .filter-sel { height:40px; padding:0 1rem; font-size:0.875rem; color:#0F172A; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:0.75rem; cursor:pointer; }
    .filter-sel:focus { outline:none; border-color:#0047CC; }
    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .table-wrap { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; overflow:hidden; }
    .tbl { width:100%; border-collapse:collapse; }
    .tbl thead tr { background:#F8FAFC; }
    .tbl th { padding:0.75rem 1rem; text-align:left; font-size:0.75rem; font-weight:600; color:#94A3B8; text-transform:uppercase; letter-spacing:0.025em; border-bottom:1px solid #F1F5F9; }
    .tbl td { padding:0.875rem 1rem; border-bottom:1px solid #F1F5F9; font-size:0.875rem; color:#0F172A; }
    .tbl tbody tr:last-child td { border-bottom:none; }
    .tbl tbody tr:hover td { background:#F8FAFC; }
    .mono { font-family:'JetBrains Mono','SF Mono','Fira Code',monospace; font-size:0.75rem; }
    .contact-cell { display:flex; flex-direction:column; gap:0.2rem; }
    .contact-cell a { color:#0F172A; text-decoration:none; }
    .contact-cell a:hover { color:#0047CC; text-decoration:underline; }
    .email-link { font-size:0.78rem; color:#475569 !important; word-break:break-all; }
    .msg-cell { display:flex; flex-direction:column; gap:0.25rem; max-width:22rem; }
    .subject-tag { align-self:flex-start; font-size:0.7rem; font-weight:600; text-transform:uppercase; letter-spacing:0.03em; color:#003399; background:#EEF4FF; border-radius:0.375rem; padding:0.1rem 0.4rem; }
    .pref-time { font-size:0.75rem; color:#475569; }
    .msg-text { font-size:0.8rem; color:#0F172A; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
    .admin-note { font-size:0.75rem; color:#94A3B8; font-style:italic; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .text-sm { font-size:0.875rem; }
    .text-muted { color:#94A3B8; }
    .empty-td { text-align:center; color:#94A3B8; padding:3rem !important; }
    .row-actions { display:flex; gap:0.5rem; }
    .act-btn { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFFFFF; cursor:pointer; transition:all 150ms; }
    .act-btn svg { width:16px; height:16px; }
    .act-btn.danger { color:#EF4444; }
    .act-btn.danger:hover { background:#FEF2F2; border-color:#FCA5A5; }
    .act-btn.success { color:#38A169; }
    .act-btn.success:hover { background:#F0FFF4; border-color:#68D391; }
    .pagination { display:flex; align-items:center; justify-content:center; gap:1rem; }
    .pg-btn { display:flex; align-items:center; justify-content:center; width:36px; height:36px; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFFFFF; cursor:pointer; transition:all 150ms; }
    .pg-btn:hover:not(:disabled) { border-color:#0A50D8; color:#003399; }
    .pg-btn:disabled { opacity:.4; cursor:not-allowed; }
    .pg-info { font-size:0.875rem; color:#475569; }
  `],
})
export class AdminCallbackRequestsComponent implements OnInit {
  pageSize = 20;
  statusFilter = '';
  sourceFilter = '';
  loading = signal(false);
  requests = signal<CallbackRequest[]>([]);
  total = signal(0);
  page = signal(1);
  totalPages = computed(() => Math.ceil(this.total() / this.pageSize));

  constructor(private callbackApi: CallbackRequestApiService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const p: any = { page: this.page(), page_size: this.pageSize };
    if (this.statusFilter) p.status = this.statusFilter;
    if (this.sourceFilter) p.source = this.sourceFilter;
    this.callbackApi.list(p).subscribe({
      next: (r) => { this.requests.set(r.items); this.total.set(r.total); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  onFilterChange(): void { this.page.set(1); this.load(); }
  onPage(p: number): void { this.page.set(p); this.load(); }

  updateStatus(r: CallbackRequest, status: string): void {
    this.callbackApi.updateStatus(r.id, { status }).subscribe({ next: () => this.load() });
  }

  statusColor(status: string): string {
    const m: Record<string, string> = { new: 'info', contacted: 'success', closed: 'default' };
    return m[status] ?? 'default';
  }

  sourceLabel(source: string): string {
    const m: Record<string, string> = { callback: 'Callback', contact: 'Contact Form' };
    return m[source] ?? source;
  }

  sourceColor(source: string): string {
    return source === 'contact' ? 'warning' : 'default';
  }

  subjectLabel(subject: string): string {
    const m: Record<string, string> = {
      booking: 'Test Booking',
      results: 'Report / Results',
      home: 'Home Collection',
      billing: 'Billing / Payment',
      other: 'Other',
    };
    return m[subject] ?? subject;
  }
}
