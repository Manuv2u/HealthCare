import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BookingApiService } from '../../../core/api/services/booking-api.service';
import { AdminApiService } from '../../../core/api/services/admin-api.service';
import { ReportApiService } from '../../../core/api/services/report-api.service';
import { PaymentApiService } from '../../../core/api/services/payment-api.service';
import { BillingApiService } from '../../../core/api/services/billing-api.service';
import { Booking, BookingAdjustment, Technician } from '../../../core/api/api.types';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { BOOKING_STATUS_OPTIONS, fmtStatus, statusColor } from '../../../core/utils/booking-status.util';

const STATUS_OPTIONS = BOOKING_STATUS_OPTIONS;

@Component({
  selector: 'app-admin-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent, SpinnerComponent, AlertComponent, ModalComponent],
  template: `
<div class="page">
  @if (!selected()) {
    <div class="page-header">
      <div><h1 class="page-title">All Bookings</h1><p class="page-sub">View and manage all patient appointment bookings</p></div>
    </div>

    @if (toast()) { <app-alert type="success" [dismissible]="true" (dismissed)="toast.set('')">{{ toast() }}</app-alert> }
    @if (error()) { <app-alert type="error" [dismissible]="true" (dismissed)="error.set('')">{{ error() }}</app-alert> }

    <!-- Filters -->
    <div class="filter-bar">
      <div class="search-field">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input placeholder="Search reference, customer name or phone…" [(ngModel)]="searchQ" (input)="applyFilter()" />
      </div>
      <select class="filter-sel" [(ngModel)]="statusFilter" (change)="applyFilter()">
        <option value="">All Status</option>
        @for (s of statusOptions; track s) { <option [value]="s">{{ fmtStatus(s) }}</option> }
      </select>
      <select class="filter-sel" [(ngModel)]="typeFilter" (change)="applyFilter()">
        <option value="">All Types</option>
        <option value="home">Home Collection</option>
        <option value="lab">Lab Visit</option>
      </select>
      <span class="count-badge">{{ filtered().length }} bookings</span>
    </div>

    @if (loading()) {
      <div class="load-wrap"><app-spinner size="md" /></div>
    } @else {
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr><th>Reference</th><th>Customer</th><th>Date</th><th>Type</th><th>Amount</th><th>Status</th><th>Payment</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody>
            @if (filtered().length === 0) { <tr><td colspan="9" class="empty-td">No bookings found.</td></tr> }
            @for (b of paged(); track b.id) {
              <tr>
                <td class="mono ref-cell">{{ b.reference_number }}</td>
                <td class="text-sm">
                  <div class="cust-name">{{ b.contact_name || '—' }}</div>
                  @if (b.contact_phone) { <div class="cust-phone">{{ b.contact_phone }}</div> }
                </td>
                <td class="text-sm">{{ b.booking_date | date:'dd MMM yyyy' }}</td>
                <td>
                  <span class="type-chip" [class.home]="b.collection_type === 'home'">
                    {{ b.collection_type === 'home' ? '🏠 Home' : '🏥 Lab' }}
                  </span>
                </td>
                <td class="fw-med">₹{{ (b.total_amount || 0).toLocaleString('en-IN') }}</td>
                <td><app-badge [color]="statusColor(b.status)" size="sm">{{ fmtStatus(b.status) }}</app-badge></td>
                <td><app-badge [color]="payColor(b.payment_status)" size="sm">{{ fmtStatus(b.payment_status) }}</app-badge></td>
                <td class="text-sm text-muted">{{ b.created_at | date:'dd MMM' }}</td>
                <td><button class="manage-btn" (click)="openManage(b)">Manage</button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (totalPages() > 1) {
        <div class="pagination">
          <button class="pg-btn" [disabled]="page() === 1" (click)="page.set(page()-1)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="pg-info">Page {{ page() }} of {{ totalPages() }}</span>
          <button class="pg-btn" [disabled]="page() >= totalPages()" (click)="page.set(page()+1)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      }
    }
  }

  <!-- ═══ BOOKING DETAIL CARD (replaces the drawer) ═══ -->
  @if (selected(); as b) {
    <div class="back-nav">
      <a class="back-link" (click)="closeManage()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Bookings
      </a>
    </div>

    @if (toast()) { <app-alert type="success" [dismissible]="true" (dismissed)="toast.set('')">{{ toast() }}</app-alert> }
    @if (formErr()) { <app-alert type="error" [dismissible]="true" (dismissed)="formErr.set('')">{{ formErr() }}</app-alert> }

    <div class="detail-layout">
      <!-- Header -->
      <div class="header-card">
        <div class="header-left">
          <span class="ref-chip">{{ b.reference_number }}</span>
          <h1 class="booking-title">{{ b.reference_number }}</h1>
          <p class="created-on">{{ b.booking_date | date:'dd MMM yyyy' }} · {{ b.collection_type === 'home' ? 'Home Collection' : 'Lab Visit' }}</p>
        </div>
        <div class="header-right">
          <app-badge [color]="statusColor(b.status)" size="lg">{{ fmtStatus(b.status) }}</app-badge>
        </div>
      </div>

      @if (detailLoading()) {
        <div class="detail-loading"><app-spinner size="sm" /> <span>Loading details…</span></div>
      }

      @if (detail(); as d) {
        <div class="info-grid">
          <!-- Patient & Contact -->
          <div class="info-card">
            <h2 class="card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Patient &amp; Contact
            </h2>
            <div class="info-rows">
              <div class="info-row"><span class="info-label">Patient</span><span class="info-val">{{ d.patient_name || '—' }}<span class="rel" *ngIf="d.patient_relationship"> ({{ d.patient_relationship }})</span></span></div>
              <div class="info-row"><span class="info-label">Booked by</span><span class="info-val">{{ d.contact_name || '—' }}</span></div>
              <div class="info-row"><span class="info-label">Phone</span><span class="info-val">{{ d.contact_phone || '—' }}</span></div>
              <div class="info-row"><span class="info-label">Email</span><span class="info-val">{{ d.contact_email || '—' }}</span></div>
            </div>
          </div>

          <!-- Schedule -->
          <div class="info-card">
            <h2 class="card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Schedule
            </h2>
            <div class="info-rows">
              <div class="info-row"><span class="info-label">Date</span><span class="info-val">{{ b.booking_date | date:'dd MMM yyyy' }}</span></div>
              @if (d.time_slot) { <div class="info-row"><span class="info-label">Time Slot</span><span class="info-val">{{ d.time_slot.start_time }} – {{ d.time_slot.end_time }}</span></div> }
              <div class="info-row"><span class="info-label">Type</span><span class="info-val">{{ b.collection_type === 'home' ? 'Home Collection' : 'Lab Visit' }}</span></div>
              @if (d.lab_branch) { <div class="info-row"><span class="info-label">Lab Branch</span><span class="info-val">{{ d.lab_branch.name }}</span></div> }
            </div>
            @if (d.lab_branch) { <p class="addr-text muted-text">{{ d.lab_branch.address }}, {{ d.lab_branch.city }} - {{ d.lab_branch.pincode }} · ☎ {{ d.lab_branch.phone }}</p> }
          </div>

          <!-- Collection Address (home only) -->
          @if (d.address) {
            <div class="info-card">
              <h2 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                Collection Address
              </h2>
              <p class="addr-text">
                <strong>{{ d.address.label }}</strong><br/>
                {{ d.address.address_line1 }}<span *ngIf="d.address.address_line2">, {{ d.address.address_line2 }}</span><br/>
                {{ d.address.city }}, {{ d.address.state }} - {{ d.address.pincode }}
              </p>
              <a class="maps-link" [href]="mapsUrl(d.address)" target="_blank" rel="noopener">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="3"/><path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z"/></svg>
                View on Google Maps
              </a>
            </div>
          }

          <!-- Payment -->
          @if (d.payment; as pay) {
            <div class="info-card">
              <h2 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                Payment
              </h2>
              <div class="info-rows">
                <div class="info-row"><span class="info-label">Method</span><span class="info-val">{{ fmtStatus(pay.method) }}</span></div>
                <div class="info-row"><span class="info-label">Status</span><app-badge [color]="payColor(pay.status)" size="sm">{{ fmtStatus(pay.status) }}</app-badge></div>
                <div class="info-row"><span class="info-label">Amount</span><span class="info-val">₹{{ (pay.amount || 0).toLocaleString('en-IN') }}</span></div>
                <div class="info-row"><span class="info-label">GST</span><span class="info-val">₹{{ (pay.gst_amount || 0).toLocaleString('en-IN') }}</span></div>
                @if (pay.invoice_number) {
                  <div class="info-row"><span class="info-label">Invoice</span><span class="info-val">{{ pay.invoice_number }}</span></div>
                  <div class="row-actions">
                    <button class="btn-ghost" (click)="viewInvoice(pay.id!)">View Invoice</button>
                    <button class="btn-ghost" (click)="downloadInvoice(pay.id!, pay.invoice_number!)">Download PDF</button>
                  </div>
                }
                @if (pay.notes) { <div class="info-row"><span class="info-label">Notes</span><span class="info-val">{{ pay.notes }}</span></div> }
              </div>

              <!-- Manual adjustments (discounts / extra charges) -->
              <div class="adjustments-block">
                <div class="adj-head">
                  <span class="adj-title">Discounts &amp; Charges</span>
                  @if (pay.status !== 'paid') {
                    <button class="btn-ghost sm" (click)="showAdjForm.set(!showAdjForm())">
                      {{ showAdjForm() ? 'Close' : '+ Add' }}
                    </button>
                  }
                </div>

                @if (adjustments().length) {
                  <div class="adj-list">
                    @for (adj of adjustments(); track adj.id) {
                      <div class="adj-item" [class.charge]="adj.kind === 'charge'">
                        <span class="adj-dot" [class.charge]="adj.kind === 'charge'"></span>
                        <div class="adj-info">
                          <span class="adj-label">{{ adj.label }}</span>
                          <span class="adj-kind">{{ adj.kind === 'discount' ? 'Discount' : 'Extra charge' }}</span>
                        </div>
                        <span class="adj-amount" [class.charge]="adj.kind === 'charge'">
                          {{ adj.kind === 'discount' ? '−' : '+' }}₹{{ adj.amount.toLocaleString('en-IN') }}
                        </span>
                        @if (pay.status !== 'paid') {
                          <button class="btn-x" title="Remove" (click)="removeAdjustment(b, adj.id)">✕</button>
                        }
                      </div>
                    }
                  </div>
                } @else if (!showAdjForm()) {
                  <p class="adj-empty">None. {{ pay.status === 'paid' ? 'Locked — invoice already issued.' : 'Add promotional discounts or extra charges before payment.' }}</p>
                }

                @if (showAdjForm() && pay.status !== 'paid') {
                  <div class="cash-form adj-form">
                    <div class="adj-form-row">
                      <div class="field-group">
                        <label class="field-label" for="adjKind">Type</label>
                        <select id="adjKind" class="field" [(ngModel)]="adjKind">
                          <option value="discount">Discount (reduces total)</option>
                          <option value="charge">Additional charge</option>
                        </select>
                      </div>
                      <div class="field-group amount-group">
                        <label class="field-label" for="adjAmount">Amount (₹)</label>
                        <input id="adjAmount" class="field" type="number" min="0.01" step="0.01" [(ngModel)]="adjAmount" placeholder="0.00" />
                      </div>
                    </div>
                    <div class="field-group">
                      <label class="field-label" for="adjLabel">Label</label>
                      <input id="adjLabel" class="field" type="text" maxlength="120" [(ngModel)]="adjLabel" placeholder="e.g. Festive offer, Service charge" />
                    </div>
                    <div class="row-actions">
                      <button class="btn-ghost" (click)="showAdjForm.set(false)">Cancel</button>
                      <button class="btn-primary" [disabled]="busy() || !adjLabel || !adjAmount" (click)="addAdjustment(b)">
                        {{ busy() ? 'Saving…' : 'Add' }}
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Assigned Technician (home collection only) -->
          @if (b.collection_type === 'home' && d.assigned_technician) {
            <div class="info-card">
              <h2 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>
                Assigned Technician
              </h2>
              <div class="info-rows">
                <div class="info-row"><span class="info-label">Name</span><span class="info-val">{{ d.assigned_technician.name || '—' }}</span></div>
                <div class="info-row"><span class="info-label">Phone</span><span class="info-val">{{ d.assigned_technician.phone || '—' }}</span></div>
                <div class="info-row"><span class="info-label">Response</span><span class="info-val">{{ fmtStatus(d.assigned_technician.assignment_status) }}</span></div>
              </div>
            </div>
          }

          <!-- Refund -->
          @if (d.refund; as rf) {
            <div class="info-card">
              <h2 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                Refund
              </h2>
              <div class="info-rows">
                <div class="info-row"><span class="info-label">Amount</span><span class="info-val">₹{{ (rf.amount || 0).toLocaleString('en-IN') }}</span></div>
                <div class="info-row"><span class="info-label">Status</span><app-badge [color]="refundColor(rf.status)" size="sm">{{ fmtStatus(rf.status) }}</app-badge></div>
                @if (rf.transaction_reference) { <div class="info-row"><span class="info-label">Reference</span><span class="info-val">{{ rf.transaction_reference }}</span></div> }
              </div>
              @if (rf.remarks) {
                <div class="remark-note" [class.error]="isFailureRemark(rf.remarks)">
                  <span class="remark-label">Remarks</span>
                  <p>{{ rf.remarks }}</p>
                </div>
              }

              @if (canRetryRefund(rf)) {
                <div class="inline-action">
                  <button class="btn-ghost" [disabled]="busy()" (click)="retryRefund(rf)">
                    {{ busy() ? 'Retrying…' : '↻ Retry Gateway Refund' }}
                  </button>
                </div>
              }

              @if (refundNextOptions(rf.status).length) {
                <div class="inline-action">
                  @if (!showRefundForm()) {
                    <button class="btn-ghost" (click)="showRefundForm.set(true)">Process Refund</button>
                  } @else {
                    <div class="cash-form">
                      <div class="field-group">
                        <label class="field-label" for="refundStatus">Move to</label>
                        <select id="refundStatus" class="field" [(ngModel)]="refundStatus">
                          @for (opt of refundNextOptions(rf.status); track opt) { <option [value]="opt">{{ fmtStatus(opt) }}</option> }
                        </select>
                      </div>
                      <div class="field-group">
                        <label class="field-label" for="refundTxnRef">Transaction reference <span class="optional">(optional)</span></label>
                        <input id="refundTxnRef" class="field" type="text" [(ngModel)]="refundTxnRef" placeholder="e.g. bank UTR or gateway reference" />
                      </div>
                      <div class="field-group">
                        <label class="field-label" for="refundRemarks">Remarks <span class="optional">(optional)</span></label>
                        <textarea id="refundRemarks" class="field textarea" rows="2" [(ngModel)]="refundRemarks" placeholder="Any context for this status change…"></textarea>
                      </div>
                      <div class="row-actions">
                        <button class="btn-ghost" (click)="showRefundForm.set(false)">Cancel</button>
                        <button class="btn-primary" [disabled]="busy()" (click)="saveRefundStatus(rf)">
                          {{ busy() ? 'Saving…' : 'Update Refund' }}
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Tests / Packages -->
        @if (b.items && b.items.length) {
          <div class="tests-card">
            <h2 class="card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Tests &amp; Packages ({{ b.items.length }})
            </h2>
            <div class="tests-table">
              <div class="tests-header"><span>Item</span><span class="text-right">Price</span></div>
              @for (it of b.items; track it.id) {
                <div class="tests-row">
                  <span class="item-name">{{ it.item_name || it.item_type }}</span>
                  <span class="item-price">₹{{ (it.unit_price || 0).toLocaleString('en-IN') }}</span>
                </div>
              }
              <div class="tests-total"><span>Total</span><span class="total-val">₹{{ (b.total_amount || 0).toLocaleString('en-IN') }}</span></div>
            </div>
          </div>
        }

        <!-- Uploaded Reports -->
        <div class="tests-card">
          <h2 class="card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
            Uploaded Reports ({{ (d.reports || []).length }})
          </h2>
          @if ((d.reports || []).length) {
            <ul class="item-list">
              @for (r of d.reports!; track r.id) {
                <li>
                  <span>{{ r.file_name }} <span class="muted-text">({{ (r.file_size_bytes / 1024 / 1024).toFixed(2) }} MB)</span></span>
                  <span class="item-actions">
                    <button class="btn-link" (click)="previewReport(r)">Preview</button>
                    <button class="btn-link" (click)="downloadReport(r.id)">Download</button>
                  </span>
                </li>
              }
            </ul>
          }
          <div class="upload-row">
            <input #reportFile type="file" accept="application/pdf" class="file-input" (change)="onReportFileChosen($event)" />
            <button class="btn-primary" [disabled]="!pendingReportFile() || uploadingReport()" (click)="uploadReport(b)">
              {{ uploadingReport() ? 'Uploading…' : ((d.reports || []).length ? 'Replace Report' : 'Upload Report') }}
            </button>
          </div>
          <p class="hint">PDF only, up to 20 MB. Uploading a new report replaces the previous one.</p>
        </div>

        <!-- Notes -->
        @if (b.technician_notes) {
          <div class="notes-card">
            <h3>Notes</h3>
            <p>{{ b.technician_notes }}</p>
          </div>
        }
        @if (b.cancellation_reason) {
          <div class="notes-card error">
            <h3>Cancellation Reason</h3>
            <p>{{ b.cancellation_reason }}</p>
          </div>
        }
      }

      <!-- Admin Actions -->
      <div class="tests-card">
        <h2 class="card-title">Admin Actions</h2>

        <div class="action-block">
          <h3 class="action-title">Update Status</h3>
          <div class="row-actions">
            <select class="field" [(ngModel)]="newStatus">
              @for (s of statusOptions; track s) {
                <option [value]="s" [disabled]="s === 'completed' && !canComplete()">
                  {{ fmtStatus(s) }}{{ s === 'completed' && !canComplete() ? ' (report required)' : '' }}
                </option>
              }
            </select>
            <button class="btn-primary" [disabled]="busy() || newStatus === b.status" (click)="saveStatus(b)">
              {{ busy() ? 'Saving…' : 'Update' }}
            </button>
          </div>
        </div>

        @if (b.collection_type === 'home') {
          <div class="action-block">
            <h3 class="action-title">Assign Technician</h3>
            @if (!isPaid()) {
              <p class="hint warning">Payment must be completed online before a technician can be assigned.</p>
            }
            <div class="row-actions">
              <select class="field" [(ngModel)]="selectedTechId" [disabled]="!isPaid()">
                <option value="">Select technician…</option>
                @for (t of technicians(); track t.id) { <option [value]="t.id">{{ t.name }} ({{ t.phone }})</option> }
              </select>
              <button class="btn-primary" [disabled]="busy() || !selectedTechId || !isPaid()" (click)="assignTech(b)">
                {{ busy() ? 'Assigning…' : 'Assign' }}
              </button>
            </div>
            <button class="btn-ghost" [disabled]="busy() || !isPaid()" (click)="autoAssign(b)">⚡ Auto-assign nearest technician</button>
            @if (technicians().length === 0) { <p class="hint">No technicians available. Add one under Technicians.</p> }
          </div>
        }

        @if (b.status !== 'cancelled' && b.status !== 'completed') {
          <div class="action-block cancel-block">
            <h3 class="action-title danger-title">Cancel Booking</h3>
            @if (!showCancel()) {
              <button class="btn-danger-ghost" (click)="showCancel.set(true)">Cancel this booking</button>
            } @else {
              <textarea class="field textarea" [(ngModel)]="cancelReason" rows="3" placeholder="Reason for cancellation (required)…"></textarea>
              <div class="row-actions">
                <button class="btn-ghost" (click)="showCancel.set(false)">Keep booking</button>
                <button class="btn-danger" [disabled]="busy() || !cancelReason.trim()" (click)="cancelBooking(b)">
                  {{ busy() ? 'Cancelling…' : 'Confirm Cancellation' }}
                </button>
              </div>
            }
          </div>
        }
      </div>

      <!-- Lifecycle Timeline -->
      @if (detail()?.status_history?.length) {
        <div class="tests-card">
          <h2 class="card-title">Booking Timeline</h2>
          <ul class="timeline">
            @for (h of detail()!.status_history!; track $index) {
              <li class="tl-item">
                <span class="tl-dot"></span>
                <div class="tl-body">
                  <span class="tl-status">{{ fmtStatus(h.to_status) }}</span>
                  @if (h.changed_at) { <span class="tl-time">{{ h.changed_at | date:'dd MMM yyyy, HH:mm' }}</span> }
                  @if (h.reason) { <span class="tl-reason">{{ h.reason }}</span> }
                </div>
              </li>
            }
          </ul>
        </div>
      }
    </div>
  }
</div>

<!-- ═══ REPORT PREVIEW ═══ -->
<app-modal
  [isOpen]="!!previewReportName()"
  [title]="previewReportName()"
  size="full"
  [showFooter]="false"
  (close)="closePreview()"
>
  @if (previewUrl(); as url) {
    <iframe class="report-frame" [src]="url" title="Report preview"></iframe>
  } @else {
    <div class="preview-loading"><app-spinner /></div>
  }
</app-modal>`,
  styles: [`
    :host {
      --color-primary-50: #EEF4FF;
      --color-primary-100: #D9E5FF;
      --color-primary-500: #0047CC;
      --color-primary-600: #003399;
      --color-primary-700: #002577;
      --color-primary-800: #001B57;
      --color-accent-100: #EEF4FF;
      --color-accent-700: #001B57;
      --shadow-primary: 0 4px 14px 0 rgba(0, 51, 153, 0.28);
      display: block;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .page { display:flex; flex-direction:column; gap:1.25rem; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; }
    .page-title { font-size:1.5rem; font-weight:800; letter-spacing:-0.01em; color:#0F172A; margin:0 0 0.25rem 0; }
    .page-sub { font-size:0.875rem; color:#475569; margin:0; }
    .filter-bar { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
    .search-field { display:flex; align-items:center; gap:0.5rem; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:0.75rem; padding:0.625rem 1rem; flex:1; min-width:200px; svg { width:18px; height:18px; color:#94A3B8; flex-shrink:0; } input { border:none; outline:none; font-size:0.875rem; color:#0F172A; background:transparent; width:100%; } &:focus-within { border-color:#0047CC; box-shadow:0 0 0 3px rgba(0, 71, 204,.12); } }
    .filter-sel { height:40px; padding:0 1rem; font-size:0.875rem; color:#0F172A; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:0.75rem; cursor:pointer; &:focus { outline:none; border-color:#0047CC; } }
    .count-badge { font-size:0.875rem; color:#94A3B8; white-space:nowrap; font-weight:500; }
    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .table-wrap { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; overflow:hidden; overflow-x:auto; }
    .tbl { width:100%; border-collapse:collapse; min-width:780px; thead tr { background:#F8FAFC; } th { padding:0.75rem 1rem; text-align:left; font-size:0.75rem; font-weight:600; color:#94A3B8; text-transform:uppercase; letter-spacing:0.025em; border-bottom:1px solid #F1F5F9; } td { padding:0.875rem 1rem; border-bottom:1px solid #F1F5F9; font-size:0.875rem; color:#0F172A; } tbody tr:last-child td { border-bottom:none; } tbody tr:hover td { background:#F8FAFC; } }
    .ref-cell { font-family:'JetBrains Mono','SF Mono','Fira Code',monospace; font-size:0.75rem; font-weight:600; color:#002577; }
    .cust-name { font-weight:600; color:#0F172A; }
    .cust-phone { font-size:0.75rem; color:#94A3B8; font-family:'JetBrains Mono','SF Mono',monospace; }
    .mono { font-family:'JetBrains Mono','SF Mono','Fira Code',monospace; }
    .fw-med { font-weight:600; }
    .text-sm { font-size:0.875rem; }
    .text-right { text-align:right; }
    .text-muted { color:#94A3B8; }
    .empty-td { text-align:center; color:#94A3B8; padding:3rem !important; }
    .type-chip { font-size:0.75rem; font-weight:500; padding:0.25rem 0.5rem; border-radius:0.5rem; background:#F8FAFC; &.home { background:#EEF4FF; color:#002577; } }
    .manage-btn { font-size:0.8125rem; font-weight:600; color:#002577; background:#EEF4FF; border:1px solid #B3CAFF; border-radius:0.5rem; padding:0.375rem 0.875rem; cursor:pointer; transition:all 150ms; &:hover { background:#B3CAFF; } }
    .pagination { display:flex; align-items:center; justify-content:center; gap:1rem; }
    .pg-btn { display:flex; align-items:center; justify-content:center; width:36px; height:36px; border:1px solid #E2E8F0; border-radius:0.5rem; background:#FFFFFF; cursor:pointer; transition:all 150ms; &:hover:not(:disabled) { border-color:#0A50D8; color:#003399; } &:disabled { opacity:.4; cursor:not-allowed; } }
    .pg-info { font-size:0.875rem; color:#475569; }

    /* Detail card (replaces the old fixed drawer) */
    .back-nav { margin-bottom: -0.5rem; }
    .back-link { display:inline-flex; align-items:center; gap:0.5rem; font-size:0.875rem; font-weight:600; color:#475569; text-decoration:none; cursor:pointer; transition:color 150ms; &:hover { color:#003399; } }
    .detail-layout { display:flex; flex-direction:column; gap:1.25rem; animation: fadeIn .3s ease both; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .header-card { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; background:linear-gradient(145deg,#003399,#0047CC 45%,#003399); border-radius:1.25rem; padding:2rem; color:#FFFFFF; box-shadow:0 12px 30px -8px rgba(0, 37, 119,.35); }
    .ref-chip { display:inline-block; background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.2); border-radius:9999px; padding:0.25rem 0.75rem; font-size:0.75rem; font-family:'JetBrains Mono','SF Mono','Fira Code',monospace; font-weight:600; margin-bottom:0.5rem; }
    .booking-title { font-size:1.5rem; font-weight:800; letter-spacing:-0.01em; margin:0 0 0.25rem 0; color:#FFFFFF; }
    .created-on { font-size:0.875rem; opacity:0.85; margin:0; color:#FFFFFF; }
    .detail-loading { display:flex; align-items:center; gap:0.5rem; font-size:0.8125rem; color:#64748B; padding:0.5rem 0; }
    .info-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1.25rem; }
    .info-card, .tests-card, .notes-card { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1rem; padding:1.5rem; }
    .card-title { display:flex; align-items:center; gap:0.5rem; font-size:1rem; font-weight:700; color:#0F172A; margin:0 0 1rem 0; svg { color:#003399; } }
    .info-rows { display:flex; flex-direction:column; gap:0.75rem; }
    .info-row { display:flex; justify-content:space-between; align-items:center; gap:0.75rem; }
    .info-label { font-size:0.875rem; color:#475569; }
    .info-val { font-size:0.875rem; font-weight:600; color:#0F172A; text-align:right; }
    .info-val .rel { color:#64748B; font-weight:400; }
    .addr-text { font-size:0.8125rem; color:#475569; line-height:1.5; margin:0; }
    .maps-link { display:inline-flex; align-items:center; gap:0.375rem; margin-top:0.75rem; font-size:0.8125rem; font-weight:600; color:#003399; text-decoration:none; &:hover { text-decoration:underline; } }
    .muted-text { color:#94A3B8; }
    .inline-action { margin-top:1rem; padding-top:1rem; border-top:1px solid #F1F5F9; }
    .remark-note { margin-top:0.75rem; padding:0.75rem; border-radius:0.5rem; background:#F8FAFC; border:1px solid #F1F5F9; &.error { background:#FEF2F2; border-color:#FECACA; } }
    .remark-label { display:block; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94A3B8; margin-bottom:0.25rem; }
    .remark-note.error .remark-label { color:#B91C1C; }
    .remark-note p { margin:0; font-size:0.8125rem; line-height:1.5; color:#475569; word-break:break-word; white-space:pre-wrap; }
    .remark-note.error p { color:#991B1B; }

    .tests-table { border:1px solid #F1F5F9; border-radius:0.75rem; overflow:hidden; }
    .tests-header { display:grid; grid-template-columns:1fr auto; gap:1rem; padding:0.75rem 1rem; background:#F8FAFC; font-size:0.75rem; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:0.025em; }
    .tests-row { display:grid; grid-template-columns:1fr auto; gap:1rem; padding:0.75rem 1rem; align-items:center; border-top:1px solid #F1F5F9; }
    .item-name { font-size:0.875rem; font-weight:600; color:#0F172A; }
    .item-price { font-size:0.875rem; font-weight:600; color:#0F172A; text-align:right; }
    .tests-total { display:grid; grid-template-columns:1fr auto; gap:1rem; padding:1rem; background:#EEF4FF; border-top:2px solid #B3CAFF; font-weight:700; color:#0F172A; }
    .total-val { font-size:1.125rem; color:#002577; text-align:right; }

    .item-list { list-style:none; margin:0 0 1rem 0; padding:0; display:flex; flex-direction:column; gap:0.375rem; }
    .item-list li { display:flex; justify-content:space-between; align-items:center; gap:0.75rem; font-size:0.8125rem; color:#475569; padding:0.5rem 0.75rem; background:#F8FAFC; border-radius:0.5rem; }
    .btn-link { background:none; border:none; font-size:0.8125rem; font-weight:600; color:#003399; cursor:pointer; padding:0; &:hover { text-decoration:underline; } }
    .item-actions { display:flex; align-items:center; gap:0.875rem; flex-shrink:0; }
    .report-frame { display:block; width:100%; height:72vh; border:1px solid #E2E8F0; border-radius:0.5rem; background:#F8FAFC; }
    .preview-loading { display:flex; align-items:center; justify-content:center; height:72vh; }
    .upload-row { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
    .file-input { flex:1; min-width:200px; font-size:0.8125rem; }
    .hint { font-size:0.75rem; color:#94A3B8; margin:0.5rem 0 0 0; }
    .hint.warning { color:#001B57; background:#EEF4FF; border:1px solid #B3CAFF; border-radius:0.5rem; padding:0.625rem 0.75rem; margin:0 0 0.75rem 0; }

    .notes-card { padding:1.25rem; h3 { font-size:0.875rem; font-weight:700; margin:0 0 0.5rem 0; } p { font-size:0.875rem; margin:0; line-height:1.625; color:#475569; } &.error { background:#FEF2F2; border-color:#FECACA; h3 { color:#B91C1C; } p { color:#991B1B; } } }

    .action-block { display:flex; flex-direction:column; gap:0.625rem; padding-bottom:1.25rem; margin-bottom:1.25rem; border-bottom:1px solid #F1F5F9; &:last-child { padding-bottom:0; margin-bottom:0; border-bottom:none; } }
    .action-title { font-size:0.875rem; font-weight:600; color:#0F172A; margin:0; }
    .row-actions { display:flex; gap:0.5rem; flex-wrap:wrap; }
    .field { flex:1; min-width:140px; height:40px; padding:0 0.75rem; font-size:0.875rem; color:#0F172A; background:#fff; border:1px solid #E2E8F0; border-radius:0.5rem; font-family:inherit; &:focus { outline:none; border-color:#0047CC; } }
    .textarea { height:auto; padding:0.625rem 0.75rem; width:100%; resize:vertical; }
    .cash-form { display:flex; flex-direction:column; gap:0.75rem; margin-top:0.5rem; padding:0.875rem; background:#F8FAFC; border:1px solid #F1F5F9; border-radius:0.75rem; }
    .field-group { display:flex; flex-direction:column; gap:0.3rem; }
    .field-label { font-size:0.75rem; font-weight:600; color:#475569; }
    .field-label .optional { font-weight:400; color:#94A3B8; }
    .adjustments-block { margin-top:1.25rem; padding-top:1.25rem; border-top:1px solid #F1F5F9; }
    .adj-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; }
    .adj-title { font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94A3B8; }
    .adj-empty { font-size:0.8125rem; color:#94A3B8; margin:0; padding:0.75rem; background:#F8FAFC; border:1px dashed #E2E8F0; border-radius:0.625rem; text-align:center; }
    .adj-list { display:flex; flex-direction:column; gap:0.5rem; margin-bottom:0.25rem; }
    .adj-item { display:flex; align-items:center; gap:0.625rem; padding:0.625rem 0.75rem; background:#F0FDF9; border:1px solid #CCFBF1; border-radius:0.625rem; &.charge { background:#FFF7ED; border-color:#FED7AA; } }
    .adj-dot { width:8px; height:8px; border-radius:50%; background:#00B4AE; flex-shrink:0; &.charge { background:#F59E0B; } }
    .adj-info { display:flex; flex-direction:column; gap:0.05rem; flex:1; min-width:0; }
    .adj-label { font-size:0.8125rem; font-weight:600; color:#0F172A; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .adj-kind { font-size:0.6875rem; color:#64748B; }
    .adj-amount { font-size:0.875rem; font-weight:700; color:#009994; white-space:nowrap; &.charge { color:#C2610A; } }
    .btn-x { display:flex; align-items:center; justify-content:center; width:22px; height:22px; flex-shrink:0; background:none; border:none; border-radius:50%; color:#94A3B8; cursor:pointer; font-size:0.75rem; transition:all 150ms; &:hover { background:#FEE2E2; color:#B91C1C; } }
    .adj-form-row { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; .field { min-width:0; } }
    .btn-primary { height:40px; padding:0 1.25rem; font-size:0.875rem; font-weight:600; color:#fff; background:linear-gradient(135deg,#0047CC,#003399); border:none; border-radius:0.5rem; cursor:pointer; white-space:nowrap; &:disabled { opacity:.5; cursor:not-allowed; } }
    .btn-ghost { align-self:flex-start; font-size:0.8125rem; font-weight:600; color:#003399; background:#EEF4FF; border:1px solid #B3CAFF; border-radius:0.5rem; padding:0.5rem 0.875rem; cursor:pointer; &:disabled { opacity:.5; cursor:not-allowed; } }
    .btn-ghost.sm { padding:0.4rem 0.75rem; font-size:0.75rem; }

    .timeline { list-style:none; margin:0; padding:0.375rem 0 0.25rem; display:flex; align-items:flex-start; overflow-x:auto; }
    .tl-item { display:flex; flex-direction:column; align-items:center; gap:0.5rem; position:relative; flex:1 0 0; min-width:110px; padding:0 0.5rem; text-align:center; }
    .tl-item:not(:last-child)::after { content:''; position:absolute; top:4px; left:50%; width:100%; height:2px; background:#DCE4F5; }
    .tl-dot { width:10px; height:10px; border-radius:50%; background:#0047CC; flex-shrink:0; box-shadow:0 0 0 3px rgba(0, 71, 204,.15); position:relative; z-index:1; }
    .tl-body { display:flex; flex-direction:column; align-items:center; gap:0.125rem; }
    .tl-status { font-size:0.8125rem; font-weight:600; color:#0F172A; }
    .tl-time { font-size:0.6875rem; color:#94A3B8; }
    .tl-reason { font-size:0.75rem; color:#64748B; font-style:italic; }

    .cancel-block { border-top:1px solid #FEE2E2; padding-top:1rem; }
    .danger-title { color:#B91C1C; }
    .btn-danger { height:40px; padding:0 1.25rem; font-size:0.875rem; font-weight:600; color:#fff; background:#DC2626; border:none; border-radius:0.5rem; cursor:pointer; white-space:nowrap; &:disabled { opacity:.5; cursor:not-allowed; } }
    .btn-danger-ghost { align-self:flex-start; font-size:0.8125rem; font-weight:600; color:#DC2626; background:#FEF2F2; border:1px solid #FECACA; border-radius:0.5rem; padding:0.5rem 0.875rem; cursor:pointer; }

    @media (prefers-reduced-motion: reduce) {
      .detail-layout { animation:none; }
    }

    @media (max-width:900px) {
      .info-grid { grid-template-columns:1fr; }
    }
    @media (max-width:640px) {
      .page-header { flex-direction:column; }
      .header-card { flex-direction:column; gap:1rem; }
      .row-actions { flex-direction:column; align-items:stretch; }
      .row-actions .field, .row-actions button { width:100%; }
      .adj-form-row { grid-template-columns:1fr; }
    }
  `]
})
export class AdminBookingsComponent implements OnInit {
  readonly statusOptions = STATUS_OPTIONS;
  loading = signal(false);
  error = signal('');
  toast = signal('');
  formErr = signal('');
  busy = signal(false);
  all = signal<Booking[]>([]);
  filtered = signal<Booking[]>([]);
  technicians = signal<Technician[]>([]);
  selected = signal<Booking | null>(null);
  detail = signal<Booking | null>(null);
  detailLoading = signal(false);
  page = signal(1);
  readonly PS = 25;
  searchQ = ''; statusFilter = ''; typeFilter = '';
  newStatus = ''; selectedTechId = '';
  cancelReason = ''; showCancel = signal(false);

