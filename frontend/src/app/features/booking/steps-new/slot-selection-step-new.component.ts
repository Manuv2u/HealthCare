import { Component, effect, inject, Input, OnInit, output, signal, computed, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeSlotApiService } from '../../../core/api/services/time-slot-api.service';
import { BookingWizardStore } from '../../../core/store/booking-wizard.store';
import { TimeSlot } from '../../../core/api/api.types';
import { ButtonComponent, SpinnerComponent } from '../../../shared/components';

interface DateOption {
  date: Date;
  dateStr: string;
  dayName: string;
  dayNum: number;
  monthName: string;
  isToday: boolean;
  isTomorrow: boolean;
}

@Component({
  selector: 'app-slot-selection-step-new',
  standalone: true,
  imports: [CommonModule, ButtonComponent, SpinnerComponent],
  template: `
    <div class="slot-step">
      <!-- Date Selection -->
      <div class="date-section">
        <h4 class="section-title">Select Date</h4>
        <div class="date-carousel">
          @for (d of dateOptions(); track d.dateStr) {
            <button 
              type="button"
              class="date-card"
              [class.date-card--selected]="selectedDate() === d.dateStr"
              [class.date-card--today]="d.isToday"
              (click)="selectDate(d)"
            >
              <span class="date-card__day">{{ d.dayName }}</span>
              <span class="date-card__num">{{ d.dayNum }}</span>
              <span class="date-card__month">{{ d.monthName }}</span>
              @if (d.isToday || d.isTomorrow) {
                <span class="date-card__badge" [attr.aria-label]="d.isToday ? 'Today' : 'Tomorrow'"></span>
              }
            </button>
          }
        </div>
      </div>

      <!-- Time Slots -->
      <div class="slots-section">
        <h4 class="section-title">Select Time Slot</h4>
        
        @if (loadingSlots()) {
          <div class="loading-state">
            <app-spinner size="md" />
            <span>Loading available slots...</span>
          </div>
        } @else if (!selectedDate()) {
          <div class="empty-state">
            <div class="empty-state__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <p>Please select a date to see available slots</p>
          </div>
        } @else if (availableSlots().length === 0) {
          <div class="empty-state">
            <div class="empty-state__icon empty-state__icon--warning">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <p>No slots available for this date. Please try another date.</p>
          </div>
        } @else {
          <div class="slots-grid">
            @for (slot of availableSlots(); track slot.id) {
              <button
                type="button"
                class="slot-card"
                [class.slot-card--selected]="selectedSlotId() === slot.id"
                [class.slot-card--full]="slot.remaining_capacity <= 0 || isSlotPast(slot)"
                [disabled]="slot.remaining_capacity <= 0 || isSlotPast(slot)"
                (click)="selectSlot(slot)"
              >
                <span class="slot-card__time">
                  {{ formatTime(slot.start_time) }} - {{ formatTime(slot.end_time) }}
                </span>
                @if (isSlotPast(slot)) {
                  <span class="slot-status slot-status--full">Passed</span>
                } @else if (slot.remaining_capacity <= 0) {
                  <span class="slot-status slot-status--full">Full</span>
                } @else if (slot.remaining_capacity <= 3) {
                  <span class="slot-status slot-status--warn">{{ slot.remaining_capacity }} left</span>
                } @else if (selectedSlotId() === slot.id) {
                  <span class="slot-status slot-status--ok">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </span>
                } @else {
                  <span class="slot-status slot-status--ok-dot"></span>
                }
              </button>
            }
          </div>
        }
      </div>

      <!-- Selection Summary -->
      @if (selectedDate() && selectedSlotId()) {
        <div class="selection-summary">
          <div class="summary-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div class="summary-content">
            <span class="summary-label">Your appointment</span>
            <span class="summary-value">{{ getSelectedDateDisplay() }} at {{ getSelectedSlotDisplay() }}</span>
          </div>
        </div>
      }

      <!-- Actions -->
      @if (!embedded) {
        <div class="step-actions">
          <app-button variant="outline" size="lg" (click)="back.emit()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon btn-icon--left">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </app-button>
          <app-button variant="primary" size="lg" [disabled]="!canProceed()" (click)="onNext()">
            Continue
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </app-button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      --color-primary-50: #EEF4FF;
      --color-primary-100: #D9E5FF;
      --color-primary-500: #0047CC;
      --color-primary-600: #003399;
      --color-primary-700: #002577;
      --color-primary-800: #001B57;
      --shadow-primary: 0 4px 14px 0 rgba(0, 51, 153, 0.28);
      display: block;
    }

    .slot-step {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .section-title {
      font-size: 1rem;
      font-weight: 600;
      color: #0F172A;
      margin: 0 0 1rem 0;
    }

    /* Date Carousel */
    .date-section {
      margin-bottom: 0.5rem;
    }

    .date-carousel {
      display: flex;
      gap: 0.75rem;
      overflow-x: auto;
      padding-top: 0.75rem;
      padding-bottom: 0.5rem;

      &::-webkit-scrollbar {
        height: 4px;
      }

      &::-webkit-scrollbar-thumb {
        background: #CBD5E1;
        border-radius: 9999px;
      }
    }

    .date-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6px 4px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 0.5rem;
      cursor: pointer;
      min-width: 56px;
      width: 56px;
      transition: border-color 150ms, background 150ms;
      position: relative;

      &:hover:not(:disabled) {
        border-color: #84A6FF;
        background: #EEF4FF;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .date-card--selected {
      border-color: #0047CC;
      background: #EEF4FF;
    }

    .date-card--today {
      border-color: #0A50D8;
    }

    .date-card__day {
      font-size: 0.625rem;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.01em;
      line-height: 1.2;
    }

    .date-card__num {
      font-size: 1.125rem;
      font-weight: 700;
      color: #0F172A;
      line-height: 1.2;
      margin: 1px 0;
    }

    .date-card__month {
      font-size: 0.625rem;
      color: #475569;
      line-height: 1.2;
    }

    .date-card__badge {
      position: absolute;
      top: -5px;
      right: -5px;
      width: 7px;
      height: 7px;
      background: #003399;
      border-radius: 9999px;
      border: 1.5px solid #FFFFFF;
    }

    /* Slots Grid */
    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 2rem;
      color: #475569;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem;
      text-align: center;
      gap: 0.75rem;
    }

    .empty-state__icon {
      width: 56px;
      height: 56px;
      border-radius: 9999px;
      background: #F8FAFC;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94A3B8;

      svg {
        width: 28px;
        height: 28px;
      }
    }

    .empty-state__icon--warning {
      background: #FFFBEB;
      color: #D97706;
    }

    .empty-state p {
      color: #475569;
      margin: 0;
    }

    .slots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 0.5rem;
    }

    .slot-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      min-height: 52px;
      padding: 10px 12px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 0.5rem;
      cursor: pointer;
      transition: border-color 150ms, background 150ms;

      &:hover:not(:disabled) {
        border-color: #84A6FF;
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        background: #F8FAFC;
      }
    }

    .slot-card--selected {
      border-color: #0047CC;
      background: #EEF4FF;
    }

    .slot-card--full {
      border-style: dashed;
    }

    .slot-card__time {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #0F172A;
      white-space: nowrap;
    }

    /* Compact status: a checkmark for the common "available" case, short text
       only where the number actually matters (full / passed / low count). */
    .slot-status {
      flex-shrink: 0;
      font-size: 0.6875rem;
      font-weight: 600;
    }

    .slot-status--full {
      color: #B91C1C;
    }

    .slot-status--warn {
      color: #B45309;
    }

    .slot-status--ok {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      background: #0047CC;
      color: #FFFFFF;

      svg {
        width: 10px;
        height: 10px;
      }
    }

    .slot-status--ok-dot {
      width: 6px;
      height: 6px;
      border-radius: 9999px;
      background: #38A169;
    }

    /* Selection Summary */
    .selection-summary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: #F0FFF4;
      border-radius: 0.5rem;
      border: 1px solid #9AE6B4;
      width: fit-content;
      max-width: 100%;
    }

    .summary-icon {
      width: 26px;
      height: 26px;
      border-radius: 0.5rem;
      background: #C6F6D5;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #2F855A;
      flex-shrink: 0;

      svg {
        width: 14px;
        height: 14px;
      }
    }

    .summary-content {
      display: flex;
      flex-direction: column;
      gap: 0;
      min-width: 0;
    }

    .summary-label {
      font-size: 0.6875rem;
      color: #276749;
      line-height: 1.2;
    }

    .summary-value {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #22543D;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Step Actions */
    .step-actions {
      display: flex;
      justify-content: space-between;
      padding-top: 1rem;
      border-top: 1px solid #F1F5F9;
    }

    .btn-icon {
      width: 18px;
      height: 18px;
      margin-left: 0.5rem;
    }

    .btn-icon--left {
      margin-left: 0;
      margin-right: 0.5rem;
    }

    @media (prefers-reduced-motion: reduce) {
      .date-card,
      .slot-card {
        transition: none;
      }
    }
  `]
})
export class SlotSelectionStepNewComponent implements OnInit {
  @Input() embedded = false;

