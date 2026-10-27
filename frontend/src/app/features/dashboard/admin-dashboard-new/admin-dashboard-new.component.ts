import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import {
  CardComponent, BadgeComponent, ButtonComponent,
  StatCardComponent, EmptyStateComponent, SpinnerComponent
} from '../../../shared/components';

interface DashboardStats {
  totalBookings: number;
  pendingBookings: number;
  completedBookings: number;
  totalRevenue: number;
  totalUsers: number;
  totalTechnicians: number;
  recentBookings: any[];
  revenueByDay: { date: string; amount: number }[];
}

@Component({
  selector: 'app-admin-dashboard-new',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CardComponent,
    BadgeComponent,
    ButtonComponent,
    StatCardComponent,
    EmptyStateComponent,
    SpinnerComponent
  ],
  template: `
    <div class="dashboard">
      <!-- Header -->
      <header class="dashboard__header">
        <div class="header__content">
          <h1 class="header__title">Dashboard Overview</h1>
          <p class="header__subtitle">{{ todayDate }}</p>
        </div>
        <div class="header__actions">
          <a routerLink="/admin/users" class="header-action">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
            Manage Users
          </a>
          <a routerLink="/admin/bookings" class="header-action header-action--primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            View All Bookings
          </a>
        </div>
      </header>

      @if (loading()) {
        <div class="dashboard__loading">
          <app-spinner size="lg" />
          <p>Loading dashboard data...</p>
        </div>
      } @else {
        <!-- Stats Grid -->
        <section class="dashboard__stats">
          <div class="stat-card stat-card--primary">
            <div class="stat-card__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div class="stat-card__content">
              <span class="stat-card__value">{{ stats().totalBookings }}</span>
              <span class="stat-card__label">Total Bookings</span>
            </div>
            <div class="stat-card__trend stat-card__trend--up">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              </svg>
              <span>+12%</span>
            </div>
          </div>

          <div class="stat-card stat-card--warning">
            <div class="stat-card__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div class="stat-card__content">
              <span class="stat-card__value">{{ stats().pendingBookings }}</span>
              <span class="stat-card__label">Pending</span>
            </div>
          </div>

          <div class="stat-card stat-card--success">
            <div class="stat-card__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div class="stat-card__content">
              <span class="stat-card__value">{{ stats().completedBookings }}</span>
              <span class="stat-card__label">Completed</span>
            </div>
          </div>

          <div class="stat-card stat-card--accent">
            <div class="stat-card__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
            </div>
            <div class="stat-card__content">
              <span class="stat-card__value">₹{{ formatRevenue(stats().totalRevenue) }}</span>
              <span class="stat-card__label">Revenue</span>
            </div>
            <div class="stat-card__trend stat-card__trend--up">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              </svg>
              <span>+8%</span>
            </div>
          </div>
        </section>

        <!-- Secondary Stats -->
        <section class="dashboard__secondary-stats">
          <div class="secondary-stat">
            <div class="secondary-stat__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
            </div>
            <div class="secondary-stat__content">
              <span class="secondary-stat__label">Total Users</span>
              <span class="secondary-stat__value">{{ stats().totalUsers }}</span>
            </div>
          </div>

          <div class="secondary-stat">
            <div class="secondary-stat__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <circle cx="19" cy="11" r="2"/>
                <path d="M19 8v1m0 4v1m-3-3h1m4 0h1"/>
              </svg>
            </div>
            <div class="secondary-stat__content">
              <span class="secondary-stat__label">Technicians</span>
              <span class="secondary-stat__value">{{ stats().totalTechnicians }}</span>
            </div>
          </div>
        </section>

        <!-- Main Grid -->
        <div class="dashboard__grid">
          <!-- Recent Bookings -->
          <section class="dashboard__card dashboard__card--bookings">
            <div class="card__header">
              <h2 class="card__title">Recent Bookings</h2>
              <a routerLink="/admin/bookings" class="card__link">View All</a>
            </div>
            
            @if (stats().recentBookings.length === 0) {
              <div class="card__empty">
                <p>No recent bookings</p>
              </div>
            } @else {
              <div class="booking-table">
                <div class="booking-table__header">
                  <span>Reference</span>
                  <span>Date</span>
                  <span>Status</span>
                  <span>Amount</span>
                </div>
                @for (booking of stats().recentBookings; track booking.id) {
                  <a [routerLink]="['/admin/bookings', booking.id]" class="booking-table__row">
                    <span class="booking-ref">#{{ booking.reference_number }}</span>
                    <span class="booking-date">{{ formatDate(booking.booking_date) }}</span>
                    <span>
                      <app-badge [variant]="getStatusVariant(booking.status)" size="sm">
                        {{ formatStatus(booking.status) }}
                      </app-badge>
                    </span>
                    <span class="booking-amount">₹{{ booking.total_amount }}</span>
                  </a>
                }
              </div>
            }
          </section>

          <!-- Quick Actions -->
          <section class="dashboard__card dashboard__card--actions">
            <div class="card__header">
              <h2 class="card__title">Quick Actions</h2>
            </div>
            
            <div class="quick-actions">
              <a routerLink="/admin/tests" class="quick-action">
                <div class="quick-action__icon quick-action__icon--primary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 17H2a3 3 0 003 3h14a3 3 0 003-3zM2 17V5a3 3 0 013-3h14a3 3 0 013 3v12"/>
                    <path d="M6 8h.01M10 8h.01"/>
                  </svg>
                </div>
                <div class="quick-action__content">
                  <span class="quick-action__label">Manage Tests</span>
                  <span class="quick-action__desc">Add or edit lab tests</span>
                </div>
                <svg class="quick-action__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </a>

              <a routerLink="/admin/packages" class="quick-action">
                <div class="quick-action__icon quick-action__icon--secondary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                  </svg>
                </div>
                <div class="quick-action__content">
                  <span class="quick-action__label">Manage Packages</span>
                  <span class="quick-action__desc">Create test packages</span>
                </div>
                <svg class="quick-action__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </a>

              <a routerLink="/admin/technicians" class="quick-action">
                <div class="quick-action__icon quick-action__icon--accent">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                </div>
                <div class="quick-action__content">
                  <span class="quick-action__label">Technicians</span>
                  <span class="quick-action__desc">Manage technicians</span>
                </div>
                <svg class="quick-action__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </a>

              <a routerLink="/admin/reports" class="quick-action">
                <div class="quick-action__icon quick-action__icon--success">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <div class="quick-action__content">
                  <span class="quick-action__label">Reports</span>
                  <span class="quick-action__desc">View and download reports</span>
                </div>
                <svg class="quick-action__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </a>

              <a routerLink="/admin/settings" class="quick-action">
                <div class="quick-action__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                  </svg>
                </div>
                <div class="quick-action__content">
                  <span class="quick-action__label">Settings</span>
                  <span class="quick-action__desc">System configuration</span>
                </div>
                <svg class="quick-action__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </a>
            </div>
          </section>
        </div>
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

    .dashboard__loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      gap: 1rem;
      color: #475569;
    }

    /* Header */
    .dashboard__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;

      @media (max-width: 768px) {
        flex-direction: column;
        gap: 1rem;
      }
    }

    .header__title {
      font-family: 'Plus Jakarta Sans','Inter',-apple-system,sans-serif;
      font-size: 1.875rem;
      font-weight: 700;
      color: #0F172A;
      margin: 0 0 0.25rem 0;
    }

    .header__subtitle {
      font-size: 0.875rem;
      color: #475569;
      margin: 0;
    }

    .header__actions {
      display: flex;
      gap: 0.75rem;

      @media (max-width: 640px) {
        width: 100%;
        flex-direction: column;
      }
    }

    .header-action {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1rem;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 0.75rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: #0F172A;
      text-decoration: none;
      transition: all 150ms;

      svg {
        width: 18px;
        height: 18px;
      }

      &:hover {
        border-color: #84A6FF;
        background: #F8FAFC;
      }
    }

    .header-action--primary {
      background: #003399;
      border-color: #003399;
      color: #FFFFFF;

      &:hover {
        background: #002577;
        border-color: #002577;
      }
    }

    /* Stats Grid */
    .dashboard__stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;

      @media (max-width: 1024px) {
        grid-template-columns: repeat(2, 1fr);
      }

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }

    .stat-card {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1.25rem;
      background: #FFFFFF;
      border-radius: 1rem;
      border: 1px solid #F1F5F9;
      position: relative;
      transition: all 200ms cubic-bezier(0.4,0,0.2,1);

      &:hover {
        border-color: #E2E8F0;
        box-shadow: 0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px -1px rgba(0,0,0,.1);
      }
    }

    .stat-card__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 0.75rem;
      flex-shrink: 0;

      svg {
        width: 24px;
        height: 24px;
      }
    }

    .stat-card--primary .stat-card__icon {
      background: #EEF4FF;
      color: #003399;
    }

    .stat-card--warning .stat-card__icon {
      background: #FFFBEB;
      color: #D97706;
    }

    .stat-card--success .stat-card__icon {
      background: #F0FFF4;
      color: #2F855A;
    }

    .stat-card--accent .stat-card__icon {
      background: #EEF4FF;
      color: #003399;
    }

    .stat-card__content {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      flex: 1;
    }

    .stat-card__value {
      font-family: 'Plus Jakarta Sans','Inter',-apple-system,sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: #0F172A;
      line-height: 1.25;
    }

    .stat-card__label {
      font-size: 0.875rem;
      color: #475569;
    }

    .stat-card__trend {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      font-weight: 500;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;

      svg {
        width: 14px;
        height: 14px;
      }
    }

    .stat-card__trend--up {
      background: #F0FFF4;
      color: #276749;
    }

    .stat-card__trend--down {
      background: #FEF2F2;
      color: #B91C1C;
    }

    /* Secondary Stats */
    .dashboard__secondary-stats {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;

      @media (max-width: 640px) {
        flex-direction: column;
      }
    }

    .secondary-stat {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      background: #F8FAFC;
      border-radius: 0.75rem;
      flex: 1;
    }

    .secondary-stat__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 0.5rem;
      background: #FFFFFF;
      color: #475569;

      svg {
        width: 20px;
        height: 20px;
      }
    }

    .secondary-stat__content {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .secondary-stat__label {
      font-size: 0.875rem;
      color: #475569;
    }

    .secondary-stat__value {
      font-size: 1.125rem;
      font-weight: 600;
      color: #0F172A;
    }

    /* Main Grid */
    .dashboard__grid {
      display: grid;
      grid-template-columns: 1fr 400px;
      gap: 1.5rem;

      @media (max-width: 1024px) {
        grid-template-columns: 1fr;
      }
    }

    .dashboard__card {
      background: #FFFFFF;
      border-radius: 1rem;
      border: 1px solid #F1F5F9;
      overflow: hidden;
    }

    .card__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #F1F5F9;
    }

    .card__title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #0F172A;
      margin: 0;
    }

    .card__link {
      font-size: 0.875rem;
      font-weight: 500;
      color: #003399;
      text-decoration: none;
      transition: color 150ms;

      &:hover {
        color: #002577;
      }
    }

    .card__empty {
      padding: 2rem;
      text-align: center;
      color: #475569;
    }

    /* Booking Table */
    .booking-table {
      display: flex;
      flex-direction: column;
    }

    .booking-table__header {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 0.8fr;
      gap: 1rem;
      padding: 0.75rem 1.25rem;
      background: #F8FAFC;
      font-size: 0.75rem;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .booking-table__row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 0.8fr;
      gap: 1rem;
      padding: 0.75rem 1.25rem;
      text-decoration: none;
      border-bottom: 1px solid #F1F5F9;
      transition: background 150ms;

      &:last-child {
        border-bottom: none;
      }

      &:hover {
        background: #F8FAFC;
      }
    }

    .booking-ref {
      font-family: 'JetBrains Mono','SF Mono','Fira Code',monospace;
      font-size: 0.875rem;
      font-weight: 500;
      color: #0F172A;
    }

    .booking-date {
      font-size: 0.875rem;
      color: #475569;
    }

    .booking-amount {
      font-size: 0.875rem;
      font-weight: 600;
      color: #0F172A;
    }

    /* Quick Actions */
    .quick-actions {
      display: flex;
      flex-direction: column;
    }

    .quick-action {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
      text-decoration: none;
      border-bottom: 1px solid #F1F5F9;
      transition: background 150ms;

      &:last-child {
        border-bottom: none;
      }

      &:hover {
        background: #F8FAFC;

        .quick-action__arrow {
          transform: translateX(4px);
          color: #003399;
        }
      }
    }

    .quick-action__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 0.75rem;
      background: #F1F5F9;
      color: #475569;
      flex-shrink: 0;

      svg {
        width: 20px;
        height: 20px;
      }
    }

    .quick-action__icon--primary {
      background: #EEF4FF;
      color: #003399;
    }

    .quick-action__icon--secondary {
      background: #EEF4FF;
      color: #002577;
    }

    .quick-action__icon--accent {
      background: #EEF4FF;
      color: #003399;
    }

    .quick-action__icon--success {
      background: #F0FFF4;
      color: #2F855A;
    }

    .quick-action__content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .quick-action__label {
      font-weight: 500;
      color: #0F172A;
    }

    .quick-action__desc {
      font-size: 0.875rem;
      color: #475569;
    }

    .quick-action__arrow {
      width: 18px;
      height: 18px;
      color: #94A3B8;
      transition: all 150ms;
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .stat-card,
      .booking-table__row,
      .quick-action,
      .quick-action__arrow,
      .header-action {
        transition: none;
      }
    }
  `]
})
export class AdminDashboardNewComponent implements OnInit {
  private http = inject(HttpClient);

