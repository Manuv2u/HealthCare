import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PackageApiService } from '../../../core/api/services/package-api.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { TestApiService } from '../../../core/api/services/test-api.service';
import { Package, Test } from '../../../core/api/api.types';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { InputComponent } from '../../../shared/components/input/input.component';

@Component({
  selector: 'app-admin-packages',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent, SpinnerComponent, ButtonComponent, ModalComponent, AlertComponent, InputComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div><h1 class="page-title">Health Packages</h1><p class="page-sub">Manage bundled test packages and pricing</p></div>
    <app-button variant="primary" (click)="openCreate()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Package
    </app-button>
  </div>

  @if (error()) { <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">{{ error() }}</app-alert> }

  <div class="filter-bar">
    <div class="search-field">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input placeholder="Search packages…" [(ngModel)]="searchQ" (input)="applyFilter()" />
    </div>
    <select class="filter-sel" [(ngModel)]="statusFilter" (change)="applyFilter()">
      <option value="">All Status</option>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
    <span class="count-badge">{{ filtered().length }} packages</span>
  </div>

  @if (loading()) {
    <div class="load-wrap"><app-spinner size="md" /></div>
  } @else {
    <div class="packages-grid">
      @if (filtered().length === 0) {
        <div class="empty-card">No packages found. Create your first health package.</div>
      }
      @for (p of filtered(); track p.id) {
        <div class="pkg-card" [class.inactive]="!p.is_active">
          <div class="pkg-header">
            <div class="pkg-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
            <app-badge [color]="p.is_active ? 'success' : 'default'" size="sm">{{ p.is_active ? 'Active' : 'Inactive' }}</app-badge>
          </div>
          <h3 class="pkg-name">{{ p.name }}</h3>
          @if (p.description) { <p class="pkg-desc">{{ p.description }}</p> }
          <div class="pkg-price">
            <span class="discounted">₹{{ Number(p.discounted_price).toLocaleString('en-IN') }}</span>
            @if (Number(p.original_price) > Number(p.discounted_price)) {
              <span class="original">₹{{ Number(p.original_price).toLocaleString('en-IN') }}</span>
              <span class="savings">{{ getSavings(p) }}% off</span>
            }
          </div>
          <div class="pkg-tests">
            <span class="tests-lbl">{{ p.tests?.length || 0 }} tests included</span>
            <div class="tests-chips">
              @for (t of (p.tests || []).slice(0,3); track t.id) {
                <span class="test-chip">{{ t.name }}</span>
              }
              @if ((p.tests?.length || 0) > 3) {
                <span class="test-chip more">+{{ (p.tests?.length || 0) - 3 }} more</span>
              }
            </div>
          </div>
          <div class="pkg-actions">
            <button class="act-btn" (click)="openEdit(p)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
            <button class="act-btn" (click)="toggleActive(p)">{{ p.is_active ? 'Deactivate' : 'Activate' }}</button>
            <button class="act-btn danger" (click)="remove(p)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              Delete
            </button>
          </div>
        </div>
      }
    </div>
  }

  <!-- Modal -->
  <app-modal [isOpen]="showModal()" [title]="editId() ? 'Edit Package' : 'New Package'" size="xl" (close)="closeModal()">
    <div class="form-grid">
      <div class="span2">
        <app-input label="Package Name" [required]="true" icon="inventory_2" placeholder="e.g. Full Body Checkup" [(ngModel)]="f.name" />
      </div>
      <app-input label="Original Price (₹)" [required]="true" icon="currency_rupee" type="number" [min]="0" [(ngModel)]="f.original_price" />
      <app-input label="Discounted Price (₹)" [required]="true" icon="sell" type="number" [min]="0" [(ngModel)]="f.discounted_price" />
      <div class="span2">
        <app-input label="Description" type="textarea" [rows]="2" [(ngModel)]="f.description" />
      </div>
      <div class="field span2">
        <label class="chk-opt"><input type="checkbox" [(ngModel)]="f.is_popular" /> Mark as "Most Popular"</label>
        <span class="field-hint">Shows a "Most Popular" badge on this package's card. Off by default.</span>
      </div>
      <div class="field span2">
        <label>Include Tests</label>
        <div class="test-selector">
          <div class="test-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input [(ngModel)]="testSearchQ" placeholder="Search tests to add…" (input)="filterAvailableTests()" />
          </div>
          <div class="test-list">
            @for (t of filteredAvailableTests(); track t.id) {
              <label class="test-option" [class.checked]="isSelected(t)">
                <input type="checkbox" [checked]="isSelected(t)" (change)="toggleTest(t)" />
                <span class="test-opt-name">{{ t.name }}</span>
                <span class="test-opt-cat">{{ t.category }}</span>
                <span class="test-opt-price">₹{{ t.price }}</span>
              </label>
            }
            @if (filteredAvailableTests().length === 0) { <p class="no-tests">No tests found</p> }
          </div>
        </div>
        @if (f.selectedTestIds.length > 0) {
          <p class="sel-count">{{ f.selectedTestIds.length }} test(s) selected</p>
        }
      </div>
    </div>
    @if (formErr()) { <p class="form-err">{{ formErr() }}</p> }
    <div modal-footer>
      <app-button variant="outline" (click)="closeModal()">Cancel</app-button>
      <app-button variant="primary" [loading]="saving()" (click)="save()">{{ editId() ? 'Update' : 'Create' }} Package</app-button>
    </div>
  </app-modal>
</div>`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; }
    .page-title { font-size:1.5rem; font-weight:700; color:#0F172A; margin:0 0 0.25rem 0; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }
    .filter-bar { display:flex; align-items:center; gap:0.75rem; }
    .search-field { display:flex; align-items:center; gap:0.5rem; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:0.75rem; padding:0.625rem 1rem; flex:1; svg { width:18px; height:18px; color:#94A3B8; flex-shrink:0; } input { border:none; outline:none; font-size:0.875rem; color:#0F172A; background:transparent; width:100%; } &:focus-within { border-color:#0047CC; box-shadow:0 0 0 3px rgba(0,71,204,.1); } }
    .filter-sel { height:40px; padding:0 1rem; font-size:0.875rem; color:#0F172A; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:0.75rem; cursor:pointer; &:focus { outline:none; border-color:#0047CC; } }
    .count-badge { font-size:0.875rem; color:#94A3B8; white-space:nowrap; font-weight:500; }
    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .packages-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:1.25rem; }
    .empty-card { grid-column:1/-1; text-align:center; padding:3rem; color:#94A3B8; font-size:0.875rem; background:#FFFFFF; border:2px dashed #E2E8F0; border-radius:1rem; }
    .pkg-card { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; padding:1.5rem; display:flex; flex-direction:column; gap:1rem; transition:all 150ms; &:hover { border-color:#84A6FF; box-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1); } &.inactive { opacity:.7; } }
    .pkg-header { display:flex; justify-content:space-between; align-items:center; }
    .pkg-icon { width:44px; height:44px; border-radius:0.75rem; background:#D9E5FF; color:#003399; display:flex; align-items:center; justify-content:center; svg { width:22px; height:22px; } }
    .pkg-name { font-size:1.125rem; font-weight:600; color:#0F172A; margin:0; }
    .pkg-desc { font-size:0.875rem; color:#475569; margin:0; line-height:1.625; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
    .pkg-price { display:flex; align-items:baseline; gap:0.5rem; }
    .discounted { font-size:1.5rem; font-weight:700; color:#002577; }
    .original { font-size:0.875rem; color:#94A3B8; text-decoration:line-through; }
    .savings { font-size:0.75rem; font-weight:600; background:#C6F6D5; color:#276749; padding:0.125rem 0.5rem; border-radius:9999px; }
    .pkg-tests { display:flex; flex-direction:column; gap:0.5rem; }
    .tests-lbl { font-size:0.75rem; color:#94A3B8; font-weight:500; text-transform:uppercase; letter-spacing:0.025em; }
    .tests-chips { display:flex; flex-wrap:wrap; gap:0.375rem; }
    .test-chip { font-size:0.75rem; background:#EEF4FF; color:#002577; padding:2px 0.5rem; border-radius:9999px; font-weight:500; &.more { background:#F8FAFC; color:#94A3B8; } }
    .pkg-actions { display:flex; gap:0.5rem; margin-top:auto; }
    .act-btn { display:inline-flex; align-items:center; gap:0.5rem; padding:0.5rem 0.75rem; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFFFFF; font-size:0.75rem; font-weight:500; color:#475569; cursor:pointer; transition:all 150ms; svg { width:13px; height:13px; } &:hover { background:#EEF4FF; border-color:#84A6FF; color:#002577; } &.danger:hover { background:#FEF2F2; border-color:#FCA5A5; color:#DC2626; } }
    .form-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1rem; }
    .field { display:flex; flex-direction:column; gap:0.375rem; &.span2 { grid-column:span 2; } label { font-size:0.875rem; font-weight:500; color:#0F172A; } }
    .span2 { grid-column:span 2; }
    .field-hint { font-size:0.75rem; color:#94A3B8; }
    .chk-opt { display:flex; align-items:center; gap:0.4rem; font-size:0.875rem; color:#334155; cursor:pointer; input { accent-color:#0047CC; } }
    .test-selector { border:1px solid #E2E8F0; border-radius:0.75rem; overflow:hidden; }
    .test-search { display:flex; align-items:center; gap:0.5rem; padding:0.625rem 0.875rem; border-bottom:1px solid #F1F5F9; svg { width:16px; height:16px; color:#94A3B8; flex-shrink:0; } input { border:none; outline:none; font-size:0.875rem; width:100%; background:transparent; } }
    .test-list { max-height:220px; overflow-y:auto; }
    .test-option { display:flex; align-items:center; gap:0.75rem; padding:0.75rem 1rem; cursor:pointer; transition:background 150ms; &:hover, &.checked { background:#EEF4FF; } input[type=checkbox] { accent-color:#003399; width:16px; height:16px; flex-shrink:0; } }
    .test-opt-name { flex:1; font-size:0.875rem; font-weight:500; color:#0F172A; }
    .test-opt-cat { font-size:0.75rem; color:#94A3B8; }
    .test-opt-price { font-size:0.75rem; font-weight:600; color:#003399; }
    .no-tests { padding:1rem; text-align:center; color:#94A3B8; font-size:0.875rem; margin:0; }
    .sel-count { font-size:0.75rem; color:#003399; font-weight:500; margin:0.5rem 0 0 0; }
    .form-err { font-size:0.875rem; color:#DC2626; margin:0.5rem 0 0 0; }
  `]
})
export class AdminPackagesComponent implements OnInit {
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  formErr = signal('');
  packages = signal<Package[]>([]);
  filtered = signal<Package[]>([]);
  allTests = signal<Test[]>([]);
  showModal = signal(false);
  editId = signal<string | null>(null);
  searchQ = '';
  statusFilter = '';
  testSearchQ = '';
  filteredAvailableTests = signal<Test[]>([]);
  f = { name:'', description:'', original_price:0, discounted_price:0, is_popular:false, selectedTestIds:[] as string[] };

