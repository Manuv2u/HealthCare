import { Component, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, format,
} from 'date-fns';
import {
  CalendarModule, CalendarView, CalendarEvent, CalendarUtils, DateAdapter,
  CalendarA11y, CalendarDateFormatter, CalendarEventTitleFormatter,
} from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { BookingApiService } from '../../../core/api/services/booking-api.service';
import { AdminApiService } from '../../../core/api/services/admin-api.service';
import { LabBranchApiService } from '../../../core/api/services/lab-branch-api.service';
import { Booking, Technician, LabBranch } from '../../../core/api/api.types';
import { BOOKING_STATUS_OPTIONS, fmtStatus, statusColor } from '../../../core/utils/booking-status.util';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';

const STATUS_EVENT_COLORS: Record<string, { primary: string; secondary: string; secondaryText: string }> = {
  booked: { primary: 'var(--color-warning-500)', secondary: 'var(--color-warning-100)', secondaryText: 'var(--color-warning-700)' },
  technician_assigned: { primary: 'var(--color-info-500)', secondary: 'var(--color-info-100)', secondaryText: 'var(--color-info-700)' },
  accepted: { primary: 'var(--color-info-500)', secondary: 'var(--color-info-100)', secondaryText: 'var(--color-info-700)' },
  on_the_way: { primary: 'var(--color-primary-500)', secondary: 'var(--color-primary-100)', secondaryText: 'var(--color-primary-700)' },
  sample_collected: { primary: 'var(--color-primary-500)', secondary: 'var(--color-primary-100)', secondaryText: 'var(--color-primary-700)' },
  reached_lab: { primary: 'var(--color-primary-500)', secondary: 'var(--color-primary-100)', secondaryText: 'var(--color-primary-700)' },
  sample_delivered: { primary: 'var(--color-primary-500)', secondary: 'var(--color-primary-100)', secondaryText: 'var(--color-primary-700)' },
  processing: { primary: 'var(--color-primary-500)', secondary: 'var(--color-primary-100)', secondaryText: 'var(--color-primary-700)' },
  report_ready: { primary: 'var(--color-info-500)', secondary: 'var(--color-info-100)', secondaryText: 'var(--color-info-700)' },
  completed: { primary: 'var(--color-success-500)', secondary: 'var(--color-success-100)', secondaryText: 'var(--color-success-700)' },
  cancelled: { primary: 'var(--color-error-500)', secondary: 'var(--color-error-100)', secondaryText: 'var(--color-error-700)' },
  collected: { primary: 'var(--color-primary-500)', secondary: 'var(--color-primary-100)', secondaryText: 'var(--color-primary-700)' },
};
const DEFAULT_EVENT_COLOR = { primary: 'var(--color-secondary-500)', secondary: 'var(--color-secondary-100)', secondaryText: '#475569' };

function toCalendarEvent(b: Booking): CalendarEvent<Booking> {
  const slot = b.time_slot;
  const start = slot?.start_time ? new Date(`${b.booking_date}T${slot.start_time}:00`) : new Date(`${b.booking_date}T00:00:00`);
  const end = slot?.end_time ? new Date(`${b.booking_date}T${slot.end_time}:00`) : start;
  const who = b.patient_name || b.contact_name || 'Unknown patient';
  const visitIcon = b.collection_type === 'home' ? '🏠' : '🏥';
  const timeLabel = slot?.start_time ? `${slot.start_time} ` : '';
  return {
    id: b.id,
    start,
    end,
    title: `${timeLabel}${visitIcon} ${who} · ${b.reference_number}`,
    color: STATUS_EVENT_COLORS[b.status] ?? DEFAULT_EVENT_COLOR,
    meta: b,
  };
}

