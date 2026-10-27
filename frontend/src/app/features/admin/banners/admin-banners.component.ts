import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { BannerApiService } from '../../../core/api/services/banner-api.service';
import { PackageApiService } from '../../../core/api/services/package-api.service';
import { CouponApiService } from '../../../core/api/services/coupon-api.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import {
  AdminBanner, BANNER_HIGHLIGHTS, Banner, BannerCategory, BannerPayload, BannerStatus, BannerType,
  Coupon, Package,
} from '../../../core/api/api.types';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { HeroCarouselComponent } from '../../../shared/components/hero-carousel/hero-carousel.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent } from '../../../shared/components/select/select.component';

interface BannerForm {
  title: string;
  subtitle: string;
  description: string;
  cta_text: string;
  cta_link: string;
  cta2_text: string;
  cta2_link: string;
  highlights: string[];
  category: BannerCategory;
  banner_type: BannerType;
  coupon_id: string | null;
  display_order: number;
  status: BannerStatus;
}

const CATEGORIES: { value: BannerCategory; label: string }[] = [
  { value: 'packages', label: 'Packages' },
  { value: 'home_collection', label: 'Home Collection' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'health_awareness', label: 'Health Awareness' },
  { value: 'offers', label: 'Offers' },
  { value: 'diagnostics', label: 'Diagnostic Tests' },
];

const BANNER_TYPES: { value: BannerType; label: string }[] = [
  { value: 'advertisement', label: 'Advertisement' },
  { value: 'promotional_offer', label: 'Promotional Offer' },
];


