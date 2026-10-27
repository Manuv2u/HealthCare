import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BookingApiService } from '../../../core/api/services/booking-api.service';
import { Booking } from '../../../core/api/api.types';
import { todayIstDateStr } from '../../../core/utils/ist.util';

// ── Status metadata ─────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  booked: 'Booked',
  technician_assigned: 'Assigned',
  accepted: 'Accepted',
  on_the_way: 'On the Way',
  sample_collected: 'Sample Collected',
  reached_lab: 'Reached Lab',
  sample_delivered: 'Delivered to Lab',
  processing: 'Processing',
  report_ready: 'Report Ready',
  completed: 'Completed',
  unable_to_collect: 'Unable to Collect',
  cancelled: 'Cancelled',
};

const STATUS_CONFIG: Record<string, { chip: string; text: string; dot: string }> = {
  technician_assigned: { chip: '#EEF4FF', text: '#002577', dot: '#0047CC' },
  accepted:            { chip: '#EEF4FF', text: '#003399', dot: '#0047CC' },
  on_the_way:          { chip: '#EEF4FF', text: '#001B57', dot: '#003399' },
  sample_collected:    { chip: '#EEF4FF', text: '#003399', dot: '#0047CC' },
  reached_lab:         { chip: '#EEF4FF', text: '#002577', dot: '#0047CC' },
  processing:          { chip: '#FEFCE8', text: '#A16207', dot: '#EAB308' },
  report_ready:        { chip: '#EEF4FF', text: '#003399', dot: '#0047CC' },
  completed:           { chip: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  unable_to_collect:   { chip: '#FEF2F2', text: '#B91C1C', dot: '#EF4444' },
  cancelled:           { chip: '#FEF2F2', text: '#B91C1C', dot: '#EF4444' },
};

// Technician workflow — only the next valid action(s) per current status.
// Lab-processing steps after reached_lab are driven by admin, not the field tech.
const TECH_ACTIONS: Record<string, { status: string; label: string; icon: string; danger?: boolean }[]> = {
  technician_assigned: [{ status: 'on_the_way', label: 'Start Journey', icon: 'directions_car' }],
  accepted:            [{ status: 'on_the_way', label: 'Start Journey', icon: 'directions_car' }],
  on_the_way:          [
    { status: 'sample_collected', label: 'Collect Sample', icon: 'colorize' },
    { status: 'unable_to_collect', label: 'Unable to Collect', icon: 'block', danger: true },
  ],
  sample_collected:    [{ status: 'reached_lab', label: 'Submit to Lab', icon: 'science' }],
};

// Canonical progress order for the timeline in the detail modal.
const TIMELINE_ORDER = [
  'booked', 'technician_assigned', 'accepted', 'on_the_way',
  'sample_collected', 'reached_lab', 'processing', 'report_ready', 'completed',
];

type SortKey = 'newest' | 'oldest' | 'amount' | 'nearest';

@Component({
  selector: 'app-technician-bookings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule],
  template: `
    <div class="page">
      <!-- ── Header ─────────────────────────────────────────────── -->
      <header class="page-header">
        <div class="header-left">
          <div class="eyebrow"><mat-icon>today</mat-icon><span>{{ todayLabel }}</span></div>
          <h1 class="page-title">My Assignments</h1>
        </div>
        <button class="refresh-btn" (click)="load()" [disabled]="loading()" aria-label="Refresh assignments">
          <mat-icon [class.spin]="loading()">refresh</mat-icon>
        </button>
      </header>

      <!-- ── Toolbar: search + sort ─────────────────────────────── -->
      <div class="toolbar">
        <div class="search-box">
          <mat-icon>search</mat-icon>
          <input type="text" [ngModel]="search()" (ngModelChange)="search.set($event)"
                 placeholder="Search ID, patient, phone, address, notes…" aria-label="Search assignments" />
          @if (search()) {
            <button class="clear-btn" (click)="search.set('')" aria-label="Clear search"><mat-icon>close</mat-icon></button>
          }
        </div>
        <label class="sort-select">
          <span class="sr-only">Sort</span>
          <mat-icon>sort</mat-icon>
          <select [ngModel]="sort()" (ngModelChange)="sort.set($event)" aria-label="Sort assignments">
            <option value="nearest">Nearest appointment</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount">Highest amount</option>
          </select>
        </label>
      </div>

      <!-- ── Status filter pills with counts ────────────────────── -->
      <div class="pills" role="tablist" aria-label="Filter by status">
        <button class="pill" role="tab" [class.active]="statusFilter() === ''" [attr.aria-selected]="statusFilter() === ''" (click)="statusFilter.set('')">
          All <span class="pill-count">{{ counts()['all'] || 0 }}</span>
        </button>
        @for (s of pillStatuses; track s) {
          @if ((counts()[s] || 0) > 0 || statusFilter() === s) {
            <button class="pill" role="tab" [class.active]="statusFilter() === s" [attr.aria-selected]="statusFilter() === s"
                    [style.--pill-dot]="statusConfig(s).dot" (click)="statusFilter.set(statusFilter() === s ? '' : s)">
              <span class="pill-dot"></span>{{ label(s) }} <span class="pill-count">{{ counts()[s] || 0 }}</span>
            </button>
          }
        }
      </div>

      <!-- ── Loading skeletons ──────────────────────────────────── -->
      @if (loading()) {
        <div class="card-list">
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-card">
              <div class="sk-row"><div class="sk sk-chip"></div><div class="sk sk-chip sk-w-sm"></div></div>
              <div class="sk-row"><div class="sk sk-line"></div><div class="sk sk-line sk-w-md"></div></div>
              <div class="sk-row"><div class="sk sk-btn"></div><div class="sk sk-btn"></div><div class="sk sk-btn sk-grow"></div></div>
            </div>
          }
        </div>
      } @else if (error()) {
        <div class="empty-state">
          <div class="empty-icon err"><mat-icon>cloud_off</mat-icon></div>
          <p class="empty-title">Couldn't load your assignments</p>
          <p class="empty-sub">{{ error() }}</p>
          <button class="btn-primary" (click)="load()">Try again</button>
        </div>
      } @else if (visible().length === 0) {
        <div class="empty-state">
          <div class="empty-icon"><mat-icon>event_available</mat-icon></div>
          <p class="empty-title">{{ hasAny() ? 'No matching assignments' : 'No assignments yet' }}</p>
          <p class="empty-sub">{{ hasAny() ? 'Try clearing your search or filters.' : 'New home-collection assignments will appear here.' }}</p>
          @if (hasAny()) { <button class="btn-ghost" (click)="resetFilters()">Clear filters</button> }
        </div>
      } @else {
        <!-- ── Booking cards ───────────────────────────────────── -->
        <div class="card-list">
          @for (b of visible(); track b.id) {
            <article class="card" [class.lab]="isLab(b)" [style.--dot]="statusConfig(b.status).dot">
              <span class="card-stripe"></span>
              <div class="card-body">

                <!-- Header -->
                <div class="card-head">
                  <div class="head-left">
                    <span class="ref">{{ b.reference_number }}</span>
                    <span class="badge" [style.background]="statusConfig(b.status).chip" [style.color]="statusConfig(b.status).text">
                      <span class="badge-dot" [style.background]="statusConfig(b.status).dot"></span>{{ label(b.status) }}
                    </span>
                    @if (priority(b)) {
                      <span class="badge prio" [class.overdue]="priority(b) === 'Overdue'">
                        <mat-icon>{{ priority(b) === 'Overdue' ? 'priority_high' : 'bolt' }}</mat-icon>{{ priority(b) }}
                      </span>
                    }
                  </div>
                  <div class="head-right">
                    <span class="type-chip" [class.home]="!isLab(b)">
                      <mat-icon>{{ isLab(b) ? 'apartment' : 'home' }}</mat-icon>{{ isLab(b) ? 'Lab Visit' : 'Home Collection' }}
                    </span>
                    <span class="pay-chip" [class.paid]="b.payment_status === 'paid'">{{ b.payment_status | titlecase }}</span>
                    <span class="amount">₹{{ (b.total_amount || 0).toLocaleString('en-IN') }}</span>
                  </div>
                </div>

                <!-- Info grid -->
                <div class="info-grid">
                  <div class="info"><mat-icon>person</mat-icon><div><span class="k">Patient</span><span class="v">{{ b.patient_name || b.contact_name || '—' }}<span class="sub" *ngIf="genderLabel(b)"> · {{ genderLabel(b) }}</span></span></div></div>
                  <div class="info"><mat-icon>call</mat-icon><div><span class="k">Phone</span><span class="v">{{ b.contact_phone || '—' }}</span></div></div>
                  <div class="info"><mat-icon>event</mat-icon><div><span class="k">Scheduled</span><span class="v">{{ b.booking_date | date:'dd MMM yyyy' }}</span></div></div>
                  <div class="info"><mat-icon>schedule</mat-icon><div><span class="k">Time Slot</span><span class="v">{{ slotLabel(b) }}</span></div></div>
                  <div class="info"><mat-icon>place</mat-icon><div><span class="k">{{ isLab(b) ? 'Lab' : 'Area' }}</span><span class="v">{{ areaLabel(b) }}</span></div></div>
                  <div class="info"><mat-icon>engineering</mat-icon><div><span class="k">Technician</span><span class="v">{{ b.assigned_technician?.name || 'You' }}</span></div></div>
                </div>

                <!-- Summary chips -->
                <div class="summary">
                  @if (testCount(b) > 0) { <span class="sum-chip"><mat-icon>biotech</mat-icon>{{ testCount(b) }} {{ testCount(b) === 1 ? 'Test' : 'Tests' }}</span> }
                  @if (pkgCount(b) > 0) { <span class="sum-chip"><mat-icon>inventory_2</mat-icon>{{ pkgCount(b) }} {{ pkgCount(b) === 1 ? 'Package' : 'Packages' }}</span> }
                  @if (b.technician_notes) { <span class="sum-chip note"><mat-icon>sticky_note_2</mat-icon>Has notes</span> }
                </div>

                <!-- Lab-visit notice -->
                @if (isLab(b)) {
                  <div class="lab-note"><mat-icon>info</mat-icon><span>Patient will visit the laboratory. No field workflow required.</span></div>
                }

                <!-- Actions -->
                <div class="actions">
                  <div class="quick">
                    <button class="qbtn" (click)="callPatient(b)" [disabled]="!b.contact_phone" aria-label="Call patient" title="Call patient"><mat-icon>call</mat-icon></button>
                    <button class="qbtn wa" (click)="whatsapp(b)" [disabled]="!b.contact_phone" aria-label="WhatsApp patient" title="WhatsApp">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37s-1.04 1.02-1.04 2.48 1.07 2.88 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.07-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88M20.46 3.49A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.9 11.9 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.49-8.42"/></svg>
                    </button>
                    <button class="qbtn" (click)="navigate(b)" aria-label="Navigate" title="Navigate"><mat-icon>near_me</mat-icon></button>
                    <button class="qbtn" (click)="copyAddress(b)" aria-label="Copy address" title="Copy address"><mat-icon>content_copy</mat-icon></button>
                  </div>
                  <div class="main-actions">
                    <button class="btn-ghost" (click)="openDetail(b)"><mat-icon>visibility</mat-icon>View Details</button>
                    @if (!isLab(b)) {
                      <button class="btn-ghost" (click)="openNotes(b)"><mat-icon>note_add</mat-icon>Notes</button>
                      @for (act of actionsFor(b.status); track act.status) {
                        <button class="btn-advance" [class.danger]="act.danger" [disabled]="updatingId() === b.id" (click)="openStatusUpdate(b, act.status, act.label)">
                          <mat-icon>{{ act.icon }}</mat-icon>{{ act.label }}
                        </button>
                      }
                      @if (actionsFor(b.status).length === 0) {
                        <span class="final" [class.done]="b.status === 'completed'" [class.stopped]="b.status === 'unable_to_collect' || b.status === 'cancelled'">
                          <mat-icon>{{ b.status === 'completed' ? 'check_circle' : (b.status === 'unable_to_collect' || b.status === 'cancelled' ? 'cancel' : 'hourglass_bottom') }}</mat-icon>{{ label(b.status) }}
                        </span>
                      }
                    } @else {
                      <span class="final lab-final"><mat-icon>local_hospital</mat-icon>Lab Visit</span>
                    }
                  </div>
                </div>
              </div>
            </article>
          }
        </div>
      }
    </div>

    <!-- ══ Detail modal ══════════════════════════════════════════ -->
    @if (detailOpen()) {
      <div class="modal-backdrop" (click)="closeDetail()"></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dm-title">
        <header class="modal-head">
          <div class="mh-left">
            <span class="mh-ref">{{ detailBooking()?.reference_number }}</span>
            <h2 id="dm-title">Booking Details</h2>
          </div>
          <span class="badge" [style.background]="statusConfig(detailBooking()?.status || '').chip" [style.color]="statusConfig(detailBooking()?.status || '').text">
            <span class="badge-dot" [style.background]="statusConfig(detailBooking()?.status || '').dot"></span>{{ label(detailBooking()?.status || '') }}
          </span>
          <button class="modal-close" (click)="closeDetail()" aria-label="Close"><mat-icon>close</mat-icon></button>
        </header>

        <div class="modal-scroll">
          @if (detailLoading() && !detail()) {
            <div class="modal-loading"><div class="spinner"></div><span>Loading details…</span></div>
          }
          @if (detail(); as d) {
            <div class="modal-grid">
              <!-- Left column -->
              <div class="col">
                <section class="panel">
                  <h3><mat-icon>person</mat-icon>Patient Information</h3>
                  <dl class="kv">
                    <div><dt>Name</dt><dd>{{ d.patient_name || d.contact_name || '—' }}</dd></div>
                    <div><dt>Gender</dt><dd>{{ genderLabel(d) || '—' }}</dd></div>
                    <div><dt>Relationship</dt><dd>{{ d.patient_relationship || '—' }}</dd></div>
                    <div><dt>Mobile</dt><dd>{{ d.contact_phone || '—' }}</dd></div>
                    <div><dt>Email</dt><dd class="wrap">{{ d.contact_email || '—' }}</dd></div>
                  </dl>
                </section>

                @if (d.address) {
                  <section class="panel">
                    <h3><mat-icon>place</mat-icon>Collection Address</h3>
                    <p class="addr">{{ d.address.address_line1 }}<br *ngIf="d.address.address_line2">{{ d.address.address_line2 }}<br>{{ d.address.city }}, {{ d.address.state }} — {{ d.address.pincode }}</p>
                    <button class="btn-ghost sm" (click)="navigate(d)"><mat-icon>near_me</mat-icon>Directions</button>
                  </section>
                }

                @if (d.lab_branch) {
                  <section class="panel">
                    <h3><mat-icon>apartment</mat-icon>Lab Branch</h3>
                    <p class="addr">{{ d.lab_branch.name }}<br>{{ d.lab_branch.address }}<br>{{ d.lab_branch.city }} — {{ d.lab_branch.pincode }}</p>
                  </section>
                }

                <section class="panel">
                  <h3><mat-icon>sticky_note_2</mat-icon>Notes</h3>
                  <p class="notes-text">{{ d.technician_notes || 'No notes added yet.' }}</p>
                </section>
              </div>

              <!-- Right column -->
              <div class="col">
                <section class="panel">
                  <h3><mat-icon>receipt_long</mat-icon>Booking Information</h3>
                  <dl class="kv two">
                    <div><dt>Type</dt><dd>{{ isLab(d) ? 'Lab Visit' : 'Home Collection' }}</dd></div>
                    <div><dt>Payment</dt><dd>{{ d.payment_status | titlecase }}</dd></div>
                    <div><dt>Date</dt><dd>{{ d.booking_date | date:'dd MMM yyyy' }}</dd></div>
                    <div><dt>Time Slot</dt><dd>{{ slotLabel(d) }}</dd></div>
                    <div><dt>Booked On</dt><dd>{{ d.created_at | date:'dd MMM, h:mm a' }}</dd></div>
                    <div><dt>Technician</dt><dd>{{ d.assigned_technician?.name || 'You' }}</dd></div>
                  </dl>
                </section>

                <section class="panel">
                  <h3><mat-icon>biotech</mat-icon>Tests &amp; Packages</h3>
                  <div class="items">
                    @for (it of d.items || []; track it.id) {
                      <div class="item-card">
                        <span class="item-ic" [class.pkg]="it.item_type === 'package'"><mat-icon>{{ it.item_type === 'package' ? 'inventory_2' : 'bloodtype' }}</mat-icon></span>
                        <span class="item-name">{{ it.item_name }}</span>
                        <span class="item-price">₹{{ price(it.unit_price).toLocaleString('en-IN') }}</span>
                      </div>
                    }
                    @if (!(d.items || []).length) { <p class="muted">No items listed.</p> }
                  </div>
                </section>

                <section class="panel">
                  <h3><mat-icon>payments</mat-icon>Payment Summary</h3>
                  <dl class="kv summary-kv">
                    <div><dt>Tests total</dt><dd>₹{{ testsTotal(d).toLocaleString('en-IN') }}</dd></div>
                    <div><dt>Packages total</dt><dd>₹{{ pkgTotal(d).toLocaleString('en-IN') }}</dd></div>
                    <div><dt>GST</dt><dd>₹{{ gstAmount(d).toLocaleString('en-IN') }}</dd></div>
                    <div class="grand"><dt>Grand total</dt><dd>₹{{ grandTotal(d).toLocaleString('en-IN') }}</dd></div>
                    <div><dt>Payment mode</dt><dd>{{ (d.payment?.method || '—') | titlecase }}</dd></div>
                    <div><dt>Status</dt><dd>{{ d.payment_status | titlecase }}</dd></div>
                  </dl>
                </section>

                <section class="panel">
                  <h3><mat-icon>timeline</mat-icon>Progress Timeline</h3>
                  <ol class="timeline">
                    @for (step of timeline(d); track step.status) {
                      <li [class.done]="step.state === 'done'" [class.current]="step.state === 'current'">
                        <span class="tl-dot"><mat-icon>{{ step.state === 'done' ? 'check' : (step.state === 'current' ? 'radio_button_checked' : 'radio_button_unchecked') }}</mat-icon></span>
                        <div class="tl-body"><span class="tl-label">{{ label(step.status) }}</span>@if (step.at) { <span class="tl-at">{{ step.at | date:'dd MMM, h:mm a' }}</span> }</div>
                      </li>
                    }
                  </ol>
                </section>
              </div>
            </div>
          }
        </div>

        <footer class="modal-foot">
          <button class="btn-ghost" (click)="closeDetail()">Close</button>
          <div class="foot-actions">
            <button class="btn-ghost" (click)="callPatient(detailBooking()!)" [disabled]="!detailBooking()?.contact_phone"><mat-icon>call</mat-icon>Call</button>
            <button class="btn-ghost" (click)="navigate(detailBooking()!)"><mat-icon>near_me</mat-icon>Navigate</button>
            @if (!isLab(detailBooking()!)) {
              <button class="btn-ghost" (click)="openNotes(detailBooking()!)"><mat-icon>note_add</mat-icon>Notes</button>
              @for (act of actionsFor(detailBooking()!.status).slice(0,1); track act.status) {
                <button class="btn-advance" (click)="openStatusUpdate(detailBooking()!, act.status, act.label); closeDetail()"><mat-icon>{{ act.icon }}</mat-icon>{{ act.label }}</button>
              }
            }
          </div>
        </footer>
      </div>
    }

    <!-- ══ Status update dialog ══════════════════════════════════ -->
    @if (statusDialog(); as dlg) {
      <div class="modal-backdrop" (click)="closeStatusUpdate()"></div>
      <div class="mini-dialog" role="dialog" aria-modal="true">
        <div class="md-head">
          <div class="md-ic" [style.background]="statusConfig(dlg.status).chip" [style.color]="statusConfig(dlg.status).text"><mat-icon>{{ dlg.status === 'unable_to_collect' ? 'block' : 'task_alt' }}</mat-icon></div>
          <div><h3>{{ dlg.label }}</h3><p>{{ dlg.booking.reference_number }}</p></div>
          <button class="modal-close" (click)="closeStatusUpdate()" aria-label="Close"><mat-icon>close</mat-icon></button>
        </div>
        <div class="md-body">
          <label class="md-label">Remarks {{ dlg.status === 'unable_to_collect' ? '(required)' : '(optional)' }}</label>
          <textarea [(ngModel)]="statusRemarks" rows="3" placeholder="Add a note about this update…"></textarea>
        </div>
        <div class="md-foot">
          <button class="btn-ghost" (click)="closeStatusUpdate()">Cancel</button>
          <button class="btn-advance" [disabled]="savingStatus() || (dlg.status === 'unable_to_collect' && !statusRemarks.trim())" (click)="confirmStatusUpdate()">
            {{ savingStatus() ? 'Saving…' : 'Confirm' }}
          </button>
        </div>
      </div>
    }

    <!-- ══ Notes dialog ══════════════════════════════════════════ -->
    @if (notesOpen()) {
      <div class="modal-backdrop" (click)="closeNotes()"></div>
      <div class="mini-dialog" role="dialog" aria-modal="true">
        <div class="md-head">
          <div class="md-ic" style="background:#EEF4FF;color:#002577"><mat-icon>note_add</mat-icon></div>
          <div><h3>Add Notes</h3><p>{{ notesBooking()?.reference_number }}</p></div>
          <button class="modal-close" (click)="closeNotes()" aria-label="Close"><mat-icon>close</mat-icon></button>
        </div>
        <div class="md-body">
          <label class="md-label">Technician notes</label>
          <textarea [(ngModel)]="notesText" rows="4" placeholder="Directions, patient condition, sample details…"></textarea>
        </div>
        <div class="md-foot">
          <button class="btn-ghost" (click)="closeNotes()">Cancel</button>
          <button class="btn-advance" [disabled]="savingNotes() || !notesText.trim()" (click)="saveNotes()">{{ savingNotes() ? 'Saving…' : 'Save Notes' }}</button>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      --emerald-900:#064E3B; --emerald-800:#065F46; --emerald-700:#047857; --emerald-600:#059669;
      --emerald-50:#ECFDF5; --text:#0F172A; --text-2:#475569; --muted:#94A3B8;
      --border:#E2E8F0; --border-2:#EEF2F5; --surface:#fff; --bg:#EEF4FF;
      display:block; font-family:'Inter',system-ui,-apple-system,sans-serif; color:var(--text);
    }
    * { box-sizing:border-box; }
    .page { max-width:920px; margin:0 auto; }
    .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }

    /* Header */
    .page-header { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:1.25rem; }
    .eyebrow { display:inline-flex; align-items:center; gap:.4rem; color:var(--emerald-700); font-size:.78rem; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
    .eyebrow mat-icon { font-size:1rem; width:1rem; height:1rem; }
    .page-title { font-size:1.7rem; font-weight:800; letter-spacing:-.02em; margin:.2rem 0 0; }
    .refresh-btn { width:42px; height:42px; border-radius:12px; border:1px solid var(--border); background:var(--surface); cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--emerald-700); box-shadow:0 1px 2px rgba(6,78,59,.05); }
    .refresh-btn:hover:not(:disabled) { background:var(--emerald-50); }
    .refresh-btn:disabled { opacity:.5; cursor:default; }
    .spin { animation:spin 1s linear infinite; } @keyframes spin { to { transform:rotate(360deg); } }

    /* Toolbar */
    .toolbar { display:flex; gap:.75rem; margin-bottom:1rem; }
    .search-box { flex:1; display:flex; align-items:center; gap:.5rem; background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:.65rem .9rem; box-shadow:0 1px 2px rgba(6,78,59,.04); }
    .search-box:focus-within { border-color:var(--emerald-600); box-shadow:0 0 0 3px rgba(5,150,105,.12); }
    .search-box mat-icon { color:var(--muted); font-size:1.2rem; width:1.2rem; height:1.2rem; flex-shrink:0; }
    .search-box input { border:none; outline:none; width:100%; font:inherit; font-size:.92rem; background:transparent; color:var(--text); }
    .clear-btn { border:none; background:none; cursor:pointer; color:var(--muted); display:flex; padding:0; }
    .clear-btn mat-icon { font-size:1.1rem; width:1.1rem; height:1.1rem; }
    .sort-select { display:flex; align-items:center; gap:.4rem; background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:.65rem .8rem; color:var(--text-2); box-shadow:0 1px 2px rgba(6,78,59,.04); }
    .sort-select mat-icon { font-size:1.15rem; width:1.15rem; height:1.15rem; color:var(--muted); }
    .sort-select select { border:none; outline:none; background:transparent; font:inherit; font-size:.88rem; font-weight:600; color:var(--text); cursor:pointer; }

    /* Pills */
    .pills { display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:1.25rem; }
    .pill { display:inline-flex; align-items:center; gap:.4rem; padding:.45rem .8rem; border-radius:999px; border:1.5px solid var(--border); background:var(--surface); font-size:.82rem; font-weight:600; color:var(--text-2); cursor:pointer; font-family:inherit; transition:all .18s; }
    .pill:hover { border-color:var(--emerald-600); color:var(--emerald-700); }
    .pill.active { background:var(--emerald-900); border-color:var(--emerald-900); color:#fff; }
    .pill-dot { width:8px; height:8px; border-radius:50%; background:var(--pill-dot,#94A3B8); }
    .pill.active .pill-dot { background:#fff; }
    .pill-count { font-size:.72rem; font-weight:800; background:rgba(0,0,0,.06); border-radius:999px; padding:.05rem .4rem; min-width:1.2rem; text-align:center; }
    .pill.active .pill-count { background:rgba(255,255,255,.22); }

    /* Card list */
    .card-list { display:flex; flex-direction:column; gap:1rem; }
    .card { position:relative; display:flex; background:var(--surface); border:1px solid var(--border-2); border-radius:18px; overflow:hidden; box-shadow:0 1px 2px rgba(6,78,59,.05), 0 6px 20px -12px rgba(6,78,59,.15); transition:transform .18s, box-shadow .18s; }
    .card:hover { transform:translateY(-2px); box-shadow:0 4px 8px rgba(6,78,59,.06), 0 18px 36px -18px rgba(6,78,59,.28); }
    .card-stripe { width:5px; flex-shrink:0; background:var(--dot,#94A3B8); }
    .card.lab .card-stripe { background:repeating-linear-gradient(45deg,#94A3B8,#94A3B8 6px,#CBD5E1 6px,#CBD5E1 12px); }
    .card-body { flex:1; padding:1.15rem 1.35rem 1.1rem; min-width:0; }

    .card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-bottom:1rem; }
    .head-left { display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; }
    .ref { font-family:'JetBrains Mono','SF Mono',monospace; font-size:.82rem; font-weight:700; color:var(--emerald-800); }
    .badge { display:inline-flex; align-items:center; gap:.35rem; font-size:.7rem; font-weight:800; padding:.25rem .6rem; border-radius:999px; text-transform:uppercase; letter-spacing:.05em; }
    .badge-dot { width:7px; height:7px; border-radius:50%; }
    .badge.prio { background:#FEF3C7; color:#B45309; }
    .badge.prio.overdue { background:#FEE2E2; color:#B91C1C; }
    .badge.prio mat-icon { font-size:.85rem; width:.85rem; height:.85rem; }
    .head-right { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
    .type-chip { display:inline-flex; align-items:center; gap:.3rem; font-size:.72rem; font-weight:700; padding:.28rem .6rem; border-radius:8px; background:#EEF4FF; color:#002577; }
    .type-chip.home { background:var(--emerald-50); color:var(--emerald-700); }
    .type-chip mat-icon { font-size:.95rem; width:.95rem; height:.95rem; }
    .pay-chip { font-size:.7rem; font-weight:800; padding:.25rem .55rem; border-radius:8px; background:#FEF3C7; color:#B45309; text-transform:uppercase; }
    .pay-chip.paid { background:#DCFCE7; color:#15803D; }
    .amount { font-size:1.05rem; font-weight:800; color:var(--text); letter-spacing:-.01em; }

    .info-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:.7rem 1.1rem; padding:.9rem 0; border-top:1px solid var(--border-2); border-bottom:1px solid var(--border-2); }
    .info { display:flex; align-items:center; gap:.55rem; min-width:0; }
    .info > mat-icon { font-size:1.15rem; width:1.15rem; height:1.15rem; color:var(--emerald-600); flex-shrink:0; }
    .info > div { display:flex; flex-direction:column; min-width:0; }
    .info .k { font-size:.66rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
    .info .v { font-size:.86rem; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .info .v .sub { color:var(--text-2); font-weight:500; }

    .summary { display:flex; gap:.5rem; flex-wrap:wrap; margin-top:.9rem; }
    .sum-chip { display:inline-flex; align-items:center; gap:.35rem; font-size:.76rem; font-weight:600; padding:.3rem .6rem; border-radius:8px; background:#F1F5F9; color:var(--text-2); }
    .sum-chip mat-icon { font-size:.95rem; width:.95rem; height:.95rem; }
    .sum-chip.note { background:#FEF9C3; color:#A16207; }

    .lab-note { display:flex; align-items:center; gap:.5rem; margin-top:.9rem; padding:.6rem .8rem; background:#F8FAFC; border:1px dashed #CBD5E1; border-radius:10px; font-size:.82rem; color:var(--text-2); }
    .lab-note mat-icon { font-size:1.05rem; width:1.05rem; height:1.05rem; color:#64748B; }

    .actions { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-top:1rem; flex-wrap:wrap; }
    .quick { display:flex; gap:.4rem; }
    .qbtn { width:38px; height:38px; border-radius:10px; border:1px solid var(--border); background:var(--surface); cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--emerald-700); transition:all .15s; }
    .qbtn:hover:not(:disabled) { background:var(--emerald-50); border-color:var(--emerald-600); }
    .qbtn:disabled { opacity:.4; cursor:default; }
    .qbtn mat-icon { font-size:1.15rem; width:1.15rem; height:1.15rem; }
    .qbtn.wa { color:#128C7E; }
    .qbtn.wa:hover:not(:disabled) { background:#E7F9F1; border-color:#25D366; }
    .main-actions { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; }

    .btn-ghost { display:inline-flex; align-items:center; gap:.4rem; padding:.55rem .9rem; border-radius:10px; border:1px solid var(--border); background:var(--surface); font:inherit; font-size:.84rem; font-weight:600; color:var(--text-2); cursor:pointer; transition:all .15s; }
    .btn-ghost:hover:not(:disabled) { background:#F8FAFC; color:var(--text); }
    .btn-ghost:disabled { opacity:.5; cursor:default; }
    .btn-ghost.sm { padding:.4rem .7rem; font-size:.8rem; }
    .btn-ghost mat-icon, .btn-advance mat-icon { font-size:1.05rem; width:1.05rem; height:1.05rem; }
    .btn-advance { display:inline-flex; align-items:center; gap:.4rem; padding:.55rem 1rem; border-radius:10px; border:none; background:linear-gradient(135deg,var(--emerald-600),var(--emerald-700)); color:#fff; font:inherit; font-size:.84rem; font-weight:700; cursor:pointer; box-shadow:0 4px 12px -3px rgba(5,150,105,.5); transition:filter .15s; }
    .btn-advance:hover:not(:disabled) { filter:brightness(1.06); }
    .btn-advance:disabled { opacity:.55; cursor:default; }
    .btn-advance.danger { background:linear-gradient(135deg,#EF4444,#DC2626); box-shadow:0 4px 12px -3px rgba(239,68,68,.5); }
    .btn-primary { display:inline-flex; align-items:center; gap:.4rem; padding:.7rem 1.3rem; border-radius:12px; border:none; background:var(--emerald-700); color:#fff; font:inherit; font-weight:700; cursor:pointer; }
    .final { display:inline-flex; align-items:center; gap:.4rem; font-size:.84rem; font-weight:700; color:var(--text-2); padding:.5rem .8rem; border-radius:10px; background:#F1F5F9; }
    .final.done { color:#15803D; background:#F0FDF4; }
    .final.stopped { color:#B91C1C; background:#FEF2F2; }
    .final.lab-final { color:#002577; background:#EEF4FF; }
    .final mat-icon { font-size:1.05rem; width:1.05rem; height:1.05rem; }

    /* Skeleton + empty */
    .skeleton-card { background:var(--surface); border:1px solid var(--border-2); border-radius:18px; padding:1.35rem; display:flex; flex-direction:column; gap:1rem; }
    .sk-row { display:flex; gap:.6rem; align-items:center; }
    .sk { background:linear-gradient(90deg,#EEF2F5 25%,#F8FAFC 37%,#EEF2F5 63%); background-size:400% 100%; animation:shimmer 1.4s ease infinite; border-radius:8px; height:14px; }
    @keyframes shimmer { 0%{background-position:100% 0} 100%{background-position:0 0} }
    .sk-chip { width:110px; height:24px; border-radius:999px; } .sk-w-sm { width:70px; }
    .sk-line { flex:1; } .sk-w-md { max-width:180px; }
    .sk-btn { width:96px; height:36px; border-radius:10px; } .sk-grow { flex:1; }
    .empty-state { text-align:center; padding:4rem 1.5rem; background:var(--surface); border:1px dashed var(--border); border-radius:18px; }
    .empty-icon { width:72px; height:72px; margin:0 auto 1rem; border-radius:50%; background:var(--emerald-50); color:var(--emerald-600); display:flex; align-items:center; justify-content:center; }
    .empty-icon.err { background:#FEF2F2; color:#EF4444; }
    .empty-icon mat-icon { font-size:2rem; width:2rem; height:2rem; }
    .empty-title { font-size:1.1rem; font-weight:700; margin:0 0 .3rem; }
    .empty-sub { color:var(--text-2); font-size:.9rem; margin:0 0 1.2rem; }

    /* Modal */
    .modal-backdrop { position:fixed; inset:0; background:rgba(6,78,59,.45); backdrop-filter:blur(4px); z-index:300; animation:fade .18s ease; }
    @keyframes fade { from{opacity:0} to{opacity:1} }
    .modal { position:fixed; z-index:301; top:50%; left:50%; transform:translate(-50%,-50%); width:min(1100px,calc(100vw - 2.5rem)); max-height:calc(100vh - 2.5rem); background:var(--surface); border-radius:22px; box-shadow:0 30px 70px -15px rgba(6,78,59,.45); display:flex; flex-direction:column; overflow:hidden; animation:pop .24s cubic-bezier(0,0,.2,1); }
    @keyframes pop { from{opacity:0; transform:translate(-50%,-46%)} to{opacity:1; transform:translate(-50%,-50%)} }
    .modal-head { display:flex; align-items:center; gap:1rem; padding:1.25rem 1.5rem; border-bottom:1px solid var(--border-2); }
    .mh-left { display:flex; flex-direction:column; }
    .mh-ref { font-family:'JetBrains Mono',monospace; font-size:.75rem; font-weight:700; color:var(--emerald-700); }
    .mh-left h2 { margin:.1rem 0 0; font-size:1.2rem; font-weight:800; }
    .modal-head .badge { margin-left:auto; }
    .modal-close { width:36px; height:36px; border-radius:10px; border:none; background:#F1F5F9; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text-2); }
    .modal-close:hover { background:#E2E8F0; color:var(--text); }
    .modal-scroll { overflow-y:auto; padding:1.5rem; }
    .modal-loading { display:flex; flex-direction:column; align-items:center; gap:1rem; padding:4rem; color:var(--text-2); }
    .spinner { width:36px; height:36px; border:3px solid var(--border); border-top-color:var(--emerald-600); border-radius:50%; animation:spin 1s linear infinite; }
    .modal-grid { display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; }
    .col { display:flex; flex-direction:column; gap:1.25rem; }
    .panel { background:#F8FAFC; border:1px solid var(--border-2); border-radius:14px; padding:1.1rem 1.2rem; }
    .panel h3 { display:flex; align-items:center; gap:.5rem; font-size:.82rem; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--emerald-800); margin:0 0 .9rem; }
    .panel h3 mat-icon { font-size:1.1rem; width:1.1rem; height:1.1rem; color:var(--emerald-600); }
    .kv { display:flex; flex-direction:column; gap:.6rem; margin:0; }
    .kv.two, .kv.summary-kv { display:grid; grid-template-columns:1fr 1fr; gap:.6rem 1rem; }
    .kv > div { display:flex; flex-direction:column; gap:.15rem; min-width:0; }
    .kv dt { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color:var(--muted); }
    .kv dd { margin:0; font-size:.9rem; font-weight:600; color:var(--text); }
    .kv dd.wrap { word-break:break-all; }
    .summary-kv .grand dt, .summary-kv .grand dd { color:var(--emerald-800); font-weight:800; font-size:.95rem; }
    .summary-kv .grand { grid-column:1 / -1; padding-top:.5rem; border-top:1px solid var(--border); }
    .addr { font-size:.9rem; line-height:1.5; color:var(--text); margin:0 0 .8rem; }
    .notes-text { font-size:.9rem; color:var(--text-2); margin:0; white-space:pre-wrap; }
    .items { display:flex; flex-direction:column; gap:.5rem; }
    .item-card { display:flex; align-items:center; gap:.7rem; background:var(--surface); border:1px solid var(--border-2); border-radius:10px; padding:.6rem .8rem; }
    .item-ic { width:30px; height:30px; border-radius:8px; background:#FEE2E2; color:#DC2626; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .item-ic.pkg { background:#D9E5FF; color:#003399; }
    .item-ic mat-icon { font-size:1rem; width:1rem; height:1rem; }
    .item-name { flex:1; font-size:.88rem; font-weight:600; min-width:0; }
    .item-price { font-size:.9rem; font-weight:800; color:var(--emerald-800); }
    .muted { color:var(--muted); font-size:.85rem; margin:0; }

    .timeline { list-style:none; margin:0; padding:0; position:relative; }
    .timeline li { display:flex; gap:.7rem; padding-bottom:1rem; position:relative; }
    .timeline li:not(:last-child)::before { content:''; position:absolute; left:11px; top:22px; bottom:-2px; width:2px; background:var(--border); }
    .timeline li.done:not(:last-child)::before { background:var(--emerald-500,#10B981); }
    .tl-dot { width:24px; height:24px; border-radius:50%; background:#F1F5F9; color:var(--muted); display:flex; align-items:center; justify-content:center; flex-shrink:0; z-index:1; }
    .timeline li.done .tl-dot { background:var(--emerald-600); color:#fff; }
    .timeline li.current .tl-dot { background:#EEF4FF; color:#003399; box-shadow:0 0 0 3px #EEF4FF; }
    .tl-dot mat-icon { font-size:.9rem; width:.9rem; height:.9rem; }
    .tl-body { display:flex; flex-direction:column; padding-top:.15rem; }
    .tl-label { font-size:.86rem; font-weight:600; color:var(--text); }
    .timeline li:not(.done):not(.current) .tl-label { color:var(--muted); }
    .tl-at { font-size:.72rem; color:var(--muted); }

    .modal-foot { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem 1.5rem; border-top:1px solid var(--border-2); background:#FBFDFC; }
    .foot-actions { display:flex; gap:.5rem; flex-wrap:wrap; }

    /* Mini dialogs */
    .mini-dialog { position:fixed; z-index:301; top:50%; left:50%; transform:translate(-50%,-50%); width:min(440px,calc(100vw - 2rem)); background:var(--surface); border-radius:18px; box-shadow:0 24px 50px -12px rgba(6,78,59,.4); overflow:hidden; animation:pop .2s cubic-bezier(0,0,.2,1); }
    .md-head { display:flex; align-items:center; gap:.8rem; padding:1.1rem 1.25rem; border-bottom:1px solid var(--border-2); }
    .md-ic { width:40px; height:40px; border-radius:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .md-head h3 { margin:0; font-size:1.05rem; font-weight:800; }
    .md-head p { margin:.1rem 0 0; font-size:.78rem; color:var(--muted); font-family:'JetBrains Mono',monospace; }
    .md-head .modal-close { margin-left:auto; }
    .md-body { padding:1.1rem 1.25rem; }
    .md-label { display:block; font-size:.8rem; font-weight:700; color:var(--text); margin-bottom:.4rem; }
    .md-body textarea { width:100%; border:1px solid var(--border); border-radius:10px; padding:.7rem .85rem; font:inherit; font-size:.9rem; resize:vertical; color:var(--text); }
    .md-body textarea:focus { outline:none; border-color:var(--emerald-600); box-shadow:0 0 0 3px rgba(5,150,105,.12); }
    .md-foot { display:flex; justify-content:flex-end; gap:.6rem; padding:0 1.25rem 1.25rem; }

    /* Responsive */
    @media (max-width:768px) {
      .toolbar { flex-direction:column; }
      .info-grid { grid-template-columns:1fr 1fr; }
      .card-head { flex-direction:column; gap:.6rem; }
      .head-right { width:100%; }
      .actions { flex-direction:column; align-items:stretch; }
      .quick { justify-content:space-between; }
      .qbtn { flex:1; }
      .main-actions { flex-direction:column; }
      .main-actions > * { width:100%; justify-content:center; }
      .modal { top:0; left:0; transform:none; width:100vw; height:100dvh; max-height:100dvh; border-radius:0; }
      @keyframes pop { from{opacity:0; transform:translateY(12px)} to{opacity:1; transform:none} }
      .modal-grid { grid-template-columns:1fr; }
      .modal-foot { position:sticky; bottom:0; flex-direction:column; align-items:stretch; }
      .foot-actions { display:grid; grid-template-columns:1fr 1fr; }
      .foot-actions > * { justify-content:center; }
      .mini-dialog { top:auto; bottom:0; left:0; transform:none; width:100vw; border-radius:18px 18px 0 0; }
    }
    @media (max-width:480px) { .info-grid { grid-template-columns:1fr; } }
    @media (prefers-reduced-motion:reduce) { .card, .sk, .spin, .modal, .mini-dialog { animation:none !important; transition:none !important; } }
  `],
})
export class TechnicianBookingsComponent implements OnInit {
  readonly pillStatuses = ['technician_assigned', 'accepted', 'on_the_way', 'sample_collected', 'reached_lab', 'completed', 'unable_to_collect'];
  readonly todayLabel = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ── State (signals) ──
  all = signal<Booking[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  search = signal('');
  sort = signal<SortKey>('nearest');
  statusFilter = signal('');
  updatingId = signal<string | null>(null);

  // detail modal
  detailOpen = signal(false);
  detailBooking = signal<Booking | null>(null);
  detail = signal<Booking | null>(null);
  detailLoading = signal(false);

  // status dialog
  statusDialog = signal<{ booking: Booking; status: string; label: string } | null>(null);
  statusRemarks = '';
  savingStatus = signal(false);

  // notes dialog
  notesOpen = signal(false);
  notesBooking = signal<Booking | null>(null);
  notesText = '';
  savingNotes = signal(false);

  // ── Derived ──
  hasAny = computed(() => this.all().length > 0);

  counts = computed<Record<string, number>>(() => {
    const c: Record<string, number> = { all: this.all().length };
    for (const b of this.all()) c[b.status] = (c[b.status] || 0) + 1;
    return c;
  });

  visible = computed<Booking[]>(() => {
    let list = this.all();
    const f = this.statusFilter();
    if (f) list = list.filter(b => b.status === f);
    const q = this.search().trim().toLowerCase();
    if (q) {
      list = list.filter(b =>
        (b.reference_number || '').toLowerCase().includes(q) ||
        (b.patient_name || '').toLowerCase().includes(q) ||
        (b.contact_name || '').toLowerCase().includes(q) ||
        (b.contact_phone || '').toLowerCase().includes(q) ||
        (b.technician_notes || '').toLowerCase().includes(q) ||
        this.areaLabel(b).toLowerCase().includes(q));
    }
    const s = this.sort();
    const arr = [...list];
    arr.sort((a, b) => {
      switch (s) {
        case 'oldest': return +new Date(a.created_at) - +new Date(b.created_at);
        case 'amount': return (b.total_amount || 0) - (a.total_amount || 0);
        case 'nearest': return +new Date(a.booking_date) - +new Date(b.booking_date);
        default: return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });
    return arr;
  });

  constructor(private bookingApi: BookingApiService, private snack: MatSnackBar) {}

  ngOnInit(): void { this.load(); }

  // ── Helpers ──
  label(s: string): string { return STATUS_LABELS[s] ?? s; }
  statusConfig(s: string) { return STATUS_CONFIG[s] ?? { chip: '#F1F5F9', text: '#475569', dot: '#94A3B8' }; }
  actionsFor(status: string) { return TECH_ACTIONS[status] ?? []; }
  isLab(b: Booking | null | undefined): boolean { return b?.collection_type === 'lab'; }
  testCount(b: Booking): number { return (b.items || []).filter(i => i.item_type === 'test').length; }
  pkgCount(b: Booking): number { return (b.items || []).filter(i => i.item_type === 'package').length; }
  genderLabel(b: Booking): string { const g = b.patient_gender; return g ? g.charAt(0).toUpperCase() + g.slice(1) : ''; }
  slotLabel(b: Booking): string { return b.time_slot ? `${b.time_slot.start_time} – ${b.time_slot.end_time}` : '—'; }
  areaLabel(b: Booking): string {
    if (this.isLab(b)) return b.lab_branch?.name || b.lab_branch?.city || 'At lab';
    if (b.address) return [b.address.city, b.address.pincode].filter(Boolean).join(', ');
    return b.pincode || '—';
  }
  priority(b: Booking): string | null {
    if (['completed', 'cancelled', 'unable_to_collect'].includes(b.status)) return null;
    const today = todayIstDateStr();
    const d = b.booking_date.slice(0, 10);
    if (d < today) return 'Overdue';
    if (d === today) return 'Today';
    return null;
  }

  // API serialises Decimal money fields as strings — coerce before arithmetic.
  price(v: unknown): number { const n = Number(v); return isFinite(n) ? n : 0; }
  testsTotal(b: Booking): number { return (b.items || []).filter(i => i.item_type === 'test').reduce((s, i) => s + this.price(i.unit_price), 0); }
  pkgTotal(b: Booking): number { return (b.items || []).filter(i => i.item_type === 'package').reduce((s, i) => s + this.price(i.unit_price), 0); }
  gstAmount(b: Booking): number {
    if (b.payment?.gst_amount != null) return Math.round(this.price(b.payment.gst_amount));
    return Math.round((this.testsTotal(b) + this.pkgTotal(b)) * 0.18);
  }
  grandTotal(b: Booking): number {
    if (b.payment) return Math.round(this.price(b.payment.amount) + this.price(b.payment.gst_amount));
    return Math.round(this.price(b.total_amount) || (this.testsTotal(b) + this.pkgTotal(b)) * 1.18);
  }

  timeline(b: Booking): { status: string; state: 'done' | 'current' | 'todo'; at?: string }[] {
    const history = b.status_history || [];
    const atMap: Record<string, string> = {};
    for (const h of history) if (h.to_status && h.changed_at) atMap[h.to_status] = h.changed_at;
    const currentIdx = TIMELINE_ORDER.indexOf(b.status);
    return TIMELINE_ORDER.map((st, i) => ({
      status: st,
      state: (currentIdx >= 0 && i < currentIdx) ? 'done' : (i === currentIdx ? 'current' : 'todo'),
      at: atMap[st],
    })) as { status: string; state: 'done' | 'current' | 'todo'; at?: string }[];
  }

  // ── Data ──
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.bookingApi.getMyAssigned({ page: 1, page_size: 200 }).subscribe({
      next: (res) => { this.all.set(res.items); this.loading.set(false); },
      error: () => { this.error.set('Please check your connection and try again.'); this.loading.set(false); },
    });
  }

  resetFilters(): void { this.statusFilter.set(''); this.search.set(''); }

  // ── Quick actions ──
  private phoneHref(b: Booking): string { return `tel:${(b.contact_phone || '').replace(/\s/g, '')}`; }
  callPatient(b: Booking): void { if (b.contact_phone) window.location.href = this.phoneHref(b); }
  whatsapp(b: Booking): void {
    if (!b.contact_phone) return;
    const num = b.contact_phone.replace(/\D/g, '');
    const e164 = num.length === 10 ? '91' + num : num;
    const msg = `Hello, this is your Sri Health Plus technician regarding booking ${b.reference_number}.`;
    window.open(`https://wa.me/${e164}?text=${encodeURIComponent(msg)}`, '_blank');
  }
  navigate(b: Booking): void {
    const a = b.address;
    const query = a
      ? [a.address_line1, a.address_line2, a.city, a.state, a.pincode].filter(Boolean).join(', ')
      : (this.isLab(b) ? (b.lab_branch?.name + ' ' + (b.lab_branch?.address || '')) : (b.pincode || ''));
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || 'lab')}`, '_blank');
  }
  copyAddress(b: Booking): void {
    const a = b.address;
    const text = a ? [a.address_line1, a.address_line2, a.city, a.state, a.pincode].filter(Boolean).join(', ') : this.areaLabel(b);
    navigator.clipboard?.writeText(text).then(() => this.toast('Address copied'), () => this.toast('Could not copy'));
  }

  // ── Detail modal (lazy) ──
  openDetail(b: Booking): void {
    this.detailBooking.set(b);
    this.detail.set(b);        // show list data instantly
    this.detailOpen.set(true);
    this.detailLoading.set(true);
    this.bookingApi.get(b.id).subscribe({
      next: (full) => { this.detail.set(full); this.detailBooking.set(full); this.detailLoading.set(false); },
      error: () => { this.detailLoading.set(false); },   // keep list data as fallback
    });
  }
  closeDetail(): void { this.detailOpen.set(false); this.detail.set(null); this.detailBooking.set(null); }

  // ── Status update ──
  openStatusUpdate(b: Booking, status: string, label: string): void {
    if (this.isLab(b)) { this.toast('This action is not allowed for Lab Visit bookings.'); return; }
    this.statusDialog.set({ booking: b, status, label }); this.statusRemarks = '';
  }
  closeStatusUpdate(): void { this.statusDialog.set(null); this.statusRemarks = ''; }

  confirmStatusUpdate(): void {
    const dlg = this.statusDialog();
    if (!dlg) return;
    if (dlg.status === 'unable_to_collect' && !this.statusRemarks.trim()) return;
    this.savingStatus.set(true);
    this.updatingId.set(dlg.booking.id);
    const remarks = this.statusRemarks.trim();
    this.bookingApi.updateStatus(dlg.booking.id, dlg.status, remarks || undefined).subscribe({
      next: (updated) => {
        const finalize = () => {
          this.all.update(list => list.map(x => x.id === updated.id ? { ...x, ...updated } : x));
          this.savingStatus.set(false); this.updatingId.set(null); this.closeStatusUpdate();
          this.toast(`✓ ${this.label(dlg.status)}`);
        };
        if (remarks) this.bookingApi.addRemarks(dlg.booking.id, remarks).subscribe({ next: finalize, error: finalize });
        else finalize();
      },
      error: (err) => {
        this.savingStatus.set(false); this.updatingId.set(null);
        this.toast('✗ ' + (err?.error?.detail?.message ?? 'Failed to update status.'));
      },
    });
  }

  // ── Notes ──
  openNotes(b: Booking): void { this.notesBooking.set(b); this.notesText = b.technician_notes ?? ''; this.notesOpen.set(true); }
  closeNotes(): void { this.notesOpen.set(false); this.notesBooking.set(null); this.notesText = ''; }
  saveNotes(): void {
    const b = this.notesBooking();
    if (!b || !this.notesText.trim()) return;
    this.savingNotes.set(true);
    this.bookingApi.addRemarks(b.id, this.notesText.trim()).subscribe({
      next: (updated) => {
        this.all.update(list => list.map(x => x.id === updated.id ? { ...x, technician_notes: updated.technician_notes } : x));
        if (this.detail()?.id === b.id) this.detail.update(d => d ? { ...d, technician_notes: updated.technician_notes } : d);
        this.savingNotes.set(false); this.closeNotes(); this.toast('✓ Notes saved');
      },
      error: () => { this.savingNotes.set(false); this.toast('✗ Failed to save notes.'); },
    });
  }

  private toast(msg: string): void { this.snack.open(msg, 'OK', { duration: 3000 }); }
}