  // Refund status update
  showRefundForm = signal(false);
  refundStatus = '';
  refundTxnRef = '';
  refundRemarks = '';

  // Report upload
  pendingReportFile = signal<File | null>(null);
  uploadingReport = signal(false);

  // Report preview — name drives the modal open state, url arrives async
  previewReportName = signal('');
  previewUrl = signal<SafeResourceUrl | null>(null);

  totalPages = () => Math.ceil(this.filtered().length / this.PS);
  paged = () => { const s = (this.page() - 1) * this.PS; return this.filtered().slice(s, s + this.PS); };
  canComplete = computed(() => (this.detail()?.reports || []).length > 0);
  isPaid = computed(() => this.detail()?.payment?.status === 'paid');

  // Manual adjustments (discounts / extra charges)
  adjustments = signal<BookingAdjustment[]>([]);
  showAdjForm = signal(false);
  adjKind: 'discount' | 'charge' = 'discount';
  adjLabel = '';
  adjAmount: number | null = null;

  constructor(
    private bookingApi: BookingApiService,
    private adminApi: AdminApiService,
    private reportApi: ReportApiService,
    private paymentApi: PaymentApiService,
    private billingApi: BillingApiService,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.load();
    this.adminApi.getTechnicians().subscribe({
      next: (r: any) => this.technicians.set(r.items ?? r ?? []),
      error: () => this.technicians.set([]),
    });

    // Deep-link from the Appointment Calendar: /admin/bookings?id=<bookingId>
    // opens that booking's detail card directly, independent of the list's
    // own pagination/filter state.
    const deepLinkId = this.route.snapshot.queryParamMap.get('id');
    if (deepLinkId) {
      this.bookingApi.get(deepLinkId).subscribe({
        next: (b) => this.openManage(b),
        error: () => this.error.set('Could not find that booking.'),
      });
    }
  }