  next = output<void>();
  back = output<void>();

  private timeSlotApi = inject(TimeSlotApiService);
  readonly store = inject(BookingWizardStore);

  /* State */
  loadingSlots = signal(false);
  availableSlots = signal<TimeSlot[]>([]);
  selectedDate = signal<string | null>(null);
  selectedSlotId = signal<string | null>(null);

  dateOptions = signal<DateOption[]>([]);

  /* Tracks the previous value so the effect below can tell a real change in
     collection type apart from its own first (initialization) run — signal
     effects always fire once immediately, and that first pass must not wipe
     out a slot just restored from a persisted session. */
  private previousCollectionType: 'home' | 'lab' | null | undefined = undefined;

  /* When embedded, collection type can change live (no page transition), which can
     make an already-fetched slot list stale — e.g. Home has capacity, Lab doesn't.
     Re-fetch for the selected date whenever collection type changes underneath us. */
  private readonly refetchOnCollectionTypeChange = effect(() => {
    const type = this.store.collectionType();
    const isFirstRun = this.previousCollectionType === undefined;
    this.previousCollectionType = type;
    if (isFirstRun) return;

    const date = untracked(() => this.selectedDate());
    if (date) {
      untracked(() => {
        this.selectedSlotId.set(null);
        this.loadSlots(date);
      });
    }
  });