@Component({
  selector: 'app-admin-banners',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DragDropModule, BadgeComponent, SpinnerComponent,
    ButtonComponent, ModalComponent, AlertComponent, HeroCarouselComponent,
    InputComponent, SelectComponent,
  ],
  template: `
<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Homepage Banners</h1>
      <p class="page-sub">Manage the hero carousel — drag rows to reorder, then edit, publish or preview each banner.</p>
    </div>
    <app-button variant="primary" (click)="openCreate()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Banner
    </app-button>
  </div>

  @if (error()) { <app-alert variant="error" [dismissible]="true" (dismiss)="error.set('')">{{ error() }}</app-alert> }
  @if (notice()) { <app-alert variant="success" [dismissible]="true" (dismiss)="notice.set('')">{{ notice() }}</app-alert> }

  @if (loading()) {
    <div class="load-wrap"><app-spinner size="md" /></div>
  } @else {
    @if (banners().length === 0) {
      <div class="empty-card">No banners yet. Click “Add Banner” to create your first hero slide.</div>
    } @else {
      <div class="list" cdkDropList (cdkDropListDropped)="onDrop($event)">
        @for (b of banners(); track b.id) {
          <div class="row" cdkDrag [class.inactive]="b.status !== 'published'">
            <span class="drag" cdkDragHandle title="Drag to reorder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
            </span>
            <div class="thumb" [class]="'cat-' + b.category">
              @if (b.desktop_image_url) {
                <img [src]="b.desktop_image_url" [alt]="b.title || 'Banner image'" />
              } @else {
                <span class="thumb-order">{{ b.display_order }}</span>
              }
            </div>
            <div class="row-main">
              <div class="row-title">{{ b.title || '(Image only — no title)' }}</div>
              <div class="row-sub">{{ b.subtitle }}</div>
              <div class="row-meta">
                <app-badge [color]="b.banner_type === 'promotional_offer' ? 'warning' : 'default'" size="sm">{{ b.banner_type === 'promotional_offer' ? 'Offer' : 'Ad' }}</app-badge>
                @if (b.banner_type === 'promotional_offer') {
                  <app-badge [color]="'info'" size="sm">{{ discountSummary(b) }}</app-badge>
                }
                <app-badge [color]="'info'" size="sm">{{ categoryLabel(b.category) }}</app-badge>
                <app-badge [color]="b.status === 'published' ? 'success' : 'warning'" size="sm">{{ b.status === 'published' ? 'Published' : 'Draft' }}</app-badge>
              </div>
            </div>
            <div class="row-actions">
              <button class="act-btn" (click)="preview(b)">Preview</button>
              <button class="act-btn" (click)="togglePublish(b)">{{ b.status === 'published' ? 'Unpublish' : 'Publish' }}</button>
              <button class="act-btn" (click)="openEdit(b)">Edit</button>
              <button class="act-btn danger" (click)="remove(b)">Delete</button>
            </div>
          </div>
        }
      </div>
    }
  }

  <!-- ── Create / Edit modal ─────────────────────────────────────────────── -->
  <app-modal [isOpen]="showModal()" [title]="editId() ? 'Edit Banner' : 'Add Banner'" size="xl" (close)="closeModal()">
    <div class="form-grid">
      <div class="span2">
        <app-select label="Banner Type" [options]="bannerTypes" [(ngModel)]="f.banner_type" />
      </div>

      <div class="span2">
        <app-input
          [label]="f.banner_type === 'advertisement' ? 'Title *' : 'Title'"
          icon="title"
          placeholder="e.g. Complete Health Checkup at Affordable Prices"
          [hint]="f.banner_type === 'advertisement' ? 'Required for advertisement banners.' : 'Leave blank for an image-only banner.'"
          [(ngModel)]="f.title"
        />
      </div>
      <div class="span2">
        <app-input
          [label]="f.banner_type === 'advertisement' ? 'Subtitle *' : 'Subtitle'"
          type="textarea"
          [rows]="2"
          [(ngModel)]="f.subtitle"
        />
      </div>
      <div class="span2">
        <app-input label="Description" type="textarea" [rows]="2" [(ngModel)]="f.description" />
      </div>

      <app-select label="Category" [options]="categories" [(ngModel)]="f.category" />
      <app-input label="Display Order / Priority" icon="sort" type="number" [(ngModel)]="f.display_order" />

      <app-input label="Primary CTA Text" icon="ads_click" placeholder="Book Now" [(ngModel)]="f.cta_text" />
      <div>
        <app-input label="Primary CTA Link" icon="link" placeholder="/packages" [(ngModel)]="f.cta_link" />
        <app-select class="pkg-link-picker" placeholder="Or pick a package to link to…" [options]="packageLinkOptions()" [(ngModel)]="f.cta_link" />
      </div>
      <app-input label="Secondary CTA Text" icon="ads_click" placeholder="View Packages" [(ngModel)]="f.cta2_text" />
      <div>
        <app-input label="Secondary CTA Link" icon="link" placeholder="/packages" [(ngModel)]="f.cta2_link" />
        <app-select class="pkg-link-picker" placeholder="Or pick a package to link to…" [options]="packageLinkOptions()" [(ngModel)]="f.cta2_link" />
      </div>

      <div class="span2">
        <label class="pkg-label">Highlights</label>
        <div class="pkg-list">
          @for (h of highlightOptions; track h) {
            <label class="pkg-item">
              <input type="checkbox" [checked]="isHighlightSelected(h)" (change)="toggleHighlight(h)" />
              <span>{{ h }}</span>
            </label>
          }
        </div>
      </div>

      @if (f.banner_type === 'promotional_offer') {
        <div class="span2 promo-block">
          <h4 class="block-title">Promotional Offer Details</h4>
        </div>
        <div class="span2">
          <app-select
            label="Linked Coupon (optional)"
            placeholder="No coupon linked"
            [options]="couponOptions()"
            [(ngModel)]="f.coupon_id"
          />
          <p class="hint">Shows the coupon's code as a badge on this banner. The discount itself is configured on the Coupons page.</p>
        </div>
      }

      <div class="span2">
        <app-select label="Status" [options]="statusOptions" [(ngModel)]="f.status" />
      </div>
    </div>

    <!-- Images (available once the banner exists) -->
    <div class="images-block">
      <h4 class="block-title">Banner Images</h4>
      @if (!editId()) {
        <p class="hint">Save the banner first, then re-open it to upload desktop &amp; mobile images.</p>
      } @else {
        <div class="images-grid">
          <div class="img-slot">
            <div class="img-preview" [class]="'cat-' + f.category">
              @if (editingBanner()?.desktop_image_url) { <img [src]="editingBanner()!.desktop_image_url!" alt="Desktop banner" /> }
              @else { <span>No desktop image</span> }
            </div>
            <label class="upload-btn">
              {{ uploadingDesktop() ? 'Uploading…' : 'Upload Desktop Image' }}
              <input type="file" accept="image/*" hidden (change)="onImage($event, 'desktop')" [disabled]="uploadingDesktop()" />
            </label>
          </div>
          <div class="img-slot">
            <div class="img-preview img-preview--mobile" [class]="'cat-' + f.category">
              @if (editingBanner()?.mobile_image_url) { <img [src]="editingBanner()!.mobile_image_url!" alt="Mobile banner" /> }
              @else { <span>No mobile image</span> }
            </div>
            <label class="upload-btn">
              {{ uploadingMobile() ? 'Uploading…' : 'Upload Mobile Image' }}
              <input type="file" accept="image/*" hidden (change)="onImage($event, 'mobile')" [disabled]="uploadingMobile()" />
            </label>
          </div>
        </div>
      }
    </div>

    @if (modalMsg()) { <p class="form-ok">{{ modalMsg() }}</p> }
    @if (formErr()) { <p class="form-err">{{ formErr() }}</p> }
    <div modal-footer>
      <app-button variant="outline" (click)="previewForm()">Preview</app-button>
      <app-button variant="outline" (click)="save('draft')" [loading]="saving()">Save as Draft</app-button>
      <app-button variant="primary" (click)="save('published')" [loading]="saving()">{{ editId() ? 'Save & Publish' : 'Publish' }}</app-button>
    </div>
  </app-modal>

  <!-- ── Preview modal ───────────────────────────────────────────────────── -->
  <app-modal [isOpen]="showPreview()" title="Banner Preview" size="full" (close)="showPreview.set(false)">
    @if (previewBanner()) {
      <app-hero-carousel [banners]="[previewBanner()!]" [interval]="0" />
    }
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
    .cdk-drag-preview { box-shadow:0 10px 30px rgba(0,0,0,.2); border-radius:1rem; }
    .cdk-drag-placeholder { opacity:.35; }
    .cdk-drag-animating { transition:transform 220ms cubic-bezier(0,0,0.2,1); }
    .drag { cursor:grab; color:#94A3B8; display:flex; }
    .drag svg { width:20px; height:20px; }
    .thumb { width:88px; height:56px; border-radius:0.5rem; overflow:hidden; flex-shrink:0; display:grid; place-items:center; color:#FFF; background:linear-gradient(120deg,#0F4C81,#2563EB); }
    .thumb img { width:100%; height:100%; object-fit:cover; }
    .thumb-order { font-weight:700; font-size:1.1rem; }
    .cat-home_collection { background:linear-gradient(120deg,#0B7A75,#00A6A6); }
    .cat-corporate { background:linear-gradient(120deg,#0F2E56,#2563EB); }
    .cat-diagnostics { background:linear-gradient(120deg,#123B6B,#00A6A6); }
    .cat-offers { background:linear-gradient(120deg,#0F4C81,#7C3AED); }
    .cat-health_awareness { background:linear-gradient(120deg,#0B7A75,#22C55E); }
    .row-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:0.35rem; }
    .row-title { font-weight:600; color:#0F172A; font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .row-sub { font-size:0.8rem; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .row-meta { display:flex; gap:0.4rem; flex-wrap:wrap; }
    .row-actions { display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end; }
    .act-btn { padding:0.4rem 0.65rem; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFF; font-size:0.75rem; font-weight:500; color:#475569; cursor:pointer; transition:all 150ms; white-space:nowrap; }
    .act-btn:hover { background:#EEF4FF; border-color:#84A6FF; color:#002577; }
    .act-btn.danger:hover { background:#FEF2F2; border-color:#FCA5A5; color:#DC2626; }

    .form-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1rem; }
    .field { display:flex; flex-direction:column; gap:0.375rem; }
    .field.span2 { grid-column:span 2; }
    .span2 { grid-column:span 2; }
    .field label { font-size:0.8rem; font-weight:500; color:#0F172A; }

    .pkg-link-picker { margin-top:0.375rem; }
    .promo-block { margin-top:0.25rem; }
    .pkg-label { font-size:0.8rem; font-weight:500; color:#0F172A; display:block; margin-bottom:0.375rem; }
    .pkg-list { display:grid; grid-template-columns:repeat(2,1fr); gap:0.5rem; max-height:180px; overflow-y:auto; border:1px solid #E2E8F0; border-radius:0.5rem; padding:0.75rem; }
    .pkg-item { display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:#334155; cursor:pointer; }

    .images-block { margin-top:1.25rem; border-top:1px solid #F1F5F9; padding-top:1rem; }
    .block-title { font-size:0.95rem; font-weight:600; color:#0F172A; margin:0 0 0.5rem; }
    .hint { font-size:0.8rem; color:#94A3B8; margin:0; }
    .images-grid { display:grid; grid-template-columns:2fr 1fr; gap:1rem; }
    .img-slot { display:flex; flex-direction:column; gap:0.5rem; }
    .img-preview { border-radius:0.65rem; height:120px; display:grid; place-items:center; color:#FFF; overflow:hidden; background:linear-gradient(120deg,#0F4C81,#2563EB); font-size:0.8rem; }
    .img-preview img { width:100%; height:100%; object-fit:cover; }
    .img-preview--mobile { max-width:160px; }
    .upload-btn { display:inline-flex; justify-content:center; padding:0.5rem 0.75rem; border:1px dashed #84A6FF; border-radius:0.5rem; background:#EEF4FF; color:#0F4C81; font-size:0.8rem; font-weight:500; cursor:pointer; }
    .upload-btn:hover { background:#E0EAFF; }

    .form-err { font-size:0.875rem; color:#DC2626; margin:0.75rem 0 0; }
    .form-ok { font-size:0.85rem; color:#15803D; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:0.5rem; padding:0.6rem 0.8rem; margin:0.75rem 0 0; }

    @media (max-width:720px) {
      .form-grid { grid-template-columns:1fr; }
      .field.span2 { grid-column:span 1; }
      .row { flex-wrap:wrap; }
    }
  `],
})
export class AdminBannersComponent implements OnInit {
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  notice = signal('');
  formErr = signal('');
  banners = signal<AdminBanner[]>([]);
  showModal = signal(false);
  editId = signal<string | null>(null);
  editingBanner = signal<AdminBanner | null>(null);
  uploadingDesktop = signal(false);
  uploadingMobile = signal(false);
  showPreview = signal(false);
  previewBanner = signal<Banner | null>(null);
  modalMsg = signal('');
  packages = signal<Package[]>([]);
  packagesLoading = signal(false);
  packageLinkOptions = computed(() => [
    { value: '/packages', label: 'All Packages (listing page)' },
    ...this.packages().map((pkg) => ({ value: `/booking?package_id=${pkg.id}`, label: `Book: ${pkg.name}` })),
  ]);

