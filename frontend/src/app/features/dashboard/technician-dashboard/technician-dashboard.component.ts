import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BookingApiService } from '../../../core/api/services/booking-api.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { Booking } from '../../../core/api/api.types';
import { getIstHours, todayIstDateStr } from '../../../core/utils/ist.util';
import {
  CardComponent, BadgeComponent, ButtonComponent,
  EmptyStateComponent, SpinnerComponent, ModalComponent,
  InputComponent
} from '../../../shared/components';

@Component({
  selector: 'app-technician-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    CardComponent,
    BadgeComponent,
    ButtonComponent,
    EmptyStateComponent,
    SpinnerComponent,
    ModalComponent,
    InputComponent
  ],
  template: `
    <div class="dashboard">
      <!-- Header -->
      <header class="dashboard__header">
        <div class="header__content">
          <h1 class="header__title">{{ greeting }}, {{ firstName() }}</h1>
          <p class="header__subtitle">{{ todayDate }}</p>
        </div>
        <div class="header__stats">
          <div class="header-stat">
            <span class="header-stat__value">{{ assignedCount() }}</span>
            <span class="header-stat__label">Assigned Today</span>
          </div>
          <div class="header-stat header-stat--success">
            <span class="header-stat__value">{{ completedCount() }}</span>
            <span class="header-stat__label">Completed</span>
          </div>
        </div>
      </header>

      <!-- Filters -->
      <section class="dashboard__filters">
        <div class="filter-tabs">
          @for (filter of statusFilters; track filter.value) {
            <button 
              class="filter-tab" 
              [class.filter-tab--active]="activeFilter() === filter.value"
              (click)="setFilter(filter.value)"
            >
              {{ filter.label }}
              @if (filter.count !== undefined) {
                <span class="filter-tab__count">{{ filter.count }}</span>
              }
            </button>
          }
        </div>
      </section>

      <!-- Bookings List -->
      <section class="dashboard__content">
        @if (loading()) {
          <div class="content__loading">
            <app-spinner size="lg" />
            <p>Loading assignments...</p>
          </div>
        } @else if (filteredBookings().length === 0) {
          <app-empty-state
            title="No assignments found"
            [description]="activeFilter() === 'all' ? 'You have no assigned bookings yet' : 'No bookings match this filter'"
            illustration="empty-bookings"
          />
        } @else {
          <div class="bookings-grid">
            @for (booking of filteredBookings(); track booking.id) {
              <article class="booking-card" [class.booking-card--urgent]="isUrgent(booking)">
                <div class="booking-card__header">
                  <div class="booking-card__ref">
                    <span class="ref-number">#{{ booking.reference_number }}</span>
                    <app-badge [variant]="getStatusVariant(booking.status)" [dot]="true">
                      {{ formatStatus(booking.status) }}
                    </app-badge>
                  </div>
                  @if (isUrgent(booking)) {
                    <span class="booking-card__urgent">Urgent</span>
                  }
                </div>

                <div class="booking-card__body">
                  <div class="booking-card__patient">
                    <div class="patient-avatar">
                      {{ getInitials(booking) }}
                    </div>
                    <div class="patient-info">
                      <span class="patient-name">Patient #{{ booking.user_id.slice(0, 8) }}</span>
                      <span class="patient-tests">{{ getTestCount(booking) }} tests</span>
                    </div>
                  </div>

                  <div class="booking-card__details">
                    <div class="detail-row">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <span>{{ formatDate(booking.booking_date) }}</span>
                    </div>
                    <div class="detail-row">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        @if (booking.collection_type === 'home') {
                          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                          <polyline points="9 22 9 12 15 12 15 22"/>
                        } @else {
                          <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                          <path d="M9 22v-4h6v4"/>
                        }
                      </svg>
                      <span>{{ booking.collection_type === 'home' ? 'Home Collection' : 'Lab Visit' }}</span>
                    </div>
                  </div>
                </div>

                <div class="booking-card__actions">
                  @if (booking.status === 'confirmed') {
                    <app-button 
                      variant="primary" 
                      size="sm"
                      (click)="updateBookingStatus(booking, 'sample_collected')"
                    >
                      Collect Sample
                    </app-button>
                  } @else if (booking.status === 'sample_collected') {
                    <app-button 
                      variant="outline" 
                      size="sm"
                      (click)="openNotesModal(booking)"
                    >
                      Add Notes
                    </app-button>
                  }
                  <a [routerLink]="['/dashboard/bookings', booking.id]" class="view-link">
                    View Details
                  </a>
                </div>
              </article>
            }
          </div>
        }
      </section>

      <!-- Notes Modal -->
      @if (notesModalOpen()) {
        <app-modal [isOpen]="notesModalOpen()" (close)="closeNotesModal()" title="Add Technician Notes">
          <div class="notes-modal">
            <p class="notes-modal__info">
              Add notes for booking <strong>#{{ selectedBooking()?.reference_number }}</strong>
            </p>
            <app-input
              label="Notes"
              placeholder="Enter your notes here..."
              [(ngModel)]="technicianNotes"
            />
            <div class="notes-modal__actions">
              <app-button variant="outline" (click)="closeNotesModal()">Cancel</app-button>
              <app-button 
                variant="primary" 
                [loading]="savingNotes()"
                (click)="saveNotes()"
              >
                Save Notes
              </app-button>
            </div>
          </div>
        </app-modal>
      }
    </div>
  `,
  styles: [`
    .dashboard {
      padding: 1.5rem;
      max-width: 1400px;
      margin: 0 auto;

      @media (max-width: 768px) {
        padding: 1rem;
      }
    }

    /* Header */
    .dashboard__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 1.5rem;
      background:
        linear-gradient(120deg, rgba(0,37,119,.94) 0%, rgba(35,78,82,.86) 60%, rgba(35,78,82,.72) 100%),
        url('/assets/photos/technician-dash.jpg') right center / cover no-repeat;
      border-radius: 1rem;
      color: #FFFFFF;
      margin-bottom: 1.5rem;

      @media (max-width: 768px) {
        flex-direction: column;
        gap: 1rem;
      }
    }

    .header__title {
      font-family: 'Plus Jakarta Sans','Inter',-apple-system,sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0 0 0.25rem 0;
      color: #FFFFFF;
    }

    .header__subtitle {
      font-size: 0.875rem;
      opacity: 0.85;
      margin: 0;
      color: #FFFFFF;
    }

    .header__stats {
      display: flex;
      gap: 1rem;

      @media (max-width: 768px) {
        width: 100%;
        justify-content: space-between;
      }
    }

    .header-stat {
      text-align: center;
      padding: 0.75rem 1rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 0.75rem;
      min-width: 100px;
    }

    .header-stat--success {
      background: rgba(#48BB78, 0.2);
    }

    .header-stat__value {
      display: block;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .header-stat__label {
      font-size: 0.75rem;
      opacity: 0.85;
    }

    /* Filters */
    .dashboard__filters {
      margin-bottom: 1.5rem;
    }

    .filter-tabs {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      padding-bottom: 0.5rem;

      &::-webkit-scrollbar {
        height: 4px;
      }

      &::-webkit-scrollbar-thumb {
        background: #CBD5E1;
        border-radius: 9999px;
      }
    }

    .filter-tab {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1rem;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      white-space: nowrap;
      transition: all 150ms;

      &:hover {
        border-color: #84A6FF;
        color: #0F172A;
      }
    }

    .filter-tab--active {
      background: #003399;
      border-color: #003399;
      color: #FFFFFF;

      .filter-tab__count {
        background: rgba(255, 255, 255, 0.2);
        color: #FFFFFF;
      }
    }

    .filter-tab__count {
      padding: 0.125rem 0.5rem;
      background: #F1F5F9;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    /* Content */
    .content__loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 300px;
      gap: 1rem;
      color: #475569;
    }

    /* Bookings Grid */
    .bookings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 1rem;

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }

    .booking-card {
      background: #FFFFFF;
      border: 1px solid #F1F5F9;
      border-radius: 1rem;
      overflow: hidden;
      transition: all 200ms cubic-bezier(0.4,0,0.2,1);

      &:hover {
        border-color: #E2E8F0;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1);
      }
    }

    .booking-card--urgent {
      border-color: #FCD34D;
      background: linear-gradient(180deg, #FFFBEB 0%, #FFFFFF 100%);
    }

    .booking-card__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid #F1F5F9;
    }

    .booking-card__ref {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .ref-number {
      font-family: 'JetBrains Mono','SF Mono','Fira Code',monospace;
      font-size: 0.875rem;
      font-weight: 600;
      color: #0F172A;
    }

    .booking-card__urgent {
      padding: 0.25rem 0.5rem;
      background: #FEF3C7;
      color: #B45309;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 0.25rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .booking-card__body {
      padding: 1rem;
    }

    .booking-card__patient {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .patient-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 9999px;
      background: #D9E5FF;
      color: #002577;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .patient-info {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .patient-name {
      font-weight: 500;
      color: #0F172A;
    }

    .patient-tests {
      font-size: 0.875rem;
      color: #475569;
    }

    .booking-card__details {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .detail-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #475569;

      svg {
        width: 16px;
        height: 16px;
        opacity: 0.6;
      }
    }

    .booking-card__actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      background: #F8FAFC;
      border-top: 1px solid #F1F5F9;
    }

    .view-link {
      font-size: 0.875rem;
      font-weight: 500;
      color: #003399;
      text-decoration: none;
      transition: color 150ms;

      &:hover {
        color: #002577;
      }
    }

    /* Notes Modal */
    .notes-modal {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .notes-modal__info {
      color: #475569;
      margin: 0;

      strong {
        color: #0F172A;
        font-family: 'JetBrains Mono','SF Mono','Fira Code',monospace;
      }
    }

    .notes-modal__actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .booking-card,
      .filter-tab {
        transition: none;
      }
    }
  `]
})
export class TechnicianDashboardComponent implements OnInit {
  private bookingApi = inject(BookingApiService);
  private authState = inject(AuthStateService);

