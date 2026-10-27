import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestApiService } from '../../../core/api/services/test-api.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { FaqItem, FeatureCardItem, Test } from '../../../core/api/api.types';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent } from '../../../shared/components/select/select.component';

const SAMPLE_TYPES = ['Blood', 'Urine', 'Saliva', 'Stool', 'Serum', 'Plasma', 'Tissue', 'Swab', 'CSF', 'Sputum', 'Semen', 'Other'];

interface TestForm {
  name: string;
  category: string;
  price: number;
  discount: number;
  tat: number;
  active: boolean;
  popular: boolean;
  desc: string;
  sampleType: string;
  recommendedFor: { male: boolean; female: boolean; other: boolean };
  featureCards: FeatureCardItem[];
  faqs: FaqItem[];
}

function emptyForm(): TestForm {
  return {
    name: '', category: '', price: 0, discount: 0, tat: 24, active: true, popular: false, desc: '',
    sampleType: '',
    recommendedFor: { male: false, female: false, other: false },
    featureCards: [],
    faqs: [],
  };
}

@Component({
  selector: 'app-admin-tests',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent, SpinnerComponent, ButtonComponent, ModalComponent, AlertComponent, InputComponent, SelectComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div><h1 class="page-title">Tests Catalog</h1><p class="page-sub">Manage lab tests, pricing and availability</p></div>
    <app-button variant="primary" (click)="openCreate()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Test
    </app-button>
  </div>

  @if (error()) { <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">{{ error() }}</app-alert> }

  <div class="filter-bar">
    <div class="search-field">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input placeholder="Search tests, categories…" [(ngModel)]="searchQ" (input)="applyFilter()" />
    </div>
    <select class="filter-sel" [(ngModel)]="categoryFilter" (change)="applyFilter()">
      <option value="">All Categories</option>
      @for (c of categoryOptions(); track c) { <option [value]="c">{{ c }}</option> }
    </select>
    <select class="filter-sel" [(ngModel)]="statusFilter" (change)="applyFilter()">
      <option value="">All Status</option>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
    <span class="count-badge">{{ filtered().length }} tests</span>
  </div>

  @if (loading()) {
    <div class="load-wrap"><app-spinner size="md" /></div>
  } @else {
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Discount</th><th>TAT</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          @if (filtered().length === 0) { <tr><td colspan="7" class="empty-td">No tests found.</td></tr> }
          @for (t of filtered(); track t.id) {
            <tr>
              <td class="fw-med">{{ t.name }}</td>
              <td><app-badge color="info" size="sm">{{ t.category }}</app-badge></td>
              <td>
                <div class="price-col">
                  <span class="fw-med">₹{{ t.price }}</span>
                  @if (t.discount_percentage > 0) { <span class="eff-price">₹{{ t.effective_price }} eff.</span> }
                </div>
              </td>
              <td>{{ t.discount_percentage > 0 ? t.discount_percentage + '%' : '—' }}</td>
              <td class="text-muted">{{ t.turnaround_hours }}h</td>
              <td><app-badge [color]="t.is_active ? 'success' : 'default'" size="sm">{{ t.is_active ? 'Active' : 'Inactive' }}</app-badge></td>
              <td>
                <div class="row-acts">
                  <button class="act-btn" (click)="openEdit(t)" title="Edit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="act-btn" (click)="toggleActive(t)" [title]="t.is_active ? 'Deactivate' : 'Activate'">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button class="act-btn danger" (click)="remove(t)" title="Delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }

  <!-- Add / Edit Modal -->
  <app-modal [isOpen]="showModal()" [title]="editId() ? 'Edit Test' : 'New Test'" size="lg" (close)="closeModal()">
    <div class="form-sections">

      <div class="form-section">
        <h3 class="section-title">Basic Information</h3>
        <div class="form-grid">
          <div class="span2">
            <app-input label="Test Name" [required]="true" icon="biotech" placeholder="e.g. Complete Blood Count" [(ngModel)]="f.name" />
          </div>
          <app-input label="Category" [required]="true" icon="category" placeholder="e.g. Haematology" [(ngModel)]="f.category" />
          <app-input label="Price (₹)" [required]="true" icon="currency_rupee" type="number" [min]="0" [(ngModel)]="f.price" />
          <app-input label="Discount %" icon="percent" type="number" [min]="0" [max]="100" [(ngModel)]="f.discount" />
          <app-select label="Status" [options]="statusOptions" [(ngModel)]="f.active" />
          <div class="span2">
            <app-input label="Description" type="textarea" [rows]="2" placeholder="Optional" [(ngModel)]="f.desc" />
          </div>
          <div class="field span2">
            <label class="chk-opt"><input type="checkbox" [(ngModel)]="f.popular" /> Mark as "Most Popular"</label>
            <span class="field-hint">Shows a "Most Popular" badge on this test's card in the catalogue. Off by default.</span>
          </div>
        </div>
      </div>

      <div class="form-section">
        <h3 class="section-title">Test Details</h3>
        <div class="form-grid">
          <app-input label="Report Time (hours)" [required]="true" icon="schedule" type="number" [min]="1" [(ngModel)]="f.tat" />
          <app-select label="Sample Type" [options]="sampleTypeOptions" [(ngModel)]="f.sampleType" />
          <div class="field span2">
            <label>Recommended For</label>
            <div class="checkbox-row">
              <label class="chk-opt"><input type="checkbox" [(ngModel)]="f.recommendedFor.male" /> Male</label>
              <label class="chk-opt"><input type="checkbox" [(ngModel)]="f.recommendedFor.female" /> Female</label>
              <label class="chk-opt"><input type="checkbox" [(ngModel)]="f.recommendedFor.other" /> Other (Transgender)</label>
            </div>
            <span class="field-hint">Leave all unchecked to hide this section on the test page.</span>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="section-head-row">
          <h3 class="section-title">Feature Cards</h3>
          <button type="button" class="add-btn" (click)="addFeatureCard()">+ Add Card</button>
        </div>
        <p class="section-hint">Trust badges shown under the test summary (e.g. "NABL Accredited", icon: verified).</p>
        @if (f.featureCards.length === 0) { <p class="empty-hint">No feature cards added.</p> }
        @for (card of f.featureCards; track $index) {
          <div class="dyn-row">
            <app-input
              class="dyn-grow"
              size="sm"
              placeholder="Title, e.g. NABL Accredited"
              [(ngModel)]="card.title"
              [ngModelOptions]="{standalone: true}"
            />
            <app-input
              class="icon-inp"
              size="sm"
              placeholder="Icon, e.g. verified"
              [(ngModel)]="card.icon"
              [ngModelOptions]="{standalone: true}"
            />
            <label class="chk-opt enable-chk"><input type="checkbox" [(ngModel)]="card.enabled" [ngModelOptions]="{standalone: true}" /> Enabled</label>
            <div class="reorder-btns">
              <button type="button" class="mini-btn" (click)="moveFeatureCard($index, -1)" [disabled]="$index === 0" title="Move up">▲</button>
              <button type="button" class="mini-btn" (click)="moveFeatureCard($index, 1)" [disabled]="$index === f.featureCards.length - 1" title="Move down">▼</button>
            </div>
            <button type="button" class="mini-btn danger" (click)="removeFeatureCard($index)" title="Remove">✕</button>
          </div>
        }
      </div>

      <div class="form-section">
        <div class="section-head-row">
          <h3 class="section-title">FAQs</h3>
          <button type="button" class="add-btn" (click)="addFaq()">+ Add FAQ</button>
        </div>
        <p class="section-hint">Optional. Shown as an accordion on the test page — hidden entirely if empty.</p>
        @if (f.faqs.length === 0) { <p class="empty-hint">No FAQs added.</p> }
        @for (faq of f.faqs; track $index) {
          <div class="dyn-row faq-row">
            <div class="faq-fields">
              <app-input
                size="sm"
                placeholder="Question"
                [(ngModel)]="faq.question"
                [ngModelOptions]="{standalone: true}"
              />
              <app-input
                type="textarea"
                [rows]="2"
                placeholder="Answer"
                [(ngModel)]="faq.answer"
                [ngModelOptions]="{standalone: true}"
              />
            </div>
            <button type="button" class="mini-btn danger" (click)="removeFaq($index)" title="Remove">✕</button>
          </div>
        }
      </div>

    </div>
    @if (formErr()) { <p class="form-err">{{ formErr() }}</p> }
    <div modal-footer>
      <app-button variant="outline" (click)="closeModal()">Cancel</app-button>
      <app-button variant="primary" [loading]="saving()" (click)="save()">{{ editId() ? 'Update' : 'Create' }} Test</app-button>
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
    .table-wrap { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; overflow:hidden; }
    .tbl { width:100%; border-collapse:collapse; thead tr { background:#F8FAFC; } th { padding:0.75rem 1rem; text-align:left; font-size:0.75rem; font-weight:600; color:#94A3B8; text-transform:uppercase; letter-spacing:0.025em; border-bottom:1px solid #F1F5F9; } td { padding:0.875rem 1rem; border-bottom:1px solid #F1F5F9; font-size:0.875rem; color:#0F172A; } tbody tr:last-child td { border-bottom:none; } tbody tr:hover td { background:#F8FAFC; } }
    .fw-med { font-weight:500; }
    .price-col { display:flex; flex-direction:column; gap:1px; }
    .eff-price { font-size:0.75rem; color:#2F855A; }
    .text-muted { color:#94A3B8; }
    .empty-td { text-align:center; color:#94A3B8; padding:3rem !important; }
    .row-acts { display:flex; gap:0.5rem; }
    .act-btn { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFFFFF; cursor:pointer; transition:all 150ms; color:#475569; svg { width:15px; height:15px; } &:hover { background:#EEF4FF; border-color:#84A6FF; color:#003399; } &.danger:hover { background:#FEF2F2; border-color:#FCA5A5; color:#DC2626; } }

    .form-sections { display:flex; flex-direction:column; gap:1.5rem; }
    .form-section { border:1px solid #F1F5F9; border-radius:0.85rem; padding:1.1rem 1.25rem 1.25rem; background:#FAFBFF; }
    .section-title { font-size:0.9rem; font-weight:700; color:#0F172A; margin:0 0 0.9rem 0; }
    .section-head-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem; .section-title { margin-bottom:0; } }
    .section-hint { font-size:0.78rem; color:#94A3B8; margin:0.15rem 0 0.85rem 0; }
    .form-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1rem; }
    .field { display:flex; flex-direction:column; gap:0.375rem; &.span2 { grid-column:span 2; } label { font-size:0.875rem; font-weight:500; color:#0F172A; } }
    .field-hint { font-size:0.75rem; color:#94A3B8; }
    .form-err { font-size:0.875rem; color:#DC2626; margin:0.5rem 0 0 0; }

    .checkbox-row { display:flex; gap:1rem; flex-wrap:wrap; }
    .chk-opt { display:flex; align-items:center; gap:0.4rem; font-size:0.875rem; color:#334155; cursor:pointer; input { accent-color:#0047CC; } }

    .empty-hint { font-size:0.8rem; color:#94A3B8; margin:0.25rem 0 0.5rem; }
    .dyn-row { display:flex; align-items:center; gap:0.6rem; margin-bottom:0.6rem; &:last-child { margin-bottom:0; } }
    .dyn-row .dyn-grow { flex:1 1 auto; min-width:0; }
    .icon-inp { max-width:160px; flex:0 0 160px; }
    .enable-chk { flex:0 0 auto; white-space:nowrap; }
    .reorder-btns { display:flex; flex-direction:column; gap:2px; }
    .mini-btn { width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #E2E8F0; border-radius:0.4rem; background:#FFFFFF; cursor:pointer; font-size:0.65rem; color:#475569; &:hover:not(:disabled) { background:#EEF4FF; border-color:#84A6FF; color:#003399; } &:disabled { opacity:0.4; cursor:not-allowed; } &.danger:hover { background:#FEF2F2; border-color:#FCA5A5; color:#DC2626; } }
    .faq-row { align-items:flex-start; }
    .faq-fields { flex:1 1 auto; display:flex; flex-direction:column; gap:0.5rem; }
    .add-btn { border:1px dashed #0047CC; background:#EEF4FF; color:#003399; border-radius:0.6rem; padding:0.4rem 0.8rem; font-size:0.8rem; font-weight:600; cursor:pointer; &:hover { background:#EEF4FF; } }
  `]
})
export class AdminTestsComponent implements OnInit {
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  formErr = signal('');
  tests = signal<Test[]>([]);
  filtered = signal<Test[]>([]);
  showModal = signal(false);
  editId = signal<string | null>(null);
  searchQ = '';
  categoryFilter = '';
  statusFilter = '';
  categoryOptions = computed(() => [...new Set(this.tests().map(t => t.category))].sort());
  sampleTypes = SAMPLE_TYPES;
  readonly statusOptions = [
    { value: true, label: 'Active' },
    { value: false, label: 'Inactive' },
  ];
  readonly sampleTypeOptions = [
    { value: '', label: '— Not specified —' },
    ...SAMPLE_TYPES.map(s => ({ value: s, label: s })),
  ];
  f: TestForm = emptyForm();

  constructor(private testApi: TestApiService, private confirm: ConfirmDialogService) {}
  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.testApi.list({ page_size: 500, include_inactive: true }).subscribe({
      next: r => { this.tests.set(r.items); this.applyFilter(); this.loading.set(false); },
      error: () => { this.error.set('Failed to load tests.'); this.loading.set(false); }
    });
  }

  applyFilter() {
    const q = this.searchQ.toLowerCase();
    let list = this.tests();
    if (q) list = list.filter(t => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
    if (this.categoryFilter) list = list.filter(t => t.category === this.categoryFilter);
    if (this.statusFilter) list = list.filter(t => this.statusFilter === 'active' ? t.is_active : !t.is_active);
    this.filtered.set([...list]);
  }

  openCreate() { this.editId.set(null); this.f = emptyForm(); this.formErr.set(''); this.showModal.set(true); }

  openEdit(t: Test) {
    this.editId.set(t.id);
    const rf = new Set(t.recommended_for ?? []);
    this.f = {
      name: t.name, category: t.category, price: t.price, discount: t.discount_percentage,
      tat: t.turnaround_hours, active: t.is_active, popular: t.is_popular, desc: t.description || '',
      sampleType: t.sample_type || '',
      recommendedFor: { male: rf.has('male'), female: rf.has('female'), other: rf.has('other') },
      featureCards: (t.feature_cards ?? []).map(c => ({ ...c })),
      faqs: (t.faqs ?? []).map(f => ({ ...f })),
    };
    this.formErr.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); this.editId.set(null); }

  addFeatureCard() {
    this.f.featureCards.push({ title: '', icon: '', enabled: true, order: this.f.featureCards.length });
  }
  removeFeatureCard(i: number) { this.f.featureCards.splice(i, 1); }
  moveFeatureCard(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= this.f.featureCards.length) return;
    [this.f.featureCards[i], this.f.featureCards[j]] = [this.f.featureCards[j], this.f.featureCards[i]];
  }

  addFaq() { this.f.faqs.push({ question: '', answer: '' }); }
  removeFaq(i: number) { this.f.faqs.splice(i, 1); }

  async save() {
    if (!this.f.name.trim()) { this.formErr.set('Test name is required.'); return; }
    if (!this.f.category.trim()) { this.formErr.set('Category is required.'); return; }
    if (this.f.price < 0) { this.formErr.set('Valid price is required.'); return; }

    const id = this.editId();
    const discount = +this.f.discount || 0;
    const effective = Math.round(+this.f.price * (1 - discount / 100));
    const ok = await this.confirm.askLiveChange(
      'The test catalogue and the price customers are charged',
      [
        `${id ? 'Update' : 'Add'} test: ${this.f.name.trim()}`,
        `Price: ₹${+this.f.price}${discount ? ` − ${discount}% → ₹${effective}` : ''}`,
        ...(id ? [`Visible on site: ${this.f.active ? 'yes' : 'no'}`] : []),
        ...(this.f.popular ? ['Shown with a "Most Popular" badge'] : []),
      ],
    );
    if (!ok) return;

    const recommendedFor: string[] = [];
    if (this.f.recommendedFor.male) recommendedFor.push('male');
    if (this.f.recommendedFor.female) recommendedFor.push('female');
    if (this.f.recommendedFor.other) recommendedFor.push('other');

    const featureCards = this.f.featureCards
      .filter(c => c.title.trim() && c.icon.trim())
      .map((c, i) => ({ ...c, order: i }));
    const faqs = this.f.faqs.filter(f => f.question.trim() && f.answer.trim());

    this.saving.set(true);
    const payload: any = {
      name: this.f.name.trim(), category: this.f.category.trim(), description: this.f.desc || null,
      price: +this.f.price, discount_percentage: +this.f.discount || 0, turnaround_hours: +this.f.tat,
      is_popular: this.f.popular,
      // Empty string (not null) — TestUpdate applies partial updates via
      // exclude_none, so null would silently skip clearing an existing value.
      sample_type: this.f.sampleType,
      recommended_for: recommendedFor,
      feature_cards: featureCards,
      faqs: faqs,
    };
    const obs = id ? this.testApi.update(id, { ...payload, is_active: this.f.active }) : this.testApi.create(payload);
    obs.subscribe({ next: () => { this.saving.set(false); this.closeModal(); this.load(); }, error: err => { this.formErr.set(err.error?.detail?.message || err.error?.message || 'Failed to save.'); this.saving.set(false); } });
  }

  async remove(t: Test) {
    const ok = await this.confirm.askDelete(`test "${t.name}"`, 'It will disappear from the site immediately. This cannot be undone.');
    if (!ok) return;
    this.testApi.delete(t.id).subscribe({ next: () => this.load(), error: () => this.error.set('Failed to delete.') });
  }

  async toggleActive(t: Test) {
    const ok = await this.confirm.askLiveChange('The test catalogue', [`${t.is_active ? 'Hide' : 'Show'} "${t.name}" on the site`]);
    if (!ok) return;
    this.testApi.update(t.id, { is_active: !t.is_active }).subscribe({ next: () => this.load() });
  }
}