@Component({
  selector: 'app-admin-appointment-calendar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BadgeComponent,
    SpinnerComponent,
    AlertComponent,
    CalendarModule,
  ],
  // angular-calendar's views need CalendarUtils/CalendarA11y/CalendarDateFormatter/
  // CalendarEventTitleFormatter, none of which are root-provided — normally
  // CalendarModule.forRoot() supplies them, but that call isn't valid inside a
  // standalone component's `imports`. Providing the same set here (mirroring
  // forRoot's own provider list) fixes that without adding a root-level
  // provider that would pull angular-calendar/date-fns into every route.
  providers: [
    { provide: DateAdapter, useFactory: adapterFactory },
    CalendarEventTitleFormatter,
    CalendarDateFormatter,
    CalendarUtils,
    CalendarA11y,
  ],
  template: `
<div class="page">
  <div class="page-header">
    <div><h1 class="page-title">Appointment Calendar</h1><p class="page-sub">Day, week and month view of all appointments</p></div>
  </div>

  @if (error()) { <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">{{ error() }}</app-alert> }

  <div class="filter-bar">
    <div class="search-field">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input placeholder="Search patient name, booking ID or phone…" [(ngModel)]="searchQ" (input)="onSearchInput()" />
    </div>
    <select class="filter-sel" [(ngModel)]="statusFilter" (change)="refresh()">
      <option value="">All Status</option>
      @for (s of statusOptions; track s) { <option [value]="s">{{ fmtStatus(s) }}</option> }
    </select>
    <select class="filter-sel" [(ngModel)]="typeFilter" (change)="refresh()">
      <option value="">All Types</option>
      <option value="home">Home Collection</option>
      <option value="lab">Lab Visit</option>
    </select>
    <select class="filter-sel" [(ngModel)]="technicianFilter" (change)="refresh()">
      <option value="">All Technicians</option>
      @for (t of technicians(); track t.id) { <option [value]="t.id">{{ t.name }}</option> }
    </select>
    <select class="filter-sel" [(ngModel)]="labBranchFilter" (change)="refresh()">
      <option value="">All Lab Locations</option>
      @for (lb of labBranches(); track lb.id) { <option [value]="lb.id">{{ lb.name }}</option> }
    </select>
    <span class="count-badge">{{ sortedEvents().length }} appointments</span>
  </div>

  <div class="toolbar">
    <div class="nav-controls">
      <button class="pg-btn" (click)="prev()" aria-label="Previous">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button class="today-btn" (click)="today()">Today</button>
      <button class="pg-btn" (click)="next()" aria-label="Next">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <span class="range-label">{{ rangeLabel() }}</span>
    </div>
    <div class="view-toggle">
      <button [class.active]="view() === CalendarView.Month" (click)="setView(CalendarView.Month)">Month</button>
      <button [class.active]="view() === CalendarView.Week" (click)="setView(CalendarView.Week)">Week</button>
      <button [class.active]="view() === CalendarView.Day" (click)="setView(CalendarView.Day)">Day</button>
    </div>
  </div>

  <div class="calendar-layout">
    <div class="calendar-panel">
      @if (loading()) {
        <div class="load-wrap"><app-spinner size="md" /></div>
      } @else {
        @switch (view()) {
          @case (CalendarView.Month) {
            <mwl-calendar-month-view
              [viewDate]="viewDate()"
              [events]="events()"
              [weekStartsOn]="1"
              [tooltipTemplate]="tooltipTemplate"
              [eventTitleTemplate]="eventTitleTemplate"
              (eventClicked)="openBooking($event.event.meta)" />
          }
          @case (CalendarView.Week) {
            <mwl-calendar-week-view
              [viewDate]="viewDate()"
              [events]="events()"
              [weekStartsOn]="1"
              [tooltipTemplate]="tooltipTemplate"
              [eventTitleTemplate]="eventTitleTemplate"
              [hourSegments]="4"
              [dayStartHour]="6"
              [dayEndHour]="21"
              (eventClicked)="openBooking($event.event.meta)" />
          }
          @case (CalendarView.Day) {
            <mwl-calendar-day-view
              [viewDate]="viewDate()"
              [events]="events()"
              [tooltipTemplate]="tooltipTemplate"
              [eventTitleTemplate]="eventTitleTemplate"
              [hourSegments]="4"
              [dayStartHour]="6"
              [dayEndHour]="21"
              (eventClicked)="openBooking($event.event.meta)" />
          }
        }
      }
    </div>

    <div class="side-list">
      <h3 class="side-title">Appointments</h3>
      @if (!loading() && sortedEvents().length === 0) {
        <p class="side-empty">No appointments in this range.</p>
      }
      @for (ev of sortedEvents(); track ev.id) {
        <div class="side-item" (click)="openBooking(ev.meta!)">
          <span class="side-dot" [style.background]="ev.color?.primary"></span>
          <div class="side-body">
            <div class="side-time">{{ ev.start | date:'dd MMM, h:mm a' }}</div>
            <div class="side-name">{{ ev.meta!.patient_name || ev.meta!.contact_name || 'Unknown patient' }}</div>
            <div class="side-ref">{{ ev.meta!.reference_number }}</div>
          </div>
          <app-badge [color]="statusColor(ev.meta!.status)" size="sm">{{ fmtStatus(ev.meta!.status) }}</app-badge>
        </div>
      }
    </div>
  </div>
</div>

<ng-template #eventTitleTemplate let-event="event">
  <div class="ev-chip">
    <div class="ev-name">{{ event.meta.patient_name || event.meta.contact_name || 'Unknown' }}</div>
    <div class="ev-sub">{{ fmtStatus(event.meta.status) }}</div>
  </div>
</ng-template>

<ng-template #tooltipTemplate let-event="event">
  <div class="cal-tooltip-custom">
    <div class="tt-title">{{ event.meta.patient_name || event.meta.contact_name || 'Unknown patient' }}</div>
    <div class="tt-row"><span class="tt-label">Booking ID</span>{{ event.meta.reference_number }}</div>
    @if (event.meta.time_slot) {
      <div class="tt-row"><span class="tt-label">Time</span>{{ event.meta.time_slot.start_time }} – {{ event.meta.time_slot.end_time }}</div>
    }
    <div class="tt-row"><span class="tt-label">Visit</span>{{ event.meta.collection_type === 'home' ? 'Home Collection' : 'Lab Visit' }}</div>
    <div class="tt-row"><span class="tt-label">Status</span>{{ fmtStatus(event.meta.status) }}</div>
    @if (event.meta.assigned_technician) {
      <div class="tt-row"><span class="tt-label">Technician</span>{{ event.meta.assigned_technician.name }}</div>
    }
    @if (event.meta.lab_branch) {
      <div class="tt-row"><span class="tt-label">Lab</span>{{ event.meta.lab_branch.name }}</div>
    }
    @if (event.meta.items?.length) {
      <div class="tt-row"><span class="tt-label">Tests</span>{{ itemNames(event.meta.items) }}</div>
    }
  </div>
</ng-template>
`,
  styles: [`
    :host {
      --color-primary-50: #EEF4FF;
      --color-primary-100: #D9E5FF;
      --color-primary-500: #0047CC;
      --color-primary-600: #003399;
      --color-primary-700: #002577;
      display: block;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .page { display:flex; flex-direction:column; gap:1.25rem; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; }
    .page-title { font-size:1.5rem; font-weight:800; letter-spacing:-0.01em; color:#0F172A; margin:0 0 0.25rem 0; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }

    .filter-bar { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
    .search-field { display:flex; align-items:center; gap:0.5rem; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:0.75rem; padding:0.625rem 1rem; flex:1; min-width:220px; svg { width:18px; height:18px; color:#94A3B8; flex-shrink:0; } input { border:none; outline:none; font-size:0.875rem; color:#0F172A; background:transparent; width:100%; } &:focus-within { border-color:#0047CC; box-shadow:0 0 0 3px rgba(0, 71, 204,.12); } }
    .filter-sel { height:40px; padding:0 1rem; font-size:0.875rem; color:#0F172A; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:0.75rem; cursor:pointer; &:focus { outline:none; border-color:#0047CC; } }
    .count-badge { font-size:0.875rem; color:#94A3B8; white-space:nowrap; font-weight:500; }

    .toolbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem; }
    .nav-controls { display:flex; align-items:center; gap:0.75rem; }
    .pg-btn { display:flex; align-items:center; justify-content:center; width:36px; height:36px; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFFFFF; cursor:pointer; transition:all 150ms; &:hover { border-color:#0A50D8; color:#003399; } }
    .today-btn { height:36px; padding:0 0.875rem; font-size:0.8125rem; font-weight:600; color:#003399; background:#EEF4FF; border:1px solid #B3CAFF; border-radius:0.5rem; cursor:pointer; &:hover { background:#B3CAFF; } }
    .range-label { font-size:0.9375rem; font-weight:700; color:#0F172A; margin-left:0.25rem; }
    .view-toggle { display:flex; gap:0.25rem; background:#F1F5F9; border-radius:0.625rem; padding:0.25rem; }
    .view-toggle button { height:34px; padding:0 0.875rem; font-size:0.8125rem; font-weight:600; color:#475569; background:transparent; border:none; border-radius:0.5rem; cursor:pointer; transition:all 150ms; &.active { background:#FFFFFF; color:#003399; box-shadow:0 1px 2px rgba(0,0,0,.08); } }

    .load-wrap { display:flex; justify-content:center; padding:3rem; }

    .calendar-layout { display:flex; gap:1.25rem; align-items:flex-start; }
    .calendar-panel { flex:1; min-width:0; background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; padding:1rem; overflow:auto; max-height:78vh; position:relative; }
    /* Week/day view's day-of-week header row (and month view's weekday row)
       would otherwise scroll away with the grid beneath it — pin it to the
       top of the .calendar-panel scroll container. */
    .calendar-panel ::ng-deep .cal-day-headers { position:sticky; top:0; z-index:5; background:#FFFFFF; }
    .calendar-panel ::ng-deep .cal-month-view .cal-header { position:sticky; top:0; z-index:5; background:#FFFFFF; }
    .side-list { width:300px; flex-shrink:0; background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; padding:1rem; max-height:78vh; overflow:auto; display:flex; flex-direction:column; gap:0.5rem; }
    .side-title { font-size:0.8125rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94A3B8; margin:0 0 0.5rem 0; }
    .side-empty { font-size:0.8125rem; color:#94A3B8; margin:0; }
    .side-item { display:flex; align-items:flex-start; gap:0.625rem; padding:0.625rem; border-radius:0.625rem; cursor:pointer; transition:background 150ms; &:hover { background:#F8FAFC; } }
    .side-dot { width:8px; height:8px; border-radius:50%; margin-top:0.375rem; flex-shrink:0; }
    .side-body { flex:1; min-width:0; }
    .side-time { font-size:0.6875rem; color:#94A3B8; font-weight:600; }
    .side-name { font-size:0.8125rem; font-weight:600; color:#0F172A; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .side-ref { font-size:0.6875rem; color:#64748B; font-family:'JetBrains Mono','SF Mono',monospace; }

    .ev-chip { line-height:1.25; padding:0.0625rem 0; }
    .ev-name { font-size:0.75rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ev-sub { font-size:0.6875rem; opacity:0.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .cal-tooltip-custom { min-width:200px; padding:0.25rem; }
    .tt-title { font-size:0.8125rem; font-weight:700; margin-bottom:0.375rem; }
    .tt-row { font-size:0.75rem; line-height:1.5; }
    .tt-label { display:inline-block; min-width:70px; opacity:0.75; }

    @media (max-width:1024px) {
      .calendar-layout { flex-direction:column; }
      .side-list { width:100%; max-height:40vh; }
    }
    @media (max-width:640px) {
      .page-header { flex-direction:column; }
      .toolbar { flex-direction:column; align-items:flex-start; }
    }
  `],
})
export class AdminAppointmentCalendarComponent implements OnInit, OnDestroy {
  readonly CalendarView = CalendarView;
  readonly statusOptions = BOOKING_STATUS_OPTIONS;
  readonly fmtStatus = fmtStatus;
  readonly statusColor = statusColor;

