import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FaqApiService } from '../../../core/api/services/faq-api.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { AdminFaq, FaqPayload } from '../../../core/api/api.types';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent } from '../../../shared/components/select/select.component';

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'booking', label: 'Booking & Scheduling' },
  { value: 'home_collection', label: 'Home Collection' },
  { value: 'reports', label: 'Reports' },
  { value: 'payments', label: 'Payments & Refunds' },
  { value: 'account', label: 'Account' },
];

@Component({
  selector: 'app-admin-faqs',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, SpinnerComponent, ButtonComponent, ModalComponent, AlertComponent, InputComponent, SelectComponent],
  template: `
<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">FAQs</h1>
      <p class="page-sub">Manage the general questions shown on the public FAQ page and Contact page</p>
    </div>
    <app-button variant="primary" (click)="openCreate()">
      <mat-icon>add</mat-icon> Add FAQ
    </app-button>
  </div>

  @if (error()) { <app-alert [variant]="'error'" [dismissible]="true" (dismiss)="error.set('')">{{ error() }}</app-alert> }
  @if (notice()) { <app-alert [variant]="'success'" [dismissible]="true" (dismiss)="notice.set('')">{{ notice() }}</app-alert> }

  @if (loading()) {
    <div class="load-wrap"><app-spinner size="md" /></div>
  } @else if (faqs().length === 0) {
    <div class="empty">
      <mat-icon>quiz</mat-icon>
      <p>No FAQs yet. Add your first question.</p>
    </div>
  } @else {
    <div class="table-wrap">
      <table class="faq-table">
        <thead>
          <tr>
            <th style="width:56px">#</th>
            <th style="width:170px">Category</th>
            <th>Question</th>
            <th style="width:90px">Status</th>
            <th style="width:110px">Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (f of faqs(); track f.id) {
            <tr [class.inactive]="!f.is_active">
              <td class="ord">{{ f.display_order }}</td>
              <td><span class="cat-badge">{{ categoryLabel(f.category) }}</span></td>
              <td class="q-cell">{{ f.question }}</td>
              <td>
                <span class="status" [class.on]="f.is_active">{{ f.is_active ? 'Active' : 'Hidden' }}</span>
              </td>
              <td class="actions">
                <button class="icon-btn" title="Edit" (click)="openEdit(f)"><mat-icon>edit</mat-icon></button>
                <button class="icon-btn danger" title="Delete" (click)="confirmDelete(f)"><mat-icon>delete</mat-icon></button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }

  <!-- Create / Edit modal -->
  <app-modal
    [isOpen]="showModal()"
    [title]="editing() ? 'Edit FAQ' : 'Add FAQ'"
    size="md"
    (close)="closeModal()"
  >
    <div class="form">
      <app-select label="Category" [options]="categoryOptions" [(ngModel)]="form.category" />
      <app-input
        label="Question"
        icon="help_outline"
        placeholder="e.g. How do I book a test?"
        [maxlength]="300"
        [(ngModel)]="form.question"
      />
      <app-input
        label="Answer"
        type="textarea"
        [rows]="5"
        placeholder="Write a clear, helpful answer…"
        [(ngModel)]="form.answer"
      />
      <div class="field-row">
        <div class="field-sm">
          <app-input label="Display order" type="number" [min]="0" [(ngModel)]="form.display_order" />
        </div>
        <label class="check">
          <input type="checkbox" [(ngModel)]="form.is_active" />
          <span>Visible to customers</span>
        </label>
      </div>
      @if (formErr()) { <p class="form-err">{{ formErr() }}</p> }
    </div>
    <div modal-footer>
      <app-button variant="outline" (click)="closeModal()">Cancel</app-button>
      <app-button variant="primary" [loading]="saving()" (click)="save()">{{ editing() ? 'Save Changes' : 'Add FAQ' }}</app-button>
    </div>
  </app-modal>

  <!-- Delete confirm -->
  <app-modal [isOpen]="!!deleteTarget()" title="Delete FAQ" size="sm" (close)="deleteTarget.set(null)">
    <p class="confirm-text">Delete this FAQ? This cannot be undone.</p>
    @if (deleteTarget()) { <p class="confirm-q">"{{ deleteTarget()!.question }}"</p> }
    <div modal-footer>
      <app-button variant="outline" (click)="deleteTarget.set(null)">Cancel</app-button>
      <app-button variant="danger" [loading]="deleting()" (click)="doDelete()">Delete</app-button>
    </div>
  </app-modal>
</div>`,
  styles: [`
    .page { padding: 1.5rem; max-width: 1100px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .page-title { font-size: 1.5rem; font-weight: 800; color: #0F172A; margin: 0 0 .25rem; }
    .page-sub { color: #64748B; font-size: .9rem; margin: 0; }
    .load-wrap { display: flex; justify-content: center; padding: 3rem; }
    .empty { text-align: center; color: #94A3B8; padding: 3rem 1rem; }
    .empty mat-icon { font-size: 40px; width: 40px; height: 40px; }

    .table-wrap { background: #fff; border: 1px solid #E2E8F0; border-radius: .9rem; overflow: hidden; }
    .faq-table { width: 100%; border-collapse: collapse; font-size: .9rem; }
    .faq-table th { text-align: left; padding: .8rem 1rem; background: #F8FAFC; color: #64748B; font-weight: 600; font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #E2E8F0; }
    .faq-table td { padding: .8rem 1rem; border-bottom: 1px solid #F1F5F9; color: #334155; vertical-align: top; }
    .faq-table tr:last-child td { border-bottom: none; }
    .faq-table tr.inactive { opacity: .55; }
    .ord { color: #94A3B8; font-variant-numeric: tabular-nums; }
    .q-cell { color: #0F172A; font-weight: 500; }
    .cat-badge { display: inline-block; background: #EEF4FF; color: #0047CC; font-size: .74rem; font-weight: 600; padding: .2rem .6rem; border-radius: 999px; white-space: nowrap; }
    .status { font-size: .78rem; font-weight: 600; color: #94A3B8; }
    .status.on { color: #0F9D6C; }
    .actions { white-space: nowrap; }
    .icon-btn { background: none; border: none; cursor: pointer; color: #64748B; padding: .3rem; border-radius: .4rem; display: inline-flex; }
    .icon-btn:hover { background: #F1F5F9; color: #0047CC; }
    .icon-btn.danger:hover { background: #FEF2F2; color: #DC2626; }
    .icon-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .form { display: flex; flex-direction: column; gap: 1rem; }
    .field-row { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
    .field-sm { width: 140px; }
    .check { display: flex; align-items: center; gap: .5rem; font-size: .88rem; color: #334155; cursor: pointer; margin-top: 1.2rem; }
    .form-err { color: #DC2626; font-size: .85rem; margin: 0; }
    .confirm-text { color: #334155; margin: 0 0 .5rem; }
    .confirm-q { color: #64748B; font-style: italic; margin: 0; }
  `],
})
export class AdminFaqsComponent implements OnInit {
  categoryOptions = CATEGORY_OPTIONS;