  /* State */
  loading = signal(true);
  stats = signal<DashboardStats>({
    totalBookings: 0,
    pendingBookings: 0,
    completedBookings: 0,
    totalRevenue: 0,
    totalUsers: 0,
    totalTechnicians: 0,
    recentBookings: [],
    revenueByDay: []
  });

  /* Date */
  todayDate = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.loading.set(true);
    
    forkJoin({
      bookings: this.http.get<any>('/bookings', { params: { page: 1, page_size: 100 } }),
      users: this.http.get<any>('/users', { params: { page: 1, page_size: 1 } }),
      technicians: this.http.get<any>('/technicians', { params: { page: 1, page_size: 1 } })
    }).subscribe({
      next: (results) => {
        const bookings = results.bookings.items || [];
        const totalUsers = results.users.total || 0;
        const totalTechnicians = results.technicians.total || 0;

        const totalRevenue = bookings
          .filter((b: any) => b.payment_status === 'paid')
          .reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0);

        this.stats.set({
          totalBookings: bookings.length,
          pendingBookings: bookings.filter((b: any) => ['pending', 'confirmed'].includes(b.status)).length,
          completedBookings: bookings.filter((b: any) => b.status === 'completed').length,
          totalRevenue,
          totalUsers,
          totalTechnicians,
          recentBookings: bookings.slice(0, 5),
          revenueByDay: []
        });
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load dashboard data:', err);
        this.loading.set(false);
      }
    });
  }

  formatRevenue(amount: number): string {
    if (amount >= 100000) {
      return (amount / 100000).toFixed(1) + 'L';
    } else if (amount >= 1000) {
      return (amount / 1000).toFixed(1) + 'K';
    }
    return amount.toString();
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short'
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
      sample_collected: 'Collected',
      processing: 'Processing',
      completed: 'Completed',
      cancelled: 'Cancelled'
    };
    return map[status] || status;
  }
}