  // Make Number available in template
  Number = Number;

  constructor(private pkgApi: PackageApiService, private testApi: TestApiService, private confirm: ConfirmDialogService) {}

  ngOnInit() {
    this.load();
    this.testApi.list({ page_size: 500 }).subscribe({ next: r => { this.allTests.set(r.items); this.filteredAvailableTests.set(r.items); } });
  }

  load() {
    this.loading.set(true);
    this.pkgApi.list({ include_inactive: true, page_size: 100 }).subscribe({
      next: r => {
        // Ensure prices are numbers (backend sends Decimal as strings in JSON)
        const normalized = r.items.map(pkg => ({
          ...pkg,
          original_price: Number(pkg.original_price),
          discounted_price: Number(pkg.discounted_price)
        }));
        this.packages.set(normalized);
        this.applyFilter();
        this.loading.set(false);
      },
      error: () => { this.error.set('Failed to load packages.'); this.loading.set(false); }
    });
  }

  applyFilter() {
    const q = this.searchQ.toLowerCase();
    let list = this.packages();
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    if (this.statusFilter) list = list.filter(p => this.statusFilter === 'active' ? p.is_active : !p.is_active);
    this.filtered.set([...list]);
  }

  openCreate() { this.editId.set(null); this.f = { name:'', description:'', original_price:0, discounted_price:0, is_popular:false, selectedTestIds:[] }; this.testSearchQ = ''; this.filterAvailableTests(); this.formErr.set(''); this.showModal.set(true); }
  openEdit(p: Package) { this.editId.set(p.id); this.f = { name:p.name, description:p.description||'', original_price:p.original_price, discounted_price:p.discounted_price, is_popular:p.is_popular, selectedTestIds:(p.tests||[]).map(t=>t.id) }; this.testSearchQ = ''; this.filterAvailableTests(); this.formErr.set(''); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.editId.set(null); }
  filterAvailableTests() { const q = this.testSearchQ.toLowerCase(); this.filteredAvailableTests.set(q ? this.allTests().filter(t => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)) : [...this.allTests()]); }
  isSelected(t: Test) { return this.f.selectedTestIds.includes(t.id); }
  toggleTest(t: Test) { const idx = this.f.selectedTestIds.indexOf(t.id); idx >= 0 ? this.f.selectedTestIds.splice(idx, 1) : this.f.selectedTestIds.push(t.id); }
  getSavings(p: Package) {
    const original = Number(p.original_price);
    const discounted = Number(p.discounted_price);
    if (!original || original <= discounted) return 0;
    return Math.round(((original - discounted) / original) * 100);
  }

  async save() {
    if (!this.f.name.trim()) { this.formErr.set('Package name is required.'); return; }
    if (this.f.discounted_price < 0) { this.formErr.set('Price is required.'); return; }
    const id = this.editId();
    const ok = await this.confirm.askLiveChange(
      'The health package catalogue and the price customers are charged',
      [
        `${id ? 'Update' : 'Add'} package: ${this.f.name.trim()}`,
        `Price: ₹${+this.f.discounted_price}${+this.f.original_price ? ` (was ₹${+this.f.original_price})` : ''}`,
        `${this.f.selectedTestIds.length} tests included`,
        ...(this.f.is_popular ? ['Shown with a "Most Popular" badge'] : []),
      ],
    );
    if (!ok) return;
    this.saving.set(true);
    const payload: any = { name:this.f.name.trim(), description:this.f.description||null, original_price:+this.f.original_price, discounted_price:+this.f.discounted_price, is_popular:this.f.is_popular, test_ids:this.f.selectedTestIds };
    const obs = id ? this.pkgApi.update(id, payload) : this.pkgApi.create(payload);
    obs.subscribe({ next: () => { this.saving.set(false); this.closeModal(); this.load(); }, error: err => { this.formErr.set(err.error?.detail?.message || 'Failed to save.'); this.saving.set(false); } });
  }

  async remove(p: Package) {
    const ok = await this.confirm.askDelete(`package "${p.name}"`, 'It will disappear from the site immediately. This cannot be undone.');
    if (!ok) return;
    this.pkgApi.delete(p.id).subscribe({ next: () => this.load() });
  }

  async toggleActive(p: Package) {
    const ok = await this.confirm.askLiveChange('The health package catalogue', [`${p.is_active ? 'Hide' : 'Show'} "${p.name}" on the site`]);
    if (!ok) return;
    this.pkgApi.update(p.id, { is_active: !p.is_active } as any).subscribe({ next: () => this.load() });
  }
}