  coupons = signal<Coupon[]>([]);
  couponOptions = computed(() => this.coupons().map((c) => ({
    value: c.id,
    label: `${c.code} — ${c.discount_type === 'percentage' ? c.discount_value + '%' : '₹' + c.discount_value} off`,
  })));

  categories = CATEGORIES;
  bannerTypes = BANNER_TYPES;
  highlightOptions = BANNER_HIGHLIGHTS;
  readonly statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
  ];
  f: BannerForm = this.blank();

  constructor(
    private api: BannerApiService,
    private packageApi: PackageApiService,
    private couponApi: CouponApiService,
    private confirm: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadPackages();
    this.loadCoupons();
  }

  private blank(): BannerForm {
    return {
      title: '', subtitle: '', description: '', cta_text: '', cta_link: '',
      cta2_text: '', cta2_link: '', highlights: [], category: 'packages',
      banner_type: 'advertisement', coupon_id: null,
      display_order: 0, status: 'draft',
    };
  }

  private loadPackages(): void {
    this.packagesLoading.set(true);
    this.packageApi.list({ page_size: 100 }).subscribe({
      next: (res) => { this.packages.set(res.items ?? []); this.packagesLoading.set(false); },
      error: () => this.packagesLoading.set(false),
    });
  }

  private loadCoupons(): void {
    this.couponApi.listAll().subscribe({
      next: (list) => this.coupons.set(list.filter((c) => c.is_active)),
      error: () => {},
    });
  }

  isHighlightSelected(h: string): boolean {
    return this.f.highlights.includes(h);
  }

  toggleHighlight(h: string): void {
    this.f.highlights = this.isHighlightSelected(h)
      ? this.f.highlights.filter((x) => x !== h)
      : [...this.f.highlights, h];
  }

  discountSummary(b: AdminBanner): string {
    if (!b.coupon) return 'No coupon linked';
    const value = b.coupon.discount_type === 'percentage' ? `${b.coupon.discount_value}% off` : `₹${b.coupon.discount_value} off`;
    return `${b.coupon.code} · ${value}`;
  }

  categoryLabel(cat: string): string {
    return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
  }

  load(): void {
    this.loading.set(true);
    this.api.listAll().subscribe({
      next: (list) => { this.banners.set(list); this.loading.set(false); },
      error: () => { this.error.set('Failed to load banners.'); this.loading.set(false); },
    });
  }

  openCreate(): void {
    this.editId.set(null);
    this.editingBanner.set(null);
    this.f = this.blank();
    this.f.display_order = this.banners().length + 1;
    this.formErr.set('');
    this.modalMsg.set('');
    this.showModal.set(true);
  }

  openEdit(b: AdminBanner): void {
    this.editId.set(b.id);
    this.editingBanner.set(b);
    this.f = {
      title: b.title ?? '', subtitle: b.subtitle ?? '', description: b.description ?? '',
      cta_text: b.cta_text ?? '', cta_link: b.cta_link ?? '',
      cta2_text: b.cta2_text ?? '', cta2_link: b.cta2_link ?? '',
      highlights: [...(b.highlights ?? [])],
      category: b.category,
      banner_type: b.banner_type,
      coupon_id: b.coupon_id ?? null,
      display_order: b.display_order,
      status: b.status,
    };
    this.formErr.set('');
    this.modalMsg.set('');
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editId.set(null);
    this.editingBanner.set(null);
    this.modalMsg.set('');
    this.formErr.set('');
  }

  private buildPayload(status?: BannerStatus): BannerPayload {
    return {
      title: this.f.title.trim() || null,
      subtitle: this.f.subtitle.trim() || null,
      description: this.f.description.trim() || null,
      cta_text: this.f.cta_text.trim() || null,
      cta_link: this.f.cta_link.trim() || null,
      cta2_text: this.f.cta2_text.trim() || null,
      cta2_link: this.f.cta2_link.trim() || null,
      highlights: this.f.highlights,
      category: this.f.category,
      banner_type: this.f.banner_type,
      coupon_id: this.f.banner_type === 'promotional_offer' ? this.f.coupon_id : null,
      display_order: Number(this.f.display_order) || 0,
      status: status ?? this.f.status,
    };
  }

  async save(status: BannerStatus): Promise<void> {
    if (this.f.banner_type === 'advertisement') {
      if (!this.f.title.trim() || !this.f.subtitle.trim()) {
        this.formErr.set('Advertisement banners require both a title and a subtitle.');
        return;
      }
    }
    // Drafts aren't visible to anyone, so only publishing needs the gate.
    if (status === 'published') {
      const ok = await this.confirm.askLiveChange(
        'The homepage banner carousel',
        [`Publish banner "${this.f.title.trim() || '(image-only banner)'}"`],
      );
      if (!ok) return;
    }
    this.formErr.set('');
    this.clearAlerts();
    this.saving.set(true);
    const payload = this.buildPayload(status);
    const id = this.editId();
    const obs = id ? this.api.update(id, payload) : this.api.create(payload);
    obs.subscribe({
      next: (saved) => {
        this.saving.set(false);
        const verb = status === 'published' ? 'published' : 'saved as draft';
        if (!id && !saved.desktop_image_url) {
          // New banner: keep the modal open in edit mode so the admin can add
          // images right away, but tell them clearly that it was saved.
          this.editId.set(saved.id);
          this.editingBanner.set(saved);
          this.f.status = saved.status;
          this.formErr.set('');
          this.modalMsg.set(`✓ Banner ${verb}. You can now upload desktop & mobile images below, or close this dialog.`);
        } else {
          this.closeModal();
          this.notice.set(`Banner ${verb}.`);
        }
        this.load();
      },
      error: (err) => {
        this.formErr.set(err.error?.detail?.message || 'Failed to save banner. Please try again.');
        this.saving.set(false);
      },
    });
  }

  onImage(event: Event, variant: 'desktop' | 'mobile'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const id = this.editId();
    if (!file || !id) return;
    const flag = variant === 'desktop' ? this.uploadingDesktop : this.uploadingMobile;
    flag.set(true);
    this.api.uploadImage(id, variant, file).subscribe({
      next: (updated) => {
        this.editingBanner.set(updated);
        flag.set(false);
        this.modalMsg.set(`✓ ${variant === 'desktop' ? 'Desktop' : 'Mobile'} image uploaded.`);
        this.load();
      },
      error: (err) => {
        this.formErr.set(err.error?.detail?.message || 'Image upload failed.');
        flag.set(false);
      },
    });
    input.value = '';
  }

  private label(b: AdminBanner): string {
    return b.title || 'Image only';
  }

  /**
   * Drop the page-level alerts before firing a mutation, so a success notice
   * from an earlier action can't sit on screen next to the row that just
   * failed to change.
   */
  private clearAlerts(): void {
    this.notice.set('');
    this.error.set('');
  }

  async togglePublish(b: AdminBanner): Promise<void> {
    const status: BannerStatus = b.status === 'published' ? 'draft' : 'published';
    const ok = await this.confirm.askLiveChange(
      'The homepage banner carousel',
      [status === 'published' ? `Publish banner "${this.label(b)}"` : `Remove banner "${this.label(b)}" from the homepage`],
    );
    if (!ok) return;
    this.clearAlerts();
    this.api.update(b.id, { status }).subscribe({
      next: () => { this.notice.set(status === 'published' ? 'Banner published.' : 'Banner unpublished.'); this.load(); },
      error: () => this.error.set('Failed to update banner.'),
    });
  }

  async remove(b: AdminBanner): Promise<void> {
    const ok = await this.confirm.askDelete(
      `banner "${this.label(b)}"`,
      b.status === 'published'
        ? 'It will be removed from the homepage immediately. This cannot be undone.'
        : 'This cannot be undone.',
    );
    if (!ok) return;
    this.clearAlerts();
    this.api.delete(b.id).subscribe({
      next: () => { this.notice.set('Banner deleted.'); this.load(); },
      error: (err) => this.error.set(err?.error?.detail?.message ?? 'Failed to delete banner.'),
    });
  }

  preview(b: AdminBanner): void {
    this.previewBanner.set(b);
    this.showPreview.set(true);
  }

  previewForm(): void {
    const p = this.buildPayload();
    const coupon = this.coupons().find((c) => c.id === p.coupon_id) ?? null;
    this.previewBanner.set({
      id: 'form-preview',
      title: p.title ?? null,
      subtitle: p.subtitle ?? null,
      description: p.description ?? null,
      cta_text: p.cta_text ?? null,
      cta_link: p.cta_link ?? null,
      cta2_text: p.cta2_text ?? null,
      cta2_link: p.cta2_link ?? null,
      highlights: p.highlights ?? [],
      category: p.category ?? 'packages',
      banner_type: p.banner_type ?? 'advertisement',
      coupon: coupon ? { code: coupon.code, discount_type: coupon.discount_type, discount_value: coupon.discount_value } : null,
      display_order: p.display_order ?? 0,
      desktop_image_url: this.editingBanner()?.desktop_image_url ?? null,
      mobile_image_url: this.editingBanner()?.mobile_image_url ?? null,
    });
    this.showPreview.set(true);
  }

  onDrop(event: CdkDragDrop<AdminBanner[]>): void {
    const list = [...this.banners()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    const reordered = list.map((b, i) => ({ ...b, display_order: i + 1 }));
    this.banners.set(reordered);
    this.clearAlerts();
    this.api.reorder(reordered.map((b) => ({ id: b.id, display_order: b.display_order }))).subscribe({
      next: () => this.notice.set('Order updated.'),
      error: () => { this.error.set('Failed to save order.'); this.load(); },
    });
  }
}
