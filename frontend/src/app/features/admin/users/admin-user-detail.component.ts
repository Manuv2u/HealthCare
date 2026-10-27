import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AdminApiService } from '../../../core/api/services/admin-api.service';
import { AdminUserDetail, AdminNote, LoginActivity } from '../../../core/api/api.types';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { todayDateStr } from '../../../core/utils/dob-validator';

type TabId = 'overview' | 'activity' | 'bookings' | 'payments' | 'reports' | 'addresses' | 'family' | 'audit';

@Component({
  selector: 'app-admin-user-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BadgeComponent, SpinnerComponent, AvatarComponent],
  template: `
<div class="page">
  <a routerLink="/admin/users" class="back-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
    Back to users
  </a>

  @if (loading()) {
    <div class="load-wrap"><app-spinner size="md" /></div>
  } @else if (!user()) {
    <div class="state-box"><p>User not found.</p><a routerLink="/admin/users" class="btn">Back</a></div>
  }
  @if (!loading() && user(); as u) {
    <!-- Header card -->
    <div class="hdr-card">
      <div class="hdr-main">
        <div class="hdr-avatar">
          <app-avatar [name]="u.name" [src]="u.avatar_url || undefined" size="2xl" [status]="u.is_online ? 'online' : 'offline'" />
          <label class="avatar-upload" title="Change photo">
            <input type="file" accept="image/*" (change)="onAvatar($event)" hidden />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </label>
        </div>
        <div class="hdr-info">
          <div class="hdr-name-row">
            <h1 class="hdr-name">{{ u.name }}</h1>
            <app-badge [color]="statusColor(u.account_status)" size="sm">{{ u.account_status | titlecase }}</app-badge>
            <app-badge [color]="u.is_online ? 'success' : 'default'" size="sm">{{ u.is_online ? 'Online' : 'Offline' }}</app-badge>
            @if (u.role !== 'user') { <app-badge color="accent" size="sm">{{ u.role | titlecase }}</app-badge> }
          </div>
          <div class="hdr-facts">
            <span class="fact"><span class="f-icon">✉</span>{{ u.email || '—' }} @if (u.email_verified) { <span class="verified">✓</span> }</span>
            <span class="fact"><span class="f-icon">📱</span>{{ u.phone || '—' }} @if (u.phone_verified) { <span class="verified">✓</span> }</span>
            <span class="fact mono">ID {{ u.id.substring(0, 8) }}</span>
            <span class="fact">Joined {{ u.created_at | date:'dd MMM yyyy' }}</span>
          </div>
          @if (u.tags.length) {
            <div class="tag-row">
              @for (t of u.tags; track t) { <span class="tag">{{ t }}</span> }
            </div>
          }
        </div>
      </div>
      <div class="hdr-actions">
        <button class="btn sm" (click)="startEdit()">Edit</button>
        @if (u.account_status === 'blocked') {
          <button class="btn sm success" (click)="unblock()">Unblock</button>
        } @else {
          <button class="btn sm danger" (click)="block()">Block</button>
        }
        <div class="menu-wrap">
          <button class="btn sm ghost" (click)="menuOpen.set(!menuOpen())">More ▾</button>
          @if (menuOpen()) {
            <div class="menu" (click)="menuOpen.set(false)">
              <button (click)="resetPassword()">Reset Password</button>
              @if (!u.email_verified) { <button (click)="verifyEmail()">Verify Email</button> }
              @if (!u.phone_verified) { <button (click)="verifyMobile()">Verify Mobile</button> }
              <button (click)="editTags()">Assign Tags</button>
              <button (click)="sendNotification()">Send Notification</button>
              <button (click)="downloadData()">Download User Data</button>
              <button class="danger" (click)="remove()">Delete User</button>
            </div>
          }
        </div>
      </div>
    </div>

    @if (actionMsg()) { <div class="toast" [class.err]="actionErr()">{{ actionMsg() }}</div> }

    <!-- Edit panel -->
    @if (editing()) {
      <div class="edit-panel">
        <h3>Edit Profile</h3>
        <div class="edit-grid">
          <label>Name<input [(ngModel)]="edit.name" /></label>
          <label>Email<input [(ngModel)]="edit.email" /></label>
          <label>Mobile<input [(ngModel)]="edit.phone" /></label>
          <label>Alternate Mobile<input [(ngModel)]="edit.alternate_phone" /></label>
          <label>Gender
            <select [(ngModel)]="edit.gender">
              <option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </select>
          </label>
          <label>Date of Birth<input type="date" [(ngModel)]="edit.date_of_birth" [max]="maxDob" /></label>
        </div>
        <div class="edit-actions">
          <button class="btn sm ghost" (click)="editing.set(false)">Cancel</button>
          <button class="btn sm primary" [disabled]="saving()" (click)="saveEdit()">Save</button>
        </div>
      </div>
    }

    <!-- Tabs -->
    <div class="tabs">
      @for (t of tabDefs; track t.id) {
        <button class="tab" [class.active]="tab() === t.id" (click)="switchTab(t.id)">{{ t.label }}</button>
      }
    </div>

    <div class="tab-body">
      <!-- OVERVIEW -->
      @if (tab() === 'overview') {
        <div class="grid-2">
          <div class="panel">
            <h3>Personal Information</h3>
            <dl class="dl">
              <div><dt>Full Name</dt><dd>{{ u.name }}</dd></div>
              <div><dt>Gender</dt><dd>{{ u.gender || '—' | titlecase }}</dd></div>
              <div><dt>Date of Birth</dt><dd>{{ u.date_of_birth ? (u.date_of_birth | date:'dd MMM yyyy') : '—' }}</dd></div>
              <div><dt>Age</dt><dd>{{ age(u.date_of_birth) }}</dd></div>
              <div><dt>Email</dt><dd>{{ u.email || '—' }} @if (u.email_verified) { <span class="verified">✓ verified</span> }</dd></div>
              <div><dt>Mobile</dt><dd>{{ u.phone || '—' }} @if (u.phone_verified) { <span class="verified">✓ verified</span> }</dd></div>
              <div><dt>Alternate Mobile</dt><dd>{{ u.alternate_phone || '—' }}</dd></div>
              <div><dt>Preferred Collection</dt><dd>{{ u.preferred_collection_type === 'home' ? 'Home Collection' : u.preferred_collection_type === 'lab' ? 'Lab Visit' : '—' }}</dd></div>
              <div><dt>Health Concerns</dt><dd>{{ u.health_concerns.length ? u.health_concerns.join(', ') : '—' }}</dd></div>
              <div><dt>Account Status</dt><dd>{{ u.account_status | titlecase }}</dd></div>
            </dl>
          </div>
          <div class="panel">
            <h3>Booking Summary</h3>
            <div class="mini-cards">
              <div class="mc"><span class="mc-v">{{ u.aggregates.total_bookings }}</span><span class="mc-l">Total</span></div>
              <div class="mc"><span class="mc-v">{{ u.aggregates.pending_bookings }}</span><span class="mc-l">Pending</span></div>
              <div class="mc"><span class="mc-v">{{ u.aggregates.completed_bookings }}</span><span class="mc-l">Completed</span></div>
              <div class="mc"><span class="mc-v">{{ u.aggregates.cancelled_bookings }}</span><span class="mc-l">Cancelled</span></div>
              <div class="mc"><span class="mc-v">{{ u.aggregates.home_collections }}</span><span class="mc-l">Home</span></div>
              <div class="mc"><span class="mc-v">{{ u.aggregates.lab_visits }}</span><span class="mc-l">Lab</span></div>
              <div class="mc"><span class="mc-v">{{ u.aggregates.total_tests }}</span><span class="mc-l">Tests</span></div>
              <div class="mc"><span class="mc-v">{{ u.aggregates.total_packages }}</span><span class="mc-l">Packages</span></div>
              <div class="mc"><span class="mc-v">₹{{ u.aggregates.total_amount_paid | number:'1.0-0' }}</span><span class="mc-l">Paid</span></div>
              <div class="mc"><span class="mc-v">₹{{ u.aggregates.refund_amount | number:'1.0-0' }}</span><span class="mc-l">Refunded</span></div>
            </div>
          </div>
        </div>
      }

      <!-- ACTIVITY -->
      @if (tab() === 'activity') {
        <div class="grid-2">
          <div class="panel">
            <h3>Login &amp; Activity</h3>
            <dl class="dl">
              <div><dt>Total Logins</dt><dd>{{ u.login_count }}</dd></div>
              <div><dt>First Login</dt><dd>{{ u.first_login_at ? (u.first_login_at | date:'dd MMM yyyy, HH:mm':'Asia/Kolkata') + ' IST' : '—' }}</dd></div>
              <div><dt>Last Login</dt><dd>{{ u.last_login_at ? (u.last_login_at | date:'dd MMM yyyy, HH:mm':'Asia/Kolkata') + ' IST' : '—' }}</dd></div>
              <div><dt>Last Logout</dt><dd>{{ u.last_logout_at ? (u.last_logout_at | date:'dd MMM yyyy, HH:mm':'Asia/Kolkata') + ' IST' : '—' }}</dd></div>
              <div><dt>Last Active</dt><dd>{{ u.last_active_at ? (u.last_active_at | date:'dd MMM yyyy, HH:mm':'Asia/Kolkata') + ' IST' : '—' }}</dd></div>
              <div><dt>Login Attempts (1h)</dt><dd>{{ u.login_attempt_count }}{{ u.role === 'admin' ? ' (no limit)' : ' / 35' }}</dd></div>
              <div><dt>Rate Limited</dt><dd>{{ isRateLimited(u) ? ('Until ' + (u.login_window_expires_at | date:'dd MMM, HH:mm':'Asia/Kolkata') + ' IST') : 'No' }}</dd></div>
            </dl>
            @if (activity()?.ip_history?.length) {
              <h4 class="sub">IP History</h4>
              <div class="ip-list">
                @for (ip of activity()!.ip_history; track ip.ip_address) {
                  <div class="ip-row"><span class="mono">{{ ip.ip_address }}</span><span class="text-muted">{{ ip.count }}× · {{ ip.last_seen | date:'dd MMM, HH:mm':'Asia/Kolkata' }} IST</span></div>
                }
              </div>
            }
          </div>
          <div class="panel">
            <h3>Login Timeline</h3>
            @if (tabLoading()) { <app-spinner size="sm" /> }
            @else if (!activity()?.events?.length) { <p class="empty">No login events recorded yet.</p> }
            @else {
              <div class="timeline">
                @for (e of activity()!.events; track e.id) {
                  <div class="tl-item">
                    <span class="tl-dot" [class.fail]="e.event_type === 'login_failed'" [class.out]="e.event_type === 'logout'"></span>
                    <div class="tl-body">
                      <div class="tl-top">{{ eventLabel(e.event_type) }}<span class="tl-time">{{ e.created_at | date:'dd MMM yyyy, HH:mm':'Asia/Kolkata' }} IST</span></div>
                      <div class="tl-meta">{{ deviceLine(e) }} @if (e.ip_address) { · {{ e.ip_address }} }</div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- BOOKINGS -->
      @if (tab() === 'bookings') {
        @if (tabLoading()) { <app-spinner size="md" /> }
        @else if (!bookings().length) { <p class="empty">No bookings.</p> }
        @else {
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Booking</th><th>Date</th><th>Status</th><th>Payment</th><th>Collection</th><th>Technician</th><th class="num">Amount</th><th>Report</th></tr></thead>
            <tbody>
              @for (b of bookings(); track b.id) {
                <tr>
                  <td class="mono">{{ b.reference_number }}</td>
                  <td class="text-sm">{{ b.booking_date | date:'dd MMM yyyy' }}</td>
                  <td><app-badge [color]="bookingStatusColor(b.status)" size="sm">{{ b.status | titlecase }}</app-badge></td>
                  <td><app-badge [color]="b.payment?.status === 'paid' ? 'success' : 'warning'" size="sm">{{ b.payment?.status || b.payment_status | titlecase }}</app-badge></td>
                  <td class="text-sm">{{ b.collection_type === 'home' ? 'Home' : 'Lab' }}</td>
                  <td class="text-sm">{{ b.assigned_technician?.name || '—' }}</td>
                  <td class="num">₹{{ (b.payment?.amount ?? b.total_amount) | number:'1.0-0' }}</td>
                  <td>
                    @if (b.reports?.length) {
                      <a class="link" [routerLink]="['/admin/bookings']" [queryParams]="{ ref: b.reference_number }">View</a>
                    } @else { <span class="text-muted">—</span> }
                  </td>
                </tr>
              }
            </tbody>
          </table></div>
        }
      }

      <!-- PAYMENTS -->
      @if (tab() === 'payments') {
        @if (tabLoading()) { <app-spinner size="md" /> }
        @else if (!payments().length) { <p class="empty">No payments.</p> }
        @else {
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Date</th><th>Booking</th><th>Method</th><th>Invoice</th><th>Status</th><th class="num">Amount</th><th class="num">Refund</th></tr></thead>
            <tbody>
              @for (p of payments(); track p.id) {
                <tr>
                  <td class="text-sm">{{ (p.paid_at || p.created_at) | date:'dd MMM yyyy' }}</td>
                  <td class="mono">{{ p.booking_reference }}</td>
                  <td class="text-sm">{{ p.method | titlecase }}</td>
                  <td class="mono text-2xs">{{ p.invoice_number || '—' }}</td>
                  <td><app-badge [color]="p.status === 'paid' ? 'success' : 'warning'" size="sm">{{ p.status | titlecase }}</app-badge></td>
                  <td class="num">₹{{ p.amount | number:'1.2-2' }}</td>
                  <td class="num">{{ p.refund_amount ? ('₹' + (p.refund_amount | number:'1.0-0')) : '—' }}</td>
                </tr>
              }
            </tbody>
          </table></div>
        }
      }

      <!-- REPORTS -->
      @if (tab() === 'reports') {
        @if (tabLoading()) { <app-spinner size="md" /> }
        @else if (!reports().length) { <p class="empty">No reports uploaded.</p> }
        @else {
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Report</th><th>Booking</th><th>Uploaded By</th><th>Uploaded</th><th>Actions</th></tr></thead>
            <tbody>
              @for (r of reports(); track r.id) {
                <tr>
                  <td>{{ r.file_name }}</td>
                  <td class="mono">{{ r.booking_reference }}</td>
                  <td class="text-sm">{{ r.uploader_role | titlecase }}</td>
                  <td class="text-sm">{{ r.uploaded_at | date:'dd MMM yyyy, HH:mm' }}</td>
                  <td><a class="link" [href]="r.download_url" target="_blank" rel="noopener">Download</a></td>
                </tr>
              }
            </tbody>
          </table></div>
        }
      }

      <!-- ADDRESSES -->
      @if (tab() === 'addresses') {
        @if (tabLoading()) { <app-spinner size="md" /> }
        @else if (!addresses().length) { <p class="empty">No saved addresses.</p> }
        @else {
          <div class="addr-grid">
            @for (a of addresses(); track a.id) {
              <div class="addr-card">
                <div class="addr-head"><span class="addr-label">{{ a.label }}</span>@if (a.is_default) { <app-badge color="primary" size="sm">Default</app-badge> }</div>
                <p class="addr-text">{{ a.address_line1 }}@if (a.address_line2) {, {{ a.address_line2 }}}</p>
                <p class="addr-text text-muted">{{ a.city }}, {{ a.state }} — {{ a.pincode }}</p>
              </div>
            }
          </div>
        }
      }

      <!-- FAMILY -->
      @if (tab() === 'family') {
        @if (tabLoading()) { <app-spinner size="md" /> }
        @else if (!family().length) { <p class="empty">No family members.</p> }
        @else {
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Name</th><th>Relationship</th><th>Gender</th><th>Date of Birth</th></tr></thead>
            <tbody>
              @for (m of family(); track m.id) {
                <tr><td>{{ m.name }}</td><td class="text-sm">{{ m.relationship | titlecase }}</td><td class="text-sm">{{ m.gender || '—' | titlecase }}</td><td class="text-sm">{{ m.date_of_birth ? (m.date_of_birth | date:'dd MMM yyyy') : '—' }}</td></tr>
              }
            </tbody>
          </table></div>
        }
      }

      <!-- AUDIT & NOTES -->
      @if (tab() === 'audit') {
        <div class="grid-2">
          <div class="panel">
            <h3>Admin Notes</h3>
            <div class="note-form">
              <textarea rows="2" placeholder="Add an internal note…" [(ngModel)]="newNote"></textarea>
              <button class="btn sm primary" [disabled]="!newNote.trim()" (click)="addNote()">Add Note</button>
            </div>
            @if (tabLoading()) { <app-spinner size="sm" /> }
            @else if (!notes().length) { <p class="empty">No notes yet.</p> }
            @else {
              <div class="notes">
                @for (n of notes(); track n.id) {
                  <div class="note"><p>{{ n.note }}</p><span class="note-meta">{{ n.author_name || 'Admin' }} · {{ n.created_at | date:'dd MMM yyyy, HH:mm' }}</span></div>
                }
              </div>
            }
          </div>
          <div class="panel">
            <h3>Activity Timeline</h3>
            @if (!audit().length) { <p class="empty">No audit entries.</p> }
            @else {
              <div class="timeline">
                @for (a of audit(); track a.id) {
                  <div class="tl-item">
                    <span class="tl-dot" [class.fail]="a.outcome !== 'success'"></span>
                    <div class="tl-body">
                      <div class="tl-top">{{ actionLabel(a.action_type) }}<span class="tl-time">{{ a.created_at | date:'dd MMM, HH:mm':'Asia/Kolkata' }} IST</span></div>
                      <div class="tl-meta">{{ a.actor_role | titlecase }} · {{ a.entity_type }}</div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  }
</div>`,
  styles: [`
    .page { display:flex; flex-direction:column; gap:1.25rem; }
    .back-link { display:inline-flex; align-items:center; gap:0.35rem; font-size:0.85rem; color:#475569; text-decoration:none; font-weight:500; svg { width:16px; height:16px; } &:hover { color:#0047CC; } }
    .load-wrap { display:flex; justify-content:center; padding:3rem; }
    .state-box { text-align:center; padding:2rem; background:#FFF; border:1px solid #F1F5F9; border-radius:1rem; }
    .hdr-card { background:#FFFFFF; border:1px solid #F1F5F9; border-radius:1.25rem; padding:1.5rem; display:flex; justify-content:space-between; gap:1.5rem; flex-wrap:wrap; }
    .hdr-main { display:flex; gap:1.25rem; align-items:flex-start; }
    .hdr-avatar { position:relative; }
    .avatar-upload { position:absolute; bottom:0; right:0; width:28px; height:28px; background:#0047CC; border:2px solid #FFF; border-radius:999px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#FFF; svg { width:14px; height:14px; } }
    .hdr-name-row { display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; }
    .hdr-name { font-size:1.4rem; font-weight:700; color:#0F172A; margin:0; }
    .hdr-facts { display:flex; gap:1rem; flex-wrap:wrap; margin-top:0.6rem; }
    .fact { font-size:0.82rem; color:#475569; display:inline-flex; align-items:center; gap:0.3rem; }
    .f-icon { opacity:0.6; }
    .verified { color:#059669; font-weight:600; font-size:0.75rem; }
    .mono { font-family:'JetBrains Mono','SF Mono',monospace; }
    .tag-row { display:flex; gap:0.4rem; margin-top:0.6rem; flex-wrap:wrap; }
    .tag { background:#EEF4FF; color:#002577; padding:0.15rem 0.6rem; border-radius:999px; font-size:0.75rem; font-weight:500; }
    .hdr-actions { display:flex; gap:0.5rem; align-items:flex-start; flex-wrap:wrap; }
    .btn { display:inline-flex; align-items:center; gap:0.3rem; height:38px; padding:0 1rem; font-size:0.85rem; font-weight:600; color:#0F172A; background:#FFF; border:1px solid #E2E8F0; border-radius:0.6rem; cursor:pointer; text-decoration:none; &:hover { border-color:#0047CC; } &.sm { height:34px; font-size:0.8rem; } &.primary { background:#0047CC; border-color:#0047CC; color:#FFF; } &.ghost { color:#475569; } &.danger { color:#DC2626; } &.danger:hover { border-color:#FCA5A5; background:#FEF2F2; } &.success { color:#059669; } &.success:hover { border-color:#68D391; background:#F0FFF4; } &:disabled { opacity:.5; cursor:not-allowed; } }
    .menu-wrap { position:relative; }
    .menu { position:absolute; right:0; top:calc(100% + 4px); background:#FFF; border:1px solid #E2E8F0; border-radius:0.6rem; box-shadow:0 8px 24px rgba(0,0,0,.1); z-index:20; min-width:190px; padding:0.35rem; display:flex; flex-direction:column; button { text-align:left; padding:0.55rem 0.75rem; border:none; background:none; font-size:0.83rem; color:#0F172A; border-radius:0.4rem; cursor:pointer; &:hover { background:#F1F5F9; } &.danger { color:#DC2626; } } }
    .toast { background:#003399; color:#FFF; padding:0.6rem 1rem; border-radius:0.6rem; font-size:0.85rem; &.err { background:#DC2626; } }
    .edit-panel { background:#FFF; border:1px solid #F1F5F9; border-radius:1rem; padding:1.25rem; h3 { margin:0 0 1rem 0; font-size:1rem; } }
    .edit-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:0.85rem; label { display:flex; flex-direction:column; gap:0.3rem; font-size:0.78rem; color:#64748B; font-weight:600; input, select { height:36px; padding:0 0.6rem; border:1px solid #E2E8F0; border-radius:0.5rem; font-size:0.85rem; color:#0F172A; outline:none; &:focus { border-color:#0047CC; } } } }
    .edit-actions { display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem; }
    .tabs { display:flex; gap:0.25rem; border-bottom:1px solid #E2E8F0; overflow-x:auto; }
    .tab { padding:0.7rem 1.1rem; font-size:0.85rem; font-weight:600; color:#64748B; background:none; border:none; border-bottom:2px solid transparent; cursor:pointer; white-space:nowrap; &:hover { color:#0F172A; } &.active { color:#003399; border-bottom-color:#0047CC; } }
    .tab-body { min-height:200px; }
    .grid-2 { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem; }
    .panel { background:#FFF; border:1px solid #F1F5F9; border-radius:1rem; padding:1.25rem; h3 { margin:0 0 1rem 0; font-size:1rem; color:#0F172A; } h4.sub { font-size:0.8rem; color:#64748B; margin:1.25rem 0 0.5rem; text-transform:uppercase; letter-spacing:0.03em; } }
    .dl { display:flex; flex-direction:column; gap:0; div { display:flex; justify-content:space-between; gap:1rem; padding:0.5rem 0; border-bottom:1px solid #F8FAFC; } dt { font-size:0.82rem; color:#64748B; } dd { font-size:0.85rem; color:#0F172A; margin:0; text-align:right; font-weight:500; } }
    .mini-cards { display:grid; grid-template-columns:repeat(auto-fill, minmax(90px, 1fr)); gap:0.6rem; }
    .mc { background:#F8FAFC; border-radius:0.6rem; padding:0.7rem; display:flex; flex-direction:column; gap:0.2rem; text-align:center; }
    .mc-v { font-size:1.1rem; font-weight:700; color:#0F172A; } .mc-l { font-size:0.7rem; color:#94A3B8; text-transform:uppercase; }
    .table-wrap { background:#FFF; border:1px solid #F1F5F9; border-radius:1rem; overflow-x:auto; }
    .tbl { width:100%; border-collapse:collapse; min-width:640px; }
    .tbl th { padding:0.7rem 1rem; text-align:left; font-size:0.72rem; font-weight:600; color:#94A3B8; text-transform:uppercase; border-bottom:1px solid #F1F5F9; white-space:nowrap; }
    .tbl td { padding:0.7rem 1rem; border-bottom:1px solid #F1F5F9; font-size:0.85rem; color:#0F172A; white-space:nowrap; }
    .tbl tbody tr:last-child td { border-bottom:none; }
    .num { text-align:right; }
    .text-sm { font-size:0.82rem; } .text-2xs { font-size:0.7rem; } .text-muted { color:#94A3B8; }
    .link { color:#003399; font-weight:600; text-decoration:none; &:hover { text-decoration:underline; } }
    .empty { color:#94A3B8; font-size:0.88rem; padding:1.5rem 0; text-align:center; }
    .timeline { display:flex; flex-direction:column; }
    .tl-item { display:flex; gap:0.75rem; padding:0.5rem 0; }
    .tl-dot { width:10px; height:10px; border-radius:999px; background:#0047CC; margin-top:5px; flex-shrink:0; &.fail { background:#DC2626; } &.out { background:#94A3B8; } }
    .tl-body { flex:1; } .tl-top { display:flex; justify-content:space-between; gap:1rem; font-size:0.85rem; font-weight:600; color:#0F172A; } .tl-time { font-weight:400; color:#94A3B8; font-size:0.78rem; } .tl-meta { font-size:0.76rem; color:#94A3B8; }
    .ip-list { display:flex; flex-direction:column; gap:0.4rem; } .ip-row { display:flex; justify-content:space-between; font-size:0.8rem; }
    .addr-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:1rem; }
    .addr-card { background:#FFF; border:1px solid #F1F5F9; border-radius:0.875rem; padding:1rem; } .addr-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; } .addr-label { font-weight:600; font-size:0.9rem; } .addr-text { margin:0.15rem 0; font-size:0.83rem; color:#334155; }
    .note-form { display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem; textarea { border:1px solid #E2E8F0; border-radius:0.5rem; padding:0.6rem; font-size:0.85rem; resize:vertical; outline:none; &:focus { border-color:#0047CC; } } button { align-self:flex-end; } }
    .notes { display:flex; flex-direction:column; gap:0.65rem; } .note { background:#F8FAFC; border-radius:0.6rem; padding:0.75rem; p { margin:0 0 0.35rem; font-size:0.85rem; color:#0F172A; } .note-meta { font-size:0.72rem; color:#94A3B8; } }
  `],
})
export class AdminUserDetailComponent implements OnInit {
  private api = inject(AdminApiService);
  private confirm = inject(ConfirmDialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tabDefs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Login & Activity' },
    { id: 'bookings', label: 'Bookings' },
    { id: 'payments', label: 'Payments' },
    { id: 'reports', label: 'Reports' },
    { id: 'addresses', label: 'Addresses' },
    { id: 'family', label: 'Family' },
    { id: 'audit', label: 'Audit & Notes' },
  ];