  /* State */
  loading = signal(true);
  bookings = signal<Booking[]>([]);
  activeFilter = signal('all');
  notesModalOpen = signal(false);
  selectedBooking = signal<Booking | null>(null);
  savingNotes = signal(false);
  technicianNotes = '';

  /* Status filters */
  statusFilters = [
    { label: 'All', value: 'all', count: 0 },
    { label: 'Confirmed', value: 'confirmed', count: 0 },
    { label: 'Sample Collected', value: 'sample_collected', count: 0 },
    { label: 'Completed', value: 'completed', count: 0 }
  ];

  /* Computed properties */
  firstName = computed(() => {
    const user = this.authState.currentUser();
    if (!user?.name) return 'there';
    return user.name.split(' ')[0];
  });

  assignedCount = computed(() => this.bookings().length);

  completedCount = computed(() => 
    this.bookings().filter(b => b.status === 'completed').length
  );

  filteredBookings = computed(() => {
    const filter = this.activeFilter();
    if (filter === 'all') return this.bookings();
    return this.bookings().filter(b => b.status === filter);
  });

  /* Date and greeting */
  todayDate = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  get greeting(): string {
    const hour = getIstHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  ngOnInit(): void {
    this.loadAssignedBookings();
  }

  private loadAssignedBookings(): void {
    this.loading.set(true);
    this.bookingApi.getMyAssigned({ page: 1, page_size: 50 }).subscribe({
      next: (response) => {
        this.bookings.set(response.items);
        this.updateFilterCounts();
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load assigned bookings:', err);
        this.loading.set(false);
      }
    });
  }

  private updateFilterCounts(): void {
    const bookings = this.bookings();
    this.statusFilters[0].count = bookings.length;
    this.statusFilters[1].count = bookings.filter(b => b.status === 'confirmed').length;
    this.statusFilters[2].count = bookings.filter(b => b.status === 'sample_collected').length;
    this.statusFilters[3].count = bookings.filter(b => b.status === 'completed').length;
  }

  setFilter(value: string): void {
    this.activeFilter.set(value);
  }

  updateBookingStatus(booking: Booking, status: string): void {
    this.bookingApi.updateStatus(booking.id, status).subscribe({
      next: (updated) => {
        const bookings = this.bookings();
        const index = bookings.findIndex(b => b.id === booking.id);
        if (index !== -1) {
          bookings[index] = updated;
          this.bookings.set([...bookings]);
          this.updateFilterCounts();
        }
      },
      error: (err) => {
        console.error('Failed to update status:', err);
      }
    });
  }

  openNotesModal(booking: Booking): void {
    this.selectedBooking.set(booking);
    this.technicianNotes = booking.technician_notes || '';
    this.notesModalOpen.set(true);
  }

  closeNotesModal(): void {
    this.notesModalOpen.set(false);
    this.selectedBooking.set(null);
    this.technicianNotes = '';
  }

  saveNotes(): void {
    const booking = this.selectedBooking();
    if (!booking || !this.technicianNotes.trim()) return;

    this.savingNotes.set(true);
    this.bookingApi.addRemarks(booking.id, this.technicianNotes).subscribe({
      next: (updated) => {
        const bookings = this.bookings();
        const index = bookings.findIndex(b => b.id === booking.id);
        if (index !== -1) {
          bookings[index] = updated;
          this.bookings.set([...bookings]);
        }
        this.savingNotes.set(false);
        this.closeNotesModal();
      },
      error: (err) => {
        console.error('Failed to save notes:', err);
        this.savingNotes.set(false);
      }
    });
  }

  getStatusVariant(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
    const map: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
      pending: 'warning',
      confirmed: 'info',
      sample_collected: 'info',
      processing: 'info',
      completed: 'success',
      cancelled: 'error'
    };
    return map[status] || 'default';
  }

  formatStatus(status: string): string {
    const map: Record<string, string> = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      sample_collected: 'Sample Collected',
      processing: 'Processing',
      completed: 'Completed',
      cancelled: 'Cancelled'
    };
    return map[status] || status;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  getInitials(booking: Booking): string {
    return booking.user_id.slice(0, 2).toUpperCase();
  }

  getTestCount(booking: Booking): number {
    return booking.items?.length || 0;
  }

  isUrgent(booking: Booking): boolean {
    return booking.booking_date <= todayIstDateStr() && booking.status !== 'completed';
  }
}