  load() {
    this.loading.set(true);
    this.bookingApi.list({ page_size: 500 }).subscribe({
      next: r => { this.all.set(r.items); this.applyFilter(); this.loading.set(false); },
      error: () => { this.error.set('Failed to load bookings.'); this.loading.set(false); }
    });
  }

  applyFilter() {
    let list = this.all();
    if (this.statusFilter) list = list.filter(b => b.status === this.statusFilter);
    if (this.typeFilter) list = list.filter(b => b.collection_type === this.typeFilter);
    const q = this.searchQ.toLowerCase();
    if (q) list = list.filter(b =>
      b.reference_number.toLowerCase().includes(q) ||
      (b.contact_name ?? '').toLowerCase().includes(q) ||
      (b.contact_phone ?? '').toLowerCase().includes(q));
    this.filtered.set(list);
    this.page.set(1);
  }

  openManage(b: Booking) {
    this.selected.set(b);
    this.newStatus = b.status;
    this.selectedTechId = '';
    this.cancelReason = '';
    this.showCancel.set(false);
    this.showRefundForm.set(false);
    this.pendingReportFile.set(null);
    this.formErr.set('');
    this.detail.set(null);
    this.detailLoading.set(true);
    this.showAdjForm.set(false);
    this.adjustments.set([]);
    this.bookingApi.get(b.id).subscribe({
      next: (d) => { this.detail.set(d); this.detailLoading.set(false); },
      error: () => { this.detailLoading.set(false); },
    });
    this.billingApi.listAdjustments(b.id).subscribe({
      next: (rows) => this.adjustments.set(rows),
      error: () => this.adjustments.set([]),
    });
  }

