import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { AlertComponent } from '../alert/alert.component';
import { SearchInputComponent } from '../search-input/search-input.component';
import { HealthConcernApiService } from '../../../core/api/services/health-concern-api.service';
import { UserApiService } from '../../../core/api/services/user-api.service';
import { HealthConcern } from '../../../core/api/api.types';

/** Session-only "Skip for Now" suppression — cleared automatically when the tab/browser session ends. */
export const HC_PROMPT_SKIPPED_SESSION_KEY = 'hc_prompt_skipped_session';

@Component({
  selector: 'app-health-concern-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule, ModalComponent, ButtonComponent, AlertComponent, SearchInputComponent],
  template: `
    <app-modal
      [isOpen]="isOpen"
      [showHeader]="false"
      title="Welcome to Sri Health Plus"
      size="xl"
      [closeOnBackdrop]="true"
      [closeOnEscape]="true"
      (close)="handleSkip()"
    >
      <div #dialogBody class="hc">
        <div class="hc__header">
          <button type="button" class="hc__close" (click)="handleSkip()" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <div class="hc__badge">
            <img src="assets/logo-mark.png" alt="Sri Health Plus" class="hc__badge-logo" onerror="this.style.display='none'" />
          </div>
          <h2 class="hc__title">Welcome to Sri Health Plus</h2>
          <p class="hc__subtitle">Help us personalize your healthcare experience.</p>
          <p class="hc__desc">
            Select one or more health interests so we can recommend the most relevant health tests,
            health packages, preventive checkups, health tips, and exclusive offers.
          </p>
        </div>

        <app-search-input
          class="hc__search"
          placeholder="Search health concerns..."
          [debounce]="80"
          (search)="searchQuery.set($event)"
        />

        @if (loadError()) {
          <app-alert variant="error">
            {{ loadError() }}
            <button type="button" class="hc__retry" (click)="loadConcerns()">Retry</button>
          </app-alert>
        }

        @if (loadingConcerns()) {
          <div class="hc__grid" aria-hidden="true">
            @for (i of skeletonItems; track i) {
              <div class="hc__skeleton-card"></div>
            }
          </div>
        } @else if (!loadError() && filteredConcerns().length === 0) {
          <p class="hc__empty">No matching health concerns. Try a different search.</p>
        } @else if (!loadError()) {
          <div class="hc__grid" role="group" aria-label="Health concerns">
            @for (c of filteredConcerns(); track c.key) {
              <button
                type="button"
                class="hc__card"
                [class.selected]="isSelected(c.key)"
                [attr.aria-pressed]="isSelected(c.key)"
                (click)="toggle(c.key)"
              >
                @if (isSelected(c.key)) {
                  <span class="hc__check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </span>
                }
                <span class="hc__icon-badge">
                  <mat-icon class="hc__icon">{{ c.icon }}</mat-icon>
                </span>
                <span class="hc__name">{{ c.name }}</span>
              </button>
            }
          </div>
        }

        @if (saveError()) {
          <app-alert variant="error" [dismissible]="true" (dismiss)="saveError.set(null)">{{ saveError() }}</app-alert>
        }
      </div>

      <div modal-footer class="hc__footer">
        <div class="hc__footer-left">
          <app-button variant="outline" [disabled]="saving()" (click)="handleSkip()">Skip for Now</app-button>
          <label class="hc__dontshow">
            <input
              type="checkbox"
              [checked]="dontShowAgain()"
              (change)="dontShowAgain.set($any($event.target).checked)"
            />
            <span>Don't show this again</span>
          </label>
        </div>
        <app-button
          variant="primary"
          [disabled]="selected().size === 0"
          [loading]="saving()"
          (click)="handleSave()"
        >
          Save Preferences{{ selected().size > 0 ? ' (' + selected().size + ')' : '' }}
        </app-button>
      </div>
    </app-modal>
  `,
  styles: [`
    .hc__header {
      position: relative;
      text-align: center;
      padding: var(--space-8) var(--space-6) var(--space-5);
      margin: calc(-1 * var(--space-6)) calc(-1 * var(--space-6)) var(--space-5);
      background: linear-gradient(180deg, var(--color-primary-50), var(--bg-primary));
      border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
    }
    .hc__close {
      position: absolute;
      top: var(--space-4);
      right: var(--space-4);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--text-muted);
      cursor: pointer;
      transition: all var(--duration-fast);

      &:hover { background: var(--bg-secondary); color: var(--text-primary); }
      svg { width: 20px; height: 20px; }
    }
    .hc__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: var(--radius-full);
      background: var(--bg-primary);
      box-shadow: var(--shadow-sm);
      margin-bottom: var(--space-3);
    }
    .hc__badge-logo {
      width: 34px;
      height: 34px;
      object-fit: contain;
    }
    .hc__title {
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      color: var(--text-primary);
      margin: 0 0 var(--space-2);
    }
    .hc__subtitle {
      font-size: var(--text-base);
      font-weight: var(--font-semibold);
      color: var(--text-primary);
      margin: 0 0 var(--space-1);
    }
    .hc__desc {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      line-height: 1.55;
      max-width: 520px;
      margin: 0 auto;
    }

    .hc__search { display: block; margin-bottom: var(--space-5); }

    .hc__retry {
      background: none;
      border: none;
      padding: 0;
      margin-left: var(--space-2);
      font: inherit;
      font-weight: var(--font-semibold);
      color: inherit;
      text-decoration: underline;
      cursor: pointer;
    }

    .hc__empty {
      text-align: center;
      padding: var(--space-8) var(--space-4);
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }

    .hc__grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-3);
    }
    @media (max-width: 1023px) {
      .hc__grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 767px) {
      .hc__grid { grid-template-columns: repeat(2, 1fr); }
    }

    .hc__skeleton-card {
      height: 112px;
      border-radius: var(--radius-lg);
      background: var(--bg-secondary);
      animation: hcPulse 1.4s ease-in-out infinite;
    }
    @keyframes hcPulse {
      0%, 100% { opacity: .55; }
      50% { opacity: 1; }
    }

    .hc__card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-4) var(--space-2);
      background: var(--bg-secondary);
      border: 2px solid transparent;
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: transform var(--duration-fast) var(--ease-out),
        box-shadow var(--duration-fast) var(--ease-out),
        border-color var(--duration-fast), background var(--duration-fast);
      text-align: center;

      &:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--border-default); }
      &:focus-visible { outline: 2px solid var(--color-primary-500); outline-offset: 2px; }
      &.selected {
        background: var(--color-primary-50);
        border-color: var(--color-primary-500);
        animation: hcPop 220ms var(--ease-out);
      }
    }
    @keyframes hcPop {
      0% { transform: scale(1); }
      40% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }

    .hc__check {
      position: absolute;
      top: -6px;
      right: -6px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: var(--radius-full);
      background: var(--color-primary-500);
      color: var(--text-inverse, #fff);
      box-shadow: var(--shadow-sm);

      svg { width: 12px; height: 12px; }
    }

    .hc__icon-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: var(--radius-full);
      background: var(--bg-primary);
      transition: background var(--duration-fast);
    }
    .selected .hc__icon-badge { background: var(--color-primary-100); }
    .hc__icon {
      color: var(--text-secondary);
      width: 24px;
      height: 24px;
      font-size: 24px;
    }
    .selected .hc__icon { color: var(--color-primary-600); }
    .hc__name {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--text-primary);
    }

    /* ModalComponent forces justify-content: flex-end on the projected footer
       wrapper (see modal.component.ts's ".modal__footer > *" rule) — override
       it here so Skip sits on the left and Save on the right. */
    .hc__footer {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: var(--space-4);
      width: 100%;
      flex-wrap: wrap;
    }
    .hc__footer-left {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      flex-wrap: wrap;
    }
    .hc__dontshow {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      color: var(--text-secondary);
      cursor: pointer;
      user-select: none;

      input[type="checkbox"] {
        width: 16px;
        height: 16px;
        accent-color: var(--color-primary-500);
        cursor: pointer;
      }
    }

    @media (max-width: 480px) {
      .hc__footer { flex-direction: column-reverse; align-items: stretch !important; }
      .hc__footer-left { flex-direction: column; align-items: flex-start; gap: var(--space-3); }
    }

    @media (prefers-reduced-motion: reduce) {
      .hc__card, .hc__icon-badge, .hc__skeleton-card { animation: none; transition: none; }
      .hc__card:hover { transform: none; }
    }
  `],
})
export class HealthConcernModalComponent implements OnChanges {
  @Input() isOpen = false;
  /** Fires after preferences are successfully saved server-side. Parent should close + navigate. */
  @Output() saved = new EventEmitter<string[]>();
  /** Fires on any dismissal that isn't a save (Skip, backdrop, Escape, X). Parent should just close. */
  @Output() closed = new EventEmitter<void>();