  loading = signal(true);
  saving = signal(false);
  deleting = signal(false);
  error = signal('');
  notice = signal('');
  formErr = signal('');

  faqs = signal<AdminFaq[]>([]);
  showModal = signal(false);
  editing = signal<AdminFaq | null>(null);
  deleteTarget = signal<AdminFaq | null>(null);

  form: FaqPayload = this.blankForm();

  constructor(private faqApi: FaqApiService, private confirm: ConfirmDialogService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.faqApi.listAll().subscribe({
      next: (faqs) => { this.faqs.set(faqs); this.loading.set(false); },
      error: () => { this.error.set('Failed to load FAQs.'); this.loading.set(false); },
    });
  }

  categoryLabel(value: string): string {
    return CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value;
  }

  private blankForm(): FaqPayload {
    return { category: 'general', question: '', answer: '', display_order: 0, is_active: true };
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = this.blankForm();
    this.formErr.set('');
    this.showModal.set(true);
  }

  openEdit(f: AdminFaq): void {
    this.editing.set(f);
    this.form = {
      category: f.category,
      question: f.question,
      answer: f.answer,
      display_order: f.display_order,
      is_active: f.is_active,
    };
    this.formErr.set('');
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); }

  async save(): Promise<void> {
    if (!this.form.question.trim() || !this.form.answer.trim()) {
      this.formErr.set('Question and answer are required.');
      return;
    }
    const editing = this.editing();
    const ok = await this.confirm.askLiveChange(
      "The public FAQ page and the contact page's FAQ section",
      [`${editing ? 'Update' : 'Add'} FAQ: "${this.form.question.trim()}"`],
    );
    if (!ok) return;
    this.saving.set(true);
    this.formErr.set('');
    const req = editing
      ? this.faqApi.update(editing.id, this.form)
      : this.faqApi.create(this.form);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.notice.set(editing ? 'FAQ updated.' : 'FAQ added.');
        this.load();
      },
      error: () => { this.saving.set(false); this.formErr.set('Could not save. Please try again.'); },
    });
  }

  confirmDelete(f: AdminFaq): void { this.deleteTarget.set(f); }

  doDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleting.set(true);
    this.faqApi.delete(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.notice.set('FAQ deleted.');
        this.load();
      },
      error: () => { this.deleting.set(false); this.error.set('Could not delete FAQ.'); this.deleteTarget.set(null); },
    });
  }
}