  closeManage() {
    this.selected.set(null);
    this.detail.set(null);
    this.showCancel.set(false);
    this.load();
  }

  private refreshDetail(id: string) {
    this.bookingApi.get(id).subscribe({ next: (d) => this.detail.set(d) });
  }

  cancelBooking(b: Booking) {
    if (!this.cancelReason.trim()) { this.formErr.set('Cancellation reason is required.'); return; }
    this.busy.set(true);
    this.formErr.set('');
    this.bookingApi.cancel(b.id, this.cancelReason.trim()).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.selected.set(updated);
        this.toast.set('Booking cancelled.');
        this.showCancel.set(false);
        this.refreshDetail(b.id);
      },
      error: (err) => { this.busy.set(false); this.formErr.set(this.errMsg(err, 'Failed to cancel booking.')); }
    });
  }

  saveStatus(b: Booking) {
    if (this.newStatus === b.status) return;
    this.busy.set(true);
    this.formErr.set('');
    this.bookingApi.updateStatus(b.id, this.newStatus).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.selected.set(updated);
        this.toast.set(`Status updated to "${this.fmtStatus(this.newStatus)}".`);
        this.refreshDetail(b.id);
      },
      error: (err) => { this.busy.set(false); this.formErr.set(this.errMsg(err, 'Failed to update status.')); }
    });
  }

  assignTech(b: Booking) {
    if (!this.selectedTechId) return;
    this.busy.set(true);
    this.formErr.set('');
    this.adminApi.assignTechnician(this.selectedTechId, b.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.set('Technician assigned successfully.');
        this.refreshDetail(b.id);
      },
      error: (err) => { this.busy.set(false); this.formErr.set(this.errMsg(err, 'Failed to assign technician.')); }
    });
  }

  autoAssign(b: Booking) {
    this.busy.set(true);
    this.formErr.set('');
    this.adminApi.autoAssignTechnician(b.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.set('Technician auto-assigned successfully.');
        this.refreshDetail(b.id);
      },
      error: (err) => { this.busy.set(false); this.formErr.set(this.errMsg(err, 'Auto-assign failed. No technician available.')); }
    });
  }

  refundNextOptions(status: string): string[] {
    const m: Record<string, string[]> = { initiated: ['approved', 'failed'], approved: ['completed', 'failed'] };
    return m[status] ?? [];
  }

  /** Retry only makes sense while the refund never reached the gateway. */
  canRetryRefund(rf: { status: string; gateway_refund_id?: string | null }): boolean {
    return (rf.status === 'initiated' || rf.status === 'failed') && !rf.gateway_refund_id;
  }

  retryRefund(rf: { id: string }) {
    this.busy.set(true);
    this.formErr.set('');
    this.paymentApi.retryRefund(rf.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.set('Gateway refund re-initiated.');
        if (this.selected()) this.refreshDetail(this.selected()!.id);
      },
      error: (err) => { this.busy.set(false); this.formErr.set(this.errMsg(err, 'Refund retry failed.')); }
    });
  }

  addAdjustment(b: Booking) {
    if (!this.adjLabel || !this.adjAmount || this.adjAmount <= 0) return;
    this.busy.set(true);
    this.formErr.set('');
    this.billingApi.addAdjustment(b.id, {
      kind: this.adjKind, label: this.adjLabel.trim(), amount: this.adjAmount,
    }).subscribe({
      next: (row) => {
        this.busy.set(false);
        this.adjustments.update(list => [...list, row]);
        this.adjLabel = ''; this.adjAmount = null; this.showAdjForm.set(false);
        this.toast.set('Adjustment added — totals update automatically.');
      },
      error: (err) => { this.busy.set(false); this.formErr.set(this.errMsg(err, 'Failed to add adjustment.')); }
    });
  }

  removeAdjustment(b: Booking, adjustmentId: string) {
    this.busy.set(true);
    this.billingApi.deleteAdjustment(b.id, adjustmentId).subscribe({
      next: () => {
        this.busy.set(false);
        this.adjustments.update(list => list.filter(a => a.id !== adjustmentId));
        this.toast.set('Adjustment removed.');
      },
      error: (err) => { this.busy.set(false); this.formErr.set(this.errMsg(err, 'Failed to remove adjustment.')); }
    });
  }

  viewInvoice(paymentId: string) {
    this.paymentApi.getInvoice(paymentId).subscribe({
      next: (blob) => window.open(URL.createObjectURL(blob), '_blank'),
      error: () => this.formErr.set('Failed to load invoice.'),
    });
  }

  downloadInvoice(paymentId: string, invoiceNumber: string) {
    this.paymentApi.getInvoice(paymentId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${invoiceNumber}.pdf`; a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.formErr.set('Failed to download invoice.'),
    });
  }

  saveRefundStatus(rf: { id: string }) {
    if (!this.refundStatus) return;
    this.busy.set(true);
    this.formErr.set('');
    this.paymentApi.updateRefundStatus(rf.id, {
      status: this.refundStatus as 'approved' | 'completed' | 'failed',
      remarks: this.refundRemarks || undefined,
      transaction_reference: this.refundTxnRef || undefined,
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.showRefundForm.set(false);
        this.toast.set('Refund status updated.');
        if (this.selected()) this.refreshDetail(this.selected()!.id);
      },
      error: (err) => { this.busy.set(false); this.formErr.set(this.errMsg(err, 'Failed to update refund status.')); }
    });
  }

  onReportFileChosen(event: Event) {
    const input = event.target as HTMLInputElement;
    this.pendingReportFile.set(input.files && input.files.length ? input.files[0] : null);
  }

  uploadReport(b: Booking) {
    const file = this.pendingReportFile();
    if (!file) return;
    this.uploadingReport.set(true);
    this.formErr.set('');
    this.reportApi.upload(b.id, file).subscribe({
      next: () => {
        this.uploadingReport.set(false);
        this.pendingReportFile.set(null);
        this.toast.set('Report uploaded successfully.');
        this.refreshDetail(b.id);
      },
      error: (err) => { this.uploadingReport.set(false); this.formErr.set(this.errMsg(err, 'Failed to upload report.')); }
    });
  }

  downloadReport(reportId: string) {
    this.reportApi.getDownloadUrl(reportId).subscribe({
      next: (r) => window.open(r.download_url, '_blank'),
      error: () => this.formErr.set('Failed to generate download link.'),
    });
  }

  previewReport(report: { id: string; file_name: string }) {
    this.previewReportName.set(report.file_name);
    this.previewUrl.set(null);
    // 'inline' so the signed URL serves Content-Disposition: inline and the
    // browser renders the PDF in the frame instead of downloading it.
    this.reportApi.getDownloadUrl(report.id, 'inline').subscribe({
      next: (r) => this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(r.download_url)),
      error: () => {
        this.closePreview();
        this.formErr.set('Failed to load report preview.');
      },
    });
  }

  closePreview() {
    this.previewReportName.set('');
    this.previewUrl.set(null);
  }

  private errMsg(err: any, fallback: string): string {
    const d = err?.error?.detail;
    if (typeof d === 'string') return d;
    if (d?.message) return d.message;
    return fallback;
  }

  mapsUrl(address: { address_line1: string; address_line2?: string; city: string; state: string; pincode: string }): string {
    const parts = [address.address_line1, address.address_line2, address.city, address.state, address.pincode].filter(Boolean);
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
  }

  fmtStatus(s: string) { return fmtStatus(s); }
  statusColor(s: string) { return statusColor(s); }
  payColor(s: string) { const m: Record<string,string> = { paid:'success', pending:'warning', failed:'error', refunded:'info' }; return m[s] ?? 'default'; }
  refundColor(s: string) { const m: Record<string,string> = { initiated:'warning', approved:'info', completed:'success', failed:'error' }; return m[s] ?? 'default'; }
  isFailureRemark(text: string): boolean { return /fail/i.test(text); }
}
