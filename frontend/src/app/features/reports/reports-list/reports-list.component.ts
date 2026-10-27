import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ReportApiService } from '../../../core/api/services/report-api.service';
import { Report } from '../../../core/api/api.types';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorBannerComponent } from '../../../shared/components/error-banner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { PaginationComponent } from '../../../shared/components/pagination.component';
import { HealthImageComponent } from '../../../shared/components/health-image/health-image.component';

@Component({
  selector: 'app-reports-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatIconModule,
    LoadingSpinnerComponent, ErrorBannerComponent, EmptyStateComponent, PaginationComponent,
    HealthImageComponent,
  ],
  template: `
    <div class="rl-page">

      <!-- Hero Header -->
      <div class="rl-hero">
        <div class="rl-hero-inner">
          <div class="rl-hero-icon-wrap">
            <svg class="rl-hero-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="48" height="48" rx="14" fill="rgba(255,255,255,0.18)"/>
              <path d="M14 12C14 10.895 14.895 10 16 10H30L34 14V36C34 37.105 33.105 38 32 38H16C14.895 38 14 37.105 14 36V12Z" fill="white" fill-opacity="0.9"/>
              <path d="M30 10L34 14H31C30.448 14 30 13.552 30 13V10Z" fill="rgba(255,255,255,0.5)"/>
              <rect x="18" y="19" width="12" height="1.5" rx="0.75" fill="#0047CC"/>
              <rect x="18" y="23" width="9" height="1.5" rx="0.75" fill="#0047CC" fill-opacity="0.6"/>
              <rect x="18" y="27" width="10.5" height="1.5" rx="0.75" fill="#0047CC" fill-opacity="0.4"/>
            </svg>
          </div>
          <div class="rl-hero-text">
            <div class="rl-hero-eyebrow">Sri Health Plus</div>
            <h1 class="rl-hero-title">My Health Reports</h1>
            <p class="rl-hero-sub">All your diagnostic results, safely stored and ready to download</p>
          </div>
          <div class="rl-hero-stat" *ngIf="!loading() && !error()">
            <span class="rl-hero-stat-num">{{ total() }}</span>
            <span class="rl-hero-stat-label">{{ total() === 1 ? 'Report' : 'Reports' }}</span>
          </div>
        </div>
        <div class="rl-hero-decor" aria-hidden="true">
          <div class="rl-hero-circle rl-hero-circle-1"></div>
          <div class="rl-hero-circle rl-hero-circle-2"></div>
        </div>
      </div>

      <!-- Search / Sort Bar -->
      <div class="rl-toolbar" *ngIf="!loading() && !error() && reports().length > 0">
        <div class="rl-search-wrap">
          <svg class="rl-search-icon" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="5.5" stroke="#94A3B8" stroke-width="1.5"/>
            <path d="M13.5 13.5L17 17" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <input class="rl-search" type="text" placeholder="Search reports…"
                 aria-label="Search reports"
                 [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event)" />
        </div>
        <button class="rl-filter-btn" (click)="cycleSort()" aria-label="Sort reports"
                [title]="'Sort: ' + sortLabel()">
          <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
            <path d="M4 6h12M6 10h8M8 14h4" stroke="#0047CC" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          {{ sortLabel() }}
        </button>
      </div>

      <!-- Loading Skeletons -->
      <div class="rl-list" *ngIf="loading()">
        <div class="rl-skeleton-card" *ngFor="let i of skeletonRows">
          <div class="rl-sk rl-sk-icon"></div>
          <div class="rl-sk-body">
            <div class="rl-sk rl-sk-title"></div>
            <div class="rl-sk rl-sk-meta"></div>
            <div class="rl-sk rl-sk-meta rl-sk-meta-short"></div>
          </div>
          <div class="rl-sk-actions">
            <div class="rl-sk rl-sk-badge"></div>
            <div class="rl-sk rl-sk-btn"></div>
          </div>
        </div>
      </div>

      <!-- Error -->
      <app-error-banner
        *ngIf="error()"
        [message]="error()!"
        [retryLabel]="'Retry'"
        (retry)="load()"
      />

      <!-- Empty State -->
      <div class="rl-empty" *ngIf="!loading() && !error() && reports().length === 0">
        <app-health-image class="rl-empty-illus" name="empty-reports" [rounded]="false" alt="No reports yet" />
        <h2 class="rl-empty-title">No reports yet</h2>
        <p class="rl-empty-body">Your lab test results will appear here once your tests are processed by our diagnostics team.</p>
        <a href="/bookings/new" class="rl-cta-btn">
          <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
            <path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Book a Test
        </a>
      </div>

      <!-- No search matches -->
      <div class="rl-empty" *ngIf="!loading() && !error() && reports().length > 0 && displayReports().length === 0">
        <h2 class="rl-empty-title">No matching reports</h2>
        <p class="rl-empty-body">No reports match “{{ searchTerm() }}”. Try a different search.</p>
      </div>

      <!-- Reports List -->
      <div class="rl-list" *ngIf="!loading() && !error() && displayReports().length > 0">
        @for (r of displayReports(); track r.id; let idx = $index) {
          <div class="rl-card" [style.animation-delay]="(idx * 60) + 'ms'">
            <!-- Document Icon -->
            <div class="rl-doc-icon-wrap">
              <svg class="rl-doc-svg" viewBox="0 0 44 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="44" height="52" rx="8" fill="#EEF4FF"/>
                <path d="M8 6C8 3.791 9.791 2 12 2H28L38 12V46C38 48.209 36.209 50 34 50H12C9.791 50 8 48.209 8 46V6Z" fill="white"/>
                <path d="M28 2L38 12H30C28.895 12 28 11.105 28 10V2Z" fill="#B3CAFF"/>
                <rect x="13" y="19" width="18" height="2" rx="1" fill="#0047CC" fill-opacity="0.7"/>
                <rect x="13" y="25" width="14" height="2" rx="1" fill="#0047CC" fill-opacity="0.4"/>
                <rect x="13" y="31" width="16" height="2" rx="1" fill="#0047CC" fill-opacity="0.3"/>
                <rect x="13" y="37" width="10" height="2" rx="1" fill="#0047CC" fill-opacity="0.2"/>
              </svg>
              <div class="rl-doc-ext">PDF</div>
            </div>

            <!-- Info -->
            <div class="rl-card-info">
              <div class="rl-card-name" [title]="r.file_name">{{ r.file_name }}</div>
              <div class="rl-card-meta">
                <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
                  <rect x="2" y="3" width="12" height="11" rx="2" stroke="#94A3B8" stroke-width="1.2"/>
                  <path d="M5 2v2M11 2v2M2 7h12" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                {{ r.uploaded_at | date:'dd MMM yyyy' }}
                <span class="rl-dot" aria-hidden="true">·</span>
                <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
                  <circle cx="8" cy="8" r="5.5" stroke="#94A3B8" stroke-width="1.2"/>
                  <path d="M8 5.5V8.5L10 10" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                {{ formatSize(r.file_size_bytes) }}
              </div>
              <div class="rl-card-uploader">
                Uploaded by <span class="rl-uploader-role">{{ r.uploader_role }}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="rl-card-aside">
              <div class="rl-retention-badge">
                <svg viewBox="0 0 14 14" fill="none" width="11" height="11">
                  <circle cx="7" cy="7" r="5.5" stroke="#F59E0B" stroke-width="1.2"/>
                  <path d="M7 4.5V7L8.5 8.5" stroke="#F59E0B" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                Valid until {{ r.retention_until | date:'dd MMM yyyy' }}
              </div>
              <button class="rl-dl-btn" (click)="download(r)" [attr.aria-label]="'Download ' + r.file_name">
                <svg viewBox="0 0 18 18" fill="none" width="15" height="15">
                  <path d="M9 3v9M5.5 8.5L9 12l3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M3 14.5h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                Download
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Pagination -->
      <div class="rl-pagination-wrap" *ngIf="total() > pageSize">
        <app-pagination
          [page]="page()"
          [total]="total()"
          [pageSize]="pageSize"
          (pageChange)="onPageChange($event)"
        />
      </div>

    </div>
  `,
  styles: [`
    /* ── Design tokens ─────────────────────────────────────── */
    :host {
      --c-primary:       #0047CC;
      --c-primary-dk:    #003399;
      --c-primary-lt:    #EEF4FF;
      --c-accent:        #003399;
      --c-accent-dk:     #002577;
      --c-warning:       #F59E0B;
      --c-warning-lt:    #FFFBEB;
      --c-success:       #22C55E;
      --c-error:         #EF4444;
      --c-bg:            #F8F9FF;
      --c-surface:       #FFFFFF;
      --c-text:          #0F172A;
      --c-text-sec:      #475569;
      --c-muted:         #94A3B8;
      --c-border:        #E2E8F0;
      --r-sm:            12px;
      --r-md:            16px;
      --r-lg:            20px;
      --r-pill:          999px;
      --shadow-sm:       0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04);
      --shadow-md:       0 4px 12px rgba(15,23,42,.08), 0 2px 4px rgba(15,23,42,.04);
      --shadow-indigo:   0 4px 20px rgba(0, 71, 204,.22);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      display: block;
      background: var(--c-bg);
    }

    /* ── Page wrapper ───────────────────────────────────────── */
    .rl-page {
      max-width: 860px;
      margin: 0 auto;
      padding: 0 16px 80px;
    }

    /* ── Hero ───────────────────────────────────────────────── */
    .rl-hero {
      position: relative;
      background: linear-gradient(135deg, var(--c-primary-dk) 0%, var(--c-primary) 55%, #0A50D8 100%);
      border-radius: var(--r-lg);
      margin: 20px 0 20px;
      padding: 32px 28px 30px;
      overflow: hidden;
      color: white;
    }

    .rl-hero-inner {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }

    .rl-hero-icon-wrap {
      flex-shrink: 0;
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.15);
      border-radius: var(--r-md);
      backdrop-filter: blur(8px);
    }

    .rl-hero-icon {
      width: 40px;
      height: 40px;
    }

    .rl-hero-text {
      flex: 1;
      min-width: 0;
    }

    .rl-hero-eyebrow {
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.7);
      margin-bottom: 4px;
    }

    .rl-hero-title {
      font-size: clamp(1.35rem, 3vw, 1.75rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 6px;
      text-wrap: balance;
      color: white;
    }

    .rl-hero-sub {
      font-size: 0.875rem;
      color: rgba(255,255,255,0.75);
      margin: 0;
      line-height: 1.5;
    }

    .rl-hero-stat {
      flex-shrink: 0;
      text-align: center;
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(8px);
      border-radius: var(--r-sm);
      padding: 12px 20px;
      min-width: 72px;
    }

    .rl-hero-stat-num {
      display: block;
      font-size: 1.75rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }

    .rl-hero-stat-label {
      display: block;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: rgba(255,255,255,0.7);
      margin-top: 4px;
    }

    /* decorative circles */
    .rl-hero-decor { position: absolute; inset: 0; pointer-events: none; }

    .rl-hero-circle {
      position: absolute;
      border-radius: 50%;
      background: rgba(255,255,255,0.06);
    }

    .rl-hero-circle-1 {
      width: 200px; height: 200px;
      right: -60px; top: -80px;
    }

    .rl-hero-circle-2 {
      width: 130px; height: 130px;
      right: 60px; bottom: -50px;
    }

    /* ── Toolbar ────────────────────────────────────────────── */
    .rl-toolbar {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      align-items: center;
    }

    .rl-search-wrap {
      flex: 1;
      position: relative;
    }

    .rl-search-icon {
      position: absolute;
      left: 13px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      width: 16px;
      height: 16px;
    }

    .rl-search {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 14px 10px 38px;
      font-size: 0.875rem;
      font-family: inherit;
      color: var(--c-text);
      background: var(--c-surface);
      border: 1.5px solid var(--c-border);
      border-radius: var(--r-pill);
      outline: none;
      cursor: not-allowed;
      opacity: 0.7;
      box-shadow: var(--shadow-sm);
    }

    .rl-filter-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 9px 16px;
      font-size: 0.8rem;
      font-weight: 600;
      font-family: inherit;
      color: var(--c-primary);
      background: var(--c-surface);
      border: 1.5px solid var(--c-border);
      border-radius: var(--r-pill);
      cursor: not-allowed;
      opacity: 0.7;
      box-shadow: var(--shadow-sm);
      white-space: nowrap;
    }

    /* ── Report list ────────────────────────────────────────── */
    .rl-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* ── Report card ────────────────────────────────────────── */
    .rl-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px 20px;
      background: var(--c-surface);
      border-radius: var(--r-md);
      border: 1.5px solid var(--c-border);
      box-shadow: var(--shadow-sm);
      transition: box-shadow 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
      animation: rl-fade-up 0.28s both ease-out;
    }

    @keyframes rl-fade-up {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .rl-card:hover {
      border-color: #B3CAFF;
      box-shadow: var(--shadow-md), 0 0 0 3px rgba(0, 71, 204,0.06);
      transform: translateY(-1px);
    }

    /* document icon */
    .rl-doc-icon-wrap {
      position: relative;
      flex-shrink: 0;
      width: 44px;
    }

    .rl-doc-svg {
      width: 44px;
      height: 52px;
      display: block;
    }

    .rl-doc-ext {
      position: absolute;
      bottom: 2px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.55rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: var(--c-primary);
      background: var(--c-primary-lt);
      border-radius: 3px;
      padding: 1px 4px;
      line-height: 1.4;
    }

    /* card info */
    .rl-card-info {
      flex: 1;
      min-width: 0;
    }

    .rl-card-name {
      font-size: 0.925rem;
      font-weight: 700;
      color: var(--c-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 5px;
    }

    .rl-card-meta {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.775rem;
      color: var(--c-muted);
      font-variant-numeric: tabular-nums;
      margin-bottom: 3px;
    }

    .rl-dot {
      color: var(--c-border);
      font-size: 1rem;
      line-height: 1;
    }

    .rl-card-uploader {
      font-size: 0.72rem;
      color: var(--c-muted);
    }

    .rl-uploader-role {
      font-weight: 600;
      color: var(--c-text-sec);
      text-transform: capitalize;
    }

    /* aside */
    .rl-card-aside {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
    }

    .rl-retention-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      color: #92400E;
      background: var(--c-warning-lt);
      border: 1px solid #FDE68A;
      border-radius: var(--r-pill);
      padding: 4px 10px;
      white-space: nowrap;
    }

    .rl-dl-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      font-size: 0.825rem;
      font-weight: 700;
      font-family: inherit;
      color: white;
      background: var(--c-primary);
      border: none;
      border-radius: var(--r-pill);
      cursor: pointer;
      box-shadow: var(--shadow-indigo);
      transition: background 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
      white-space: nowrap;
    }

    .rl-dl-btn:hover {
      background: var(--c-primary-dk);
      box-shadow: 0 6px 24px rgba(0, 71, 204,0.35);
      transform: translateY(-1px);
    }

    .rl-dl-btn:active {
      transform: translateY(0);
      box-shadow: var(--shadow-indigo);
    }

    .rl-dl-btn:focus-visible {
      outline: 3px solid rgba(0, 71, 204,0.4);
      outline-offset: 2px;
    }

    /* ── Skeleton loading ───────────────────────────────────── */
    .rl-skeleton-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px 20px;
      background: var(--c-surface);
      border-radius: var(--r-md);
      border: 1.5px solid var(--c-border);
    }

    .rl-sk {
      background: linear-gradient(90deg, #F1F5F9 25%, #EEF4FF 50%, #F1F5F9 75%);
      background-size: 200% 100%;
      animation: rl-shimmer 1.5s infinite;
      border-radius: 6px;
    }

    @keyframes rl-shimmer {
      from { background-position: 200% center; }
      to   { background-position: -200% center; }
    }

    .rl-sk-icon   { width: 44px; height: 52px; border-radius: 8px; flex-shrink: 0; }
    .rl-sk-body   { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .rl-sk-title  { height: 14px; width: 60%; }
    .rl-sk-meta   { height: 11px; width: 45%; }
    .rl-sk-meta-short { width: 30%; }
    .rl-sk-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; flex-shrink: 0; }
    .rl-sk-badge  { height: 22px; width: 120px; border-radius: var(--r-pill); }
    .rl-sk-btn    { height: 34px; width: 100px; border-radius: var(--r-pill); }

    /* ── Empty state ────────────────────────────────────────── */
    .rl-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 56px 24px 40px;
    }

    .rl-empty-illus {
      width: 120px;
      height: 120px;
      margin-bottom: 24px;
    }

    .rl-empty-illus svg {
      width: 100%;
      height: 100%;
    }

    .rl-empty-title {
      font-size: 1.2rem;
      font-weight: 800;
      color: var(--c-text);
      margin: 0 0 10px;
    }

    .rl-empty-body {
      font-size: 0.875rem;
      color: var(--c-text-sec);
      max-width: 360px;
      line-height: 1.6;
      margin: 0 0 28px;
    }

    .rl-cta-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      font-size: 0.9rem;
      font-weight: 700;
      font-family: inherit;
      color: white;
      background: linear-gradient(135deg, var(--c-accent) 0%, var(--c-accent-dk) 100%);
      border-radius: var(--r-pill);
      text-decoration: none;
      box-shadow: 0 4px 16px rgba(0, 71, 204,0.35);
      transition: box-shadow 0.16s ease, transform 0.16s ease;
    }

    .rl-cta-btn:hover {
      box-shadow: 0 8px 24px rgba(0, 71, 204,0.45);
      transform: translateY(-2px);
    }

    .rl-cta-btn:focus-visible {
      outline: 3px solid rgba(0, 71, 204,0.4);
      outline-offset: 3px;
    }

    /* ── Pagination ─────────────────────────────────────────── */
    .rl-pagination-wrap {
      margin-top: 24px;
      display: flex;
      justify-content: center;
    }

    /* ── Responsive ─────────────────────────────────────────── */
    @media (max-width: 580px) {
      .rl-page { padding: 0 12px 80px; }

      .rl-hero { padding: 24px 18px 22px; border-radius: var(--r-sm); }

      .rl-hero-stat { display: none; }

      .rl-toolbar { flex-wrap: wrap; }

      .rl-filter-btn { display: none; }

      .rl-card {
        flex-wrap: wrap;
        padding: 16px;
        gap: 12px;
      }

      .rl-card-aside {
        width: 100%;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .rl-card, .rl-dl-btn, .rl-cta-btn { transition: none; animation: none; }
      .rl-sk { animation: none; background: #F1F5F9; }
    }
  `],
})
export class ReportsListComponent implements OnInit {
  reports = signal<Report[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  page = signal(1);
  total = signal(0);
  pageSize = 10;

  // Search + sort over the loaded page of reports
  searchTerm = signal('');
  private readonly sortModes = [
    { key: 'date_desc', label: 'Newest' },
    { key: 'date_asc', label: 'Oldest' },
    { key: 'name_asc', label: 'Name A–Z' },
    { key: 'size_desc', label: 'Largest' },
  ] as const;
  sortIndex = signal(0);
  sortLabel = computed(() => this.sortModes[this.sortIndex()].label);

  displayReports = computed<Report[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    let list = this.reports();
    if (term) {
      list = list.filter(r =>
        (r.file_name ?? '').toLowerCase().includes(term) ||
        (r.uploader_role ?? '').toLowerCase().includes(term));
    }
    const mode = this.sortModes[this.sortIndex()].key;
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (mode) {
        case 'date_asc':  return +new Date(a.uploaded_at) - +new Date(b.uploaded_at);
        case 'name_asc':  return (a.file_name ?? '').localeCompare(b.file_name ?? '');
        case 'size_desc': return (b.file_size_bytes ?? 0) - (a.file_size_bytes ?? 0);
        default:          return +new Date(b.uploaded_at) - +new Date(a.uploaded_at);
      }
    });
    return sorted;
  });

  cycleSort(): void {
    this.sortIndex.update(i => (i + 1) % this.sortModes.length);
  }

  /** Drives ngFor for skeleton rows */
  readonly skeletonRows = Array(4).fill(0);

  constructor(private reportApi: ReportApiService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.reportApi.list({ page: this.page(), page_size: this.pageSize }).subscribe({
      next: (res) => {
        this.reports.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load reports. Please check your connection and try again.');
        this.loading.set(false);
      },
    });
  }

  download(report: Report): void {
    this.reportApi.getDownloadUrl(report.id).subscribe({
      next: (res) => window.open(res.download_url, '_blank'),
      error: () => alert('Failed to get download link. Please try again.'),
    });
  }

  onPageChange(p: number): void { this.page.set(p); this.load(); }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