  userId = '';
  loading = signal(true);
  user = signal<AdminUserDetail | null>(null);
  tab = signal<TabId>('overview');
  tabLoading = signal(false);
  menuOpen = signal(false);
  editing = signal(false);
  saving = signal(false);
  actionMsg = signal<string | null>(null);
  actionErr = signal(false);

  activity = signal<LoginActivity | null>(null);
  bookings = signal<any[]>([]);
  payments = signal<any[]>([]);
  reports = signal<any[]>([]);
  addresses = signal<any[]>([]);
  family = signal<any[]>([]);
  notes = signal<AdminNote[]>([]);
  audit = signal<any[]>([]);
  private loaded = new Set<TabId>();

  edit: any = {};
  maxDob = todayDateStr();
  newNote = '';

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id')!;
    this.loadUser();
  }

  loadUser(): void {
    this.loading.set(true);
    this.api.getUser(this.userId).subscribe({
      next: (u) => { this.user.set(u); this.loading.set(false); },
      error: () => { this.user.set(null); this.loading.set(false); },
    });
  }

  switchTab(t: TabId): void {
    this.tab.set(t);
    if (this.loaded.has(t) || t === 'overview') return;
    this.loaded.add(t);
    this.tabLoading.set(true);
    const done = () => this.tabLoading.set(false);
    switch (t) {
      case 'activity':
        this.api.getUserLoginActivity(this.userId).subscribe({ next: (r) => { this.activity.set(r); done(); }, error: done });
        this.api.getUserAuditLogs(this.userId).subscribe({ next: (r) => this.audit.set(r.items || []) });
        break;
      case 'bookings': this.api.getUserBookings(this.userId).subscribe({ next: (r) => { this.bookings.set(r.items); done(); }, error: done }); break;
      case 'payments': this.api.getUserPayments(this.userId).subscribe({ next: (r) => { this.payments.set(r.items); done(); }, error: done }); break;
      case 'reports': this.api.getUserReports(this.userId).subscribe({ next: (r) => { this.reports.set(r.items); done(); }, error: done }); break;
      case 'addresses': this.api.getUserAddresses(this.userId).subscribe({ next: (r) => { this.addresses.set(r); done(); }, error: done }); break;
      case 'family': this.api.getUserFamily(this.userId).subscribe({ next: (r) => { this.family.set(r); done(); }, error: done }); break;
      case 'audit':
        this.api.getUserNotes(this.userId).subscribe({ next: (r) => { this.notes.set(r); done(); }, error: done });
        this.api.getUserAuditLogs(this.userId).subscribe({ next: (r) => this.audit.set(r.items || []) });
        break;
    }
  }

  private flash(msg: string, err = false): void {
    this.actionMsg.set(msg); this.actionErr.set(err);
    setTimeout(() => this.actionMsg.set(null), 3500);
  }

  startEdit(): void {
    const u = this.user()!;
    this.edit = { name: u.name, email: u.email, phone: u.phone, alternate_phone: u.alternate_phone, gender: u.gender, date_of_birth: u.date_of_birth };
    this.editing.set(true);
  }
  saveEdit(): void {
    this.saving.set(true);
    this.api.updateUser(this.userId, this.edit).subscribe({
      next: () => { this.saving.set(false); this.editing.set(false); this.flash('Profile updated'); this.loadUser(); },
      error: (e) => { this.saving.set(false); this.flash(e?.error?.detail?.message || 'Update failed', true); },
    });
  }

  onAvatar(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.uploadUserAvatar(this.userId, file).subscribe({
      next: (r) => { this.user.set({ ...this.user()!, avatar_url: r.avatar_url }); this.flash('Photo updated'); },
      error: () => this.flash('Upload failed', true),
    });
  }

  block(): void {
    const reason = prompt('Reason for blocking (optional):') ?? undefined;
    this.api.blockUser(this.userId, reason).subscribe({ next: () => { this.user.set({ ...this.user()!, account_status: 'blocked', is_active: false }); this.flash('User blocked'); } });
  }
  unblock(): void { this.api.unblockUser(this.userId).subscribe({ next: () => { this.user.set({ ...this.user()!, account_status: 'active', is_active: true }); this.flash('User unblocked'); } }); }
  resetPassword(): void { this.api.resetUserPassword(this.userId).subscribe({ next: () => this.flash('Password reset link sent'), error: (e) => this.flash(e?.error?.detail?.message || 'Failed', true) }); }
  verifyEmail(): void { this.api.verifyUserEmail(this.userId).subscribe({ next: () => { this.user.set({ ...this.user()!, email_verified: true }); this.flash('Email verified'); } }); }
  verifyMobile(): void { this.api.verifyUserMobile(this.userId).subscribe({ next: () => { this.user.set({ ...this.user()!, phone_verified: true }); this.flash('Mobile verified'); } }); }
  editTags(): void {
    const cur = this.user()!.tags.join(', ');
    const input = prompt('Tags (comma separated):', cur);
    if (input === null) return;
    const tags = input.split(',').map((t) => t.trim()).filter(Boolean);
    this.api.setUserTags(this.userId, tags).subscribe({ next: () => { this.user.set({ ...this.user()!, tags }); this.flash('Tags updated'); } });
  }
  sendNotification(): void {
    const event = prompt('Notification event type (e.g. report_ready):', 'general_update');
    if (!event) return;
    this.api.notifyUser(this.userId, event, ['sms', 'email']).subscribe({ next: () => this.flash('Notification queued'), error: () => this.flash('Failed', true) });
  }
  downloadData(): void {
    this.api.exportUserData(this.userId).subscribe({ next: (blob) => {
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `user_${this.userId}.json`; a.click(); URL.revokeObjectURL(url);
    } });
  }
  async remove(): Promise<void> {
    const ok = await this.confirm.askDelete(this.user()!.name, 'This soft-deletes the account and revokes access.');
    if (!ok) return;
    this.api.deleteUser(this.userId).subscribe({ next: () => this.router.navigate(['/admin/users']) });
  }
  addNote(): void {
    const text = this.newNote.trim();
    if (!text) return;
    this.api.addUserNote(this.userId, text).subscribe({ next: (n) => { this.notes.set([n, ...this.notes()]); this.newNote = ''; } });
  }

  age(dob?: string | null): string {
    if (!dob) return '—';
    const d = new Date(dob); const diff = Date.now() - d.getTime();
    return String(Math.abs(new Date(diff).getUTCFullYear() - 1970)) + ' yrs';
  }
  statusColor(s: string): string { return s === 'active' ? 'success' : s === 'blocked' ? 'error' : 'warning'; }
  bookingStatusColor(s: string): string {
    if (['completed', 'report_ready'].includes(s)) return 'success';
    if (s === 'cancelled') return 'error';
    return 'info';
  }
  eventLabel(t: string): string { return t === 'login_success' ? 'Signed in' : t === 'login_failed' ? 'Failed login' : 'Signed out'; }
  deviceLine(e: { browser?: string | null; os?: string | null; device_type?: string | null }): string {
    const parts = [e.browser, e.os, e.device_type].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Unknown device';
  }
  actionLabel(a: string): string { return a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
  isRateLimited(u: AdminUserDetail): boolean {
    return u.login_attempt_count >= 35 && !!u.login_window_expires_at && new Date(u.login_window_expires_at) > new Date();
  }
}