  view = signal<CalendarView>(CalendarView.Week);
  viewDate = signal<Date>(new Date());
  events = signal<CalendarEvent<Booking>[]>([]);
  loading = signal(false);
  error = signal('');

  technicians = signal<Technician[]>([]);
  labBranches = signal<LabBranch[]>([]);

  statusFilter = '';
  typeFilter = '';
  technicianFilter = '';
  labBranchFilter = '';
  searchQ = '';

  sortedEvents = computed(() =>
    [...this.events()].sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0))
  );

  private pollTimer?: ReturnType<typeof setInterval>;
  private searchDebounce?: ReturnType<typeof setTimeout>;

  constructor(
    private bookingApi: BookingApiService,
    private adminApi: AdminApiService,
    private labBranchApi: LabBranchApiService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.adminApi.getTechnicians().subscribe({
      next: (r: any) => this.technicians.set(r.items ?? r ?? []),
      error: () => this.technicians.set([]),
    });
    this.labBranchApi.list().subscribe({
      next: (rows) => this.labBranches.set(rows),
      error: () => this.labBranches.set([]),
    });
    this.refresh();
    this.pollTimer = setInterval(() => this.refresh(), 60000);
  }

  ngOnDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
  }

  private computeRange(): { from: Date; to: Date } {
    const vd = this.viewDate();
    if (this.view() === CalendarView.Month) {
      return { from: startOfWeek(startOfMonth(vd), { weekStartsOn: 1 }), to: endOfWeek(endOfMonth(vd), { weekStartsOn: 1 }) };
    }
    if (this.view() === CalendarView.Week) {
      return { from: startOfWeek(vd, { weekStartsOn: 1 }), to: endOfWeek(vd, { weekStartsOn: 1 }) };
    }
    return { from: startOfDay(vd), to: endOfDay(vd) };
  }

  rangeLabel(): string {
    const vd = this.viewDate();
    if (this.view() === CalendarView.Month) return format(vd, 'MMMM yyyy');
    if (this.view() === CalendarView.Week) {
      const { from, to } = this.computeRange();
      return `${format(from, 'd MMM')} – ${format(to, 'd MMM yyyy')}`;
    }
    return format(vd, 'EEEE, d MMMM yyyy');
  }

  setView(v: CalendarView) {
    this.view.set(v);
    this.refresh();
  }

  prev() {
    const vd = this.viewDate();
    if (this.view() === CalendarView.Month) this.viewDate.set(subMonths(vd, 1));
    else if (this.view() === CalendarView.Week) this.viewDate.set(subWeeks(vd, 1));
    else this.viewDate.set(subDays(vd, 1));
    this.refresh();
  }

  next() {
    const vd = this.viewDate();
    if (this.view() === CalendarView.Month) this.viewDate.set(addMonths(vd, 1));
    else if (this.view() === CalendarView.Week) this.viewDate.set(addWeeks(vd, 1));
    else this.viewDate.set(addDays(vd, 1));
    this.refresh();
  }

  today() {
    this.viewDate.set(new Date());
    this.refresh();
  }

  onSearchInput() {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.refresh(), 350);
  }

  refresh() {
    this.loading.set(true);
    const { from, to } = this.computeRange();
    this.bookingApi.list({
      page_size: 1000,
      date_from: format(from, 'yyyy-MM-dd'),
      date_to: format(to, 'yyyy-MM-dd'),
      status: this.statusFilter || undefined,
      collection_type: this.typeFilter || undefined,
      technician_id: this.technicianFilter || undefined,
      lab_branch_id: this.labBranchFilter || undefined,
      search: this.searchQ.trim() || undefined,
    }).subscribe({
      next: (r) => {
        this.events.set(r.items.map(toCalendarEvent));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load appointments.');
        this.loading.set(false);
      },
    });
  }

  openBooking(b: Booking) {
    this.router.navigate(['/admin/bookings'], { queryParams: { id: b.id } });
  }

  itemNames(items: Booking['items']): string {
    return (items ?? []).map(i => i.item_name).filter(Boolean).join(', ');
  }
}
