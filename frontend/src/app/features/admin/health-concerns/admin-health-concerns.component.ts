import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HealthConcernApiService } from '../../../core/api/services/health-concern-api.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { TestApiService } from '../../../core/api/services/test-api.service';
import { PackageApiService } from '../../../core/api/services/package-api.service';
import { HealthConcern, Test, Package } from '../../../core/api/api.types';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';

type MappingMode = 'tests' | 'packages';

@Component({
  selector: 'app-admin-health-concerns',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, SpinnerComponent, ButtonComponent, ModalComponent, AlertComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div><h1 class="page-title">Health Concerns</h1><p class="page-sub">Map each health concern to the tests and packages patients should see when they select it</p></div>
  </div>

  @if (error()) { <app-alert [variant]="'error'" [dismissible]="true" (dismiss)="error.set('')">{{ error() }}</app-alert> }

  @if (loading()) {
    <div class="load-wrap"><app-spinner size="md" /></div>
  } @else {
    <div class="concerns-grid">
      @for (c of concerns(); track c.id) {
        <div class="concern-card">
          <div class="concern-icon"><mat-icon>{{ c.icon }}</mat-icon></div>
          <h3 class="concern-name">{{ c.name }}</h3>
          <div class="concern-actions">
            <button class="act-btn" (click)="openMappingModal(c, 'tests')">
              <mat-icon>biotech</mat-icon> Manage Tests
            </button>
            <button class="act-btn" (click)="openMappingModal(c, 'packages')">
              <mat-icon>inventory_2</mat-icon> Manage Packages
            </button>
          </div>
        </div>
      }
    </div>
  }

  <!-- Mapping modal -->
  <app-modal
    [isOpen]="showModal()"
    [title]="activeConcern() ? (modalMode() === 'tests' ? 'Tests for ' : 'Packages for ') + activeConcern()!.name : ''"
    size="lg"
    (close)="closeModal()"
  >
    <div class="item-selector">
      <div class="item-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input [(ngModel)]="searchQ" placeholder="Search {{ modalMode() }}…" (input)="filterAvailable()" />
      </div>
      <div class="item-list">
        @for (item of filteredAvailable(); track item.id) {
          <label class="item-option" [class.checked]="isSelected(item.id)">
            <input type="checkbox" [checked]="isSelected(item.id)" (change)="toggleItem(item.id)" />
            <span class="item-opt-name">{{ item.name }}</span>
            @if (modalMode() === 'tests') {
              <span class="item-opt-meta">{{ asTest(item).category }}</span>
            }
          </label>
        }
        @if (filteredAvailable().length === 0) { <p class="no-items">No {{ modalMode() }} found</p> }
      </div>
    </div>
    <p class="sel-count">{{ selectedIds().size }} {{ modalMode() }} selected</p>
    @if (formErr()) { <p class="form-err">{{ formErr() }}</p> }
    <div modal-footer>
      <app-button variant="outline" (click)="closeModal()">Cancel</app-button>
      <app-button variant="primary" [loading]="saving()" (click)="saveMapping()">Save</app-button>
    </div>
  </app-modal>
</div>`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; }
    .page-title { font-size:1.5rem; font-weight:700; color:#0F172A; margin:0 0 0.25rem 0; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }
    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .concerns-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:1.25rem; }
    .concern-card { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; padding:1.5rem; display:flex; flex-direction:column; align-items:center; gap:0.75rem; text-align:center; transition:all 150ms; }
    .concern-card:hover { border-color:#84A6FF; box-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1); }
    .concern-icon { width:48px; height:48px; border-radius:0.75rem; background:#D9E5FF; color:#003399; display:flex; align-items:center; justify-content:center; }
    .concern-name { font-size:1rem; font-weight:600; color:#0F172A; margin:0; }
    .concern-actions { display:flex; flex-direction:column; gap:0.5rem; width:100%; }
    .act-btn { display:inline-flex; align-items:center; justify-content:center; gap:0.5rem; padding:0.5rem 0.75rem; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFFFFF; font-size:0.75rem; font-weight:500; color:#475569; cursor:pointer; transition:all 150ms; }
    .act-btn mat-icon { font-size:15px; width:15px; height:15px; }
    .act-btn:hover { background:#EEF4FF; border-color:#84A6FF; color:#002577; }
    .item-selector { border:1px solid #E2E8F0; border-radius:0.75rem; overflow:hidden; }
    .item-search { display:flex; align-items:center; gap:0.5rem; padding:0.625rem 0.875rem; border-bottom:1px solid #F1F5F9; }
    .item-search svg { width:16px; height:16px; color:#94A3B8; flex-shrink:0; }
    .item-search input { border:none; outline:none; font-size:0.875rem; width:100%; background:transparent; }
    .item-list { max-height:320px; overflow-y:auto; }
    .item-option { display:flex; align-items:center; gap:0.75rem; padding:0.75rem 1rem; cursor:pointer; transition:background 150ms; }
    .item-option:hover, .item-option.checked { background:#EEF4FF; }
    .item-option input[type=checkbox] { accent-color:#003399; width:16px; height:16px; flex-shrink:0; }
    .item-opt-name { flex:1; font-size:0.875rem; font-weight:500; color:#0F172A; }
    .item-opt-meta { font-size:0.75rem; color:#94A3B8; }
    .no-items { padding:1rem; text-align:center; color:#94A3B8; font-size:0.875rem; margin:0; }
    .sel-count { font-size:0.75rem; color:#003399; font-weight:500; margin:0.75rem 0 0 0; }
    .form-err { font-size:0.875rem; color:#DC2626; margin:0.5rem 0 0 0; }
  `],
})
export class AdminHealthConcernsComponent implements OnInit {
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  formErr = signal('');