  @ViewChild('dialogBody') dialogBody?: ElementRef<HTMLElement>;

  concerns = signal<HealthConcern[]>([]);
  loadingConcerns = signal(false);
  loadError = signal<string | null>(null);

  selected = signal<Set<string>>(new Set());
  searchQuery = signal('');
  dontShowAgain = signal(false);
  saving = signal(false);
  saveError = signal<string | null>(null);

  skeletonItems = Array.from({ length: 8 }, (_, i) => i);

  filteredConcerns = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.concerns();
    if (!q) return all;
    return all.filter((c) => c.name.toLowerCase().includes(q));
  });

  constructor(
    private healthConcernApi: HealthConcernApiService,
    private userApi: UserApiService,
    private elementRef: ElementRef<HTMLElement>,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.selected.set(new Set());
      this.searchQuery.set('');
      this.dontShowAgain.set(false);
      this.saveError.set(null);
      if (!this.concerns().length) {
        this.loadConcerns();
      }
      setTimeout(() => this.focusInitial(), 0);
    }
  }

  loadConcerns(): void {
    this.loadingConcerns.set(true);
    this.loadError.set(null);
    this.healthConcernApi.list().subscribe({
      next: (list) => {
        this.concerns.set(list);
        this.loadingConcerns.set(false);
      },
      error: () => {
        this.loadingConcerns.set(false);
        this.loadError.set("Couldn't load health concerns.");
      },
    });
  }

  private focusInitial(): void {
    const el = this.dialogBody?.nativeElement.querySelector<HTMLElement>('input[type="search"], .hc__card');
    el?.focus();
  }

  @HostListener('keydown.tab', ['$event'])
  onTabKey(event: KeyboardEvent): void {
    if (!this.isOpen) return;
    const modal = this.elementRef.nativeElement.querySelector<HTMLElement>('.modal');
    if (!modal) return;
    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  isSelected(key: string): boolean {
    return this.selected().has(key);
  }

  toggle(key: string): void {
    const next = new Set(this.selected());
    next.has(key) ? next.delete(key) : next.add(key);
    this.selected.set(next);
  }

  handleSave(): void {
    if (this.selected().size === 0 || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    const keys = Array.from(this.selected());
    this.userApi
      .updateProfile({ health_concerns: keys, health_concern_prompt_dismissed: this.dontShowAgain() })
      .subscribe({
        next: () => {
          this.saving.set(false);
          sessionStorage.removeItem(HC_PROMPT_SKIPPED_SESSION_KEY);
          this.saved.emit(keys);
        },
        error: () => {
          this.saving.set(false);
          this.saveError.set('Something went wrong while saving your preferences. Please try again.');
        },
      });
  }

  handleSkip(): void {
    if (this.saving()) return;
    if (this.dontShowAgain()) {
      this.saving.set(true);
      this.saveError.set(null);
      this.userApi.updateProfile({ health_concern_prompt_dismissed: true }).subscribe({
        next: () => {
          this.saving.set(false);
          this.closed.emit();
        },
        error: () => {
          this.saving.set(false);
          this.saveError.set('Could not save your preference. Please try again.');
        },
      });
      return;
    }
    sessionStorage.setItem(HC_PROMPT_SKIPPED_SESSION_KEY, '1');
    this.closed.emit();
  }
}