  ngOnInit(): void {
    this.generateDateOptions();

    /* Resuming a persisted session: reflect the prior date/slot locally too, not
       just in the store, so the cards show as selected instead of resetting empty. */
    const restoredDate = this.store.slotDate();
    if (restoredDate) {
      this.selectedDate.set(restoredDate);
      this.selectedSlotId.set(this.store.slotId());
      this.loadSlots(restoredDate);
    }
  }

  private generateDateOptions(): void {
    const options: DateOption[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      // Build the string from local date components rather than
      // toISOString() — toISOString() converts to UTC first, which rolls
      // the date back by one day in timezones ahead of UTC (e.g. IST),
      // silently booking "today" when the user picked a later date.
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      options.push({
        date,
        dateStr,
        dayName: dayNames[date.getDay()],
        dayNum: date.getDate(),
        monthName: monthNames[date.getMonth()],
        isToday: i === 0,
        isTomorrow: i === 1
      });
    }

    this.dateOptions.set(options);
  }

  selectDate(option: DateOption): void {
    this.selectedDate.set(option.dateStr);
    this.selectedSlotId.set(null);
    this.loadSlots(option.dateStr);
  }

  private loadSlots(date: string): void {
    const collectionType = this.store.collectionType();
    if (!collectionType) return;

    this.loadingSlots.set(true);
    this.timeSlotApi.getAvailable(date, collectionType).subscribe({
      next: (slots) => {
        this.availableSlots.set(slots.filter(s => s.is_enabled));
        this.loadingSlots.set(false);
      },
      error: () => {
        this.availableSlots.set([]);
        this.loadingSlots.set(false);
      }
    });
  }

  selectSlot(slot: TimeSlot): void {
    if (slot.remaining_capacity <= 0 || this.isSlotPast(slot)) return;
    this.selectedSlotId.set(slot.id);

    /* Patch immediately so an embedded sibling step or a refresh sees the choice right away. */
    this.store.patch({
      slotId: this.selectedSlotId(),
      slotDate: this.selectedDate(),
      slotLabel: this.getSelectedSlotDisplay(),
    });
  }

  /** UX-only guard against picking an already-passed slot for today — the
   * backend is the actual source of truth and re-validates on booking creation. */
  isSlotPast(slot: TimeSlot): boolean {
    const todayStr = this.dateOptions().find(d => d.isToday)?.dateStr;
    if (this.selectedDate() !== todayStr) return false;

    const [hours, minutes] = slot.start_time.split(':').map(Number);
    const slotDate = new Date();
    slotDate.setHours(hours, minutes, 0, 0);
    return slotDate.getTime() <= Date.now();
  }

  formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${suffix}`;
  }

  getSelectedDateDisplay(): string {
    const opt = this.dateOptions().find(d => d.dateStr === this.selectedDate());
    if (!opt) return '';
    return `${opt.dayName}, ${opt.dayNum} ${opt.monthName}`;
  }

  getSelectedSlotDisplay(): string {
    const slot = this.availableSlots().find(s => s.id === this.selectedSlotId());
    if (!slot) return '';
    return `${this.formatTime(slot.start_time)} - ${this.formatTime(slot.end_time)}`;
  }

  canProceed(): boolean {
    return !!this.selectedDate() && !!this.selectedSlotId();
  }

  onNext(): void {
    if (!this.canProceed()) return;
    this.next.emit();
  }
}