  concerns = signal<HealthConcern[]>([]);
  allTests = signal<Test[]>([]);
  allPackages = signal<Package[]>([]);

  showModal = signal(false);
  activeConcern = signal<HealthConcern | null>(null);
  modalMode = signal<MappingMode>('tests');
  selectedIds = signal<Set<string>>(new Set());
  searchQ = '';
  filteredAvailable = signal<(Test | Package)[]>([]);

  constructor(
    private healthConcernApi: HealthConcernApiService,
    private testApi: TestApiService,
    private packageApi: PackageApiService,
    private confirm: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.load();
    this.testApi.list({ page_size: 500 }).subscribe({ next: (r) => this.allTests.set(r.items) });
    this.packageApi.list({ include_inactive: true, page_size: 100 }).subscribe({ next: (r) => this.allPackages.set(r.items) });
  }

  load(): void {
    this.loading.set(true);
    this.healthConcernApi.list().subscribe({
      next: (list) => { this.concerns.set(list); this.loading.set(false); },
      error: () => { this.error.set('Failed to load health concerns.'); this.loading.set(false); },
    });
  }

  asTest(item: Test | Package): Test {
    return item as Test;
  }

  openMappingModal(concern: HealthConcern, mode: MappingMode): void {
    this.activeConcern.set(concern);
    this.modalMode.set(mode);
    this.searchQ = '';
    this.formErr.set('');
    this.filterAvailable();
    this.healthConcernApi.getMappings(concern.id).subscribe({
      next: (mapping) => {
        const ids = mode === 'tests' ? mapping.test_ids : mapping.package_ids;
        this.selectedIds.set(new Set(ids));
      },
    });
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.activeConcern.set(null);
  }

  filterAvailable(): void {
    const source = this.modalMode() === 'tests' ? this.allTests() : this.allPackages();
    const q = this.searchQ.toLowerCase();
    this.filteredAvailable.set(
      q ? source.filter((item) => item.name.toLowerCase().includes(q)) : [...source]
    );
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleItem(id: string): void {
    const next = new Set(this.selectedIds());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectedIds.set(next);
  }

  async saveMapping(): Promise<void> {
    const concern = this.activeConcern();
    if (!concern) return;
    const kind = this.modalMode() === 'tests' ? 'tests' : 'packages';
    const ok = await this.confirm.askLiveChange(
      `What visitors see under the "${concern.name}" health concern`,
      [`${this.selectedIds().size} ${kind} mapped to "${concern.name}"`],
    );
    if (!ok) return;
    this.saving.set(true);
    const ids = Array.from(this.selectedIds());
    const obs = this.modalMode() === 'tests'
      ? this.healthConcernApi.setTests(concern.id, ids)
      : this.healthConcernApi.setPackages(concern.id, ids);
    obs.subscribe({
      next: () => { this.saving.set(false); this.closeModal(); },
      error: () => { this.formErr.set('Failed to save mapping.'); this.saving.set(false); },
    });
  }
}
