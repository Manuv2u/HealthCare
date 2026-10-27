import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { LabBranchApiService } from '../../core/api/services/lab-branch-api.service';
import { LabBranch } from '../../core/api/api.types';

@Component({
  selector: 'app-lab-locations',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, RouterLink],
  template: `
    <div class="page">

      <!-- ── Hero ── -->
      <section class="hero">
        <div class="hero-bg-grid"></div>
        <div class="hero-content">
          <div class="pin-wrapper" aria-hidden="true">
            <span class="pin-pulse pulse-1"></span>
            <span class="pin-pulse pulse-2"></span>
            <span class="pin-pulse pulse-3"></span>
            <div class="pin-icon">
              <mat-icon>location_on</mat-icon>
            </div>
          </div>
          <h1 class="hero-title">Find a Lab Near You</h1>
          <p class="hero-subtitle">
            Walk in or book a home collection at any Sri Health Plus branch — results you can trust, closer than you think.
          </p>
          <div class="hero-search">
            <mat-icon class="search-icon">search</mat-icon>
            <input
              class="search-input"
              type="text"
              placeholder="Search by area or pincode…"
              aria-label="Search by area or pincode"
              readonly
            />
            <button class="search-btn" type="button">Search</button>
          </div>
        </div>
      </section>

      <!-- ── Branch Grid ── -->
      <section class="content">

        @if (loading()) {
          <div class="branches-grid">
            @for (sk of skeletons; track $index) {
              <div class="branch-card skeleton-card" aria-hidden="true">
                <div class="sk-icon-wrap sk"></div>
                <div class="sk sk-name"></div>
                <div class="sk sk-line"></div>
                <div class="sk sk-line short"></div>
                <div class="sk sk-badge"></div>
                <div class="sk sk-btn"></div>
              </div>
            }
          </div>
        } @else if (error()) {
          <div class="state-box error-state">
            <div class="state-icon-wrap error">
              <mat-icon>error_outline</mat-icon>
            </div>
            <h3>Something went wrong</h3>
            <p>{{ error() }}</p>
            <button class="retry-btn" (click)="load()">
              <mat-icon>refresh</mat-icon> Try Again
            </button>
          </div>
        } @else if (branches().length === 0) {
          <div class="state-box empty-state">
            <div class="state-icon-wrap empty">
              <mat-icon>location_off</mat-icon>
            </div>
            <h3>No locations found</h3>
            <p>We couldn't find any active lab branches right now. Please check back soon.</p>
          </div>
        } @else {
          <div class="section-header">
            <h2 class="section-title">Our Branches</h2>
            <span class="section-count">{{ branches().length }} location{{ branches().length !== 1 ? 's' : '' }}</span>
          </div>
          <div class="branches-grid">
            @for (branch of branches(); track branch.id) {
              <article class="branch-card">
                <div class="card-top">
                  <div class="branch-icon-circle">
                    <mat-icon>local_hospital</mat-icon>
                  </div>
                  <span class="hours-badge">
                    <mat-icon>schedule</mat-icon>
                    Mon–Sat, 7AM–8PM
                  </span>
                </div>

                <h3 class="branch-name">{{ branch.name }}</h3>

                <div class="branch-details">
                  <div class="detail-row">
                    <mat-icon class="detail-icon">location_on</mat-icon>
                    <span>{{ branch.address }}, {{ branch.pincode }}</span>
                  </div>
                  @if (branch.phone) {
                    <div class="detail-row">
                      <mat-icon class="detail-icon">phone</mat-icon>
                      <a [href]="'tel:' + branch.phone" class="phone-link">{{ branch.phone }}</a>
                    </div>
                  }
                </div>

                <a routerLink="/booking" class="book-branch-btn">
                  <mat-icon>calendar_today</mat-icon>
                  Book at This Branch
                </a>
              </article>
            }
          </div>
        }

      </section>
    </div>
  `,
  styles: [`
    /* ── Tokens ── */
    :host {
      --indigo:        #0047CC;
      --indigo-dark:   #003399;
      --indigo-light:  #EEF4FF;
      --indigo-mid:    #0A50D8;
      --saffron:       #003399;
      --saffron-dark:  #002577;
      --success:       #22C55E;
      --bg:            #F8F9FF;
      --surface:       #FFFFFF;
      --text:          #0F172A;
      --text-sec:      #475569;
      --muted:         #94A3B8;
      --border:        #E2E8F0;
      --radius:        12px;
      --radius-lg:     16px;
      --radius-xl:     20px;
      --radius-pill:   999px;
      --nav-h:         68px;
      --bottom-nav-h:  64px;
      --shadow-sm:     0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04);
      --shadow-md:     0 4px 12px rgba(15,23,42,.08), 0 2px 4px rgba(15,23,42,.04);
      --shadow-lg:     0 10px 30px rgba(15,23,42,.1), 0 4px 8px rgba(15,23,42,.06);
      --shadow-indigo: 0 8px 24px rgba(0, 71, 204,.22);
    }

    /* ── Reset / Base ── */
    * { box-sizing: border-box; }

    .page {
      min-height: 100vh;
      background: var(--bg);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: var(--text);
    }

    /* ── Hero ── */
    .hero {
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(135deg, rgba(35,78,82,.93) 0%, rgba(0,51,153,.88) 45%, rgba(0,71,204,.82) 100%),
        url('/assets/photos/lab-locations.jpg') center / cover no-repeat;
      padding: 4rem 1.5rem 3.5rem;
      text-align: center;
    }

    /* subtle dot-grid overlay */
    .hero-bg-grid {
      position: absolute;
      inset: 0;
      background-image: radial-gradient(circle, rgba(255,255,255,.12) 1px, transparent 1px);
      background-size: 28px 28px;
      pointer-events: none;
    }

    .hero-content {
      position: relative;
      z-index: 1;
      max-width: 640px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.25rem;
    }

    /* ── Animated Pin ── */
    .pin-wrapper {
      position: relative;
      width: 72px;
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pin-pulse {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,.5);
      animation: pulse-ring 2.4s ease-out infinite;
    }
    .pin-pulse.pulse-2 { animation-delay: .8s; }
    .pin-pulse.pulse-3 { animation-delay: 1.6s; }

    @keyframes pulse-ring {
      0%   { transform: scale(.6); opacity: .9; }
      100% { transform: scale(2.2); opacity: 0; }
    }

    .pin-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(255,255,255,.18);
      border: 2px solid rgba(255,255,255,.35);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pin-float 3s ease-in-out infinite;
    }
    .pin-icon mat-icon {
      font-size: 1.6rem;
      width: 1.6rem;
      height: 1.6rem;
      color: #fff;
    }

    @keyframes pin-float {
      0%, 100% { transform: translateY(0); }
      50%       { transform: translateY(-5px); }
    }

    @media (prefers-reduced-motion: reduce) {
      .pin-pulse, .pin-icon { animation: none; }
    }

    .hero-title {
      margin: 0;
      font-size: clamp(1.75rem, 5vw, 2.75rem);
      font-weight: 800;
      color: #fff;
      letter-spacing: -.03em;
      text-wrap: balance;
    }

    .hero-subtitle {
      margin: 0;
      font-size: clamp(.9rem, 2.5vw, 1.05rem);
      color: rgba(255,255,255,.8);
      line-height: 1.65;
      text-wrap: balance;
      max-width: 520px;
    }

    /* ── Search bar ── */
    .hero-search {
      display: flex;
      align-items: center;
      background: #fff;
      border-radius: var(--radius-pill);
      box-shadow: 0 4px 24px rgba(0,0,0,.18);
      padding: .35rem .35rem .35rem 1rem;
      width: 100%;
      max-width: 480px;
      gap: .5rem;
    }
    .search-icon {
      color: var(--muted);
      flex-shrink: 0;
      font-size: 1.25rem;
      width: 1.25rem;
      height: 1.25rem;
    }
    .search-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: .9rem;
      color: var(--text);
      background: transparent;
      font-family: inherit;
      cursor: default;
    }
    .search-input::placeholder { color: var(--muted); }
    .search-btn {
      flex-shrink: 0;
      background: linear-gradient(135deg, var(--indigo), var(--indigo-dark));
      color: #fff;
      border: none;
      border-radius: var(--radius-pill);
      padding: .55rem 1.25rem;
      font-size: .85rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: opacity .15s;
    }
    .search-btn:hover { opacity: .88; }

    /* ── Content area ── */
    .content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2.5rem 1.25rem 4rem;
    }

    .section-header {
      display: flex;
      align-items: baseline;
      gap: .75rem;
      margin-bottom: 1.5rem;
    }
    .section-title {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--text);
    }
    .section-count {
      font-size: .8rem;
      font-weight: 600;
      color: var(--indigo);
      background: var(--indigo-light);
      padding: .2rem .65rem;
      border-radius: var(--radius-pill);
    }

    /* ── Branch Grid ── */
    .branches-grid {
      display: grid;
      gap: 1.25rem;
      grid-template-columns: repeat(3, 1fr);
    }

    @media (max-width: 1024px) {
      .branches-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 600px) {
      .branches-grid { grid-template-columns: 1fr; }
      .content { padding: 2rem 1rem 3rem; }
    }

    /* ── Branch Card ── */
    .branch-card {
      background: var(--surface);
      border-radius: var(--radius-xl);
      border: 1px solid var(--border);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      box-shadow: var(--shadow-sm);
      transition: transform .22s ease, box-shadow .22s ease;
    }
    .branch-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-indigo);
      border-color: rgba(0, 71, 204,.2);
    }

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .branch-icon-circle {
      width: 52px;
      height: 52px;
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, var(--indigo), var(--indigo-dark));
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 71, 204,.3);
      flex-shrink: 0;
    }
    .branch-icon-circle mat-icon {
      font-size: 1.5rem;
      width: 1.5rem;
      height: 1.5rem;
      color: #fff;
    }

    .hours-badge {
      display: inline-flex;
      align-items: center;
      gap: .3rem;
      font-size: .72rem;
      font-weight: 600;
      color: var(--success);
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
      border-radius: var(--radius-pill);
      padding: .25rem .65rem;
    }
    .hours-badge mat-icon {
      font-size: .85rem;
      width: .85rem;
      height: .85rem;
    }

    .branch-name {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text);
      line-height: 1.3;
    }

    .branch-details {
      display: flex;
      flex-direction: column;
      gap: .5rem;
      flex: 1;
    }

    .detail-row {
      display: flex;
      align-items: flex-start;
      gap: .45rem;
      font-size: .83rem;
      color: var(--text-sec);
      line-height: 1.5;
    }
    .detail-icon {
      font-size: .95rem;
      width: .95rem;
      height: .95rem;
      flex-shrink: 0;
      margin-top: .15rem;
      color: var(--indigo);
    }

    .phone-link {
      color: var(--text-sec);
      text-decoration: none;
      transition: color .15s;
    }
    .phone-link:hover { color: var(--saffron); }

    .book-branch-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .45rem;
      margin-top: .25rem;
      padding: .65rem 1.1rem;
      background: linear-gradient(135deg, var(--indigo), var(--indigo-dark));
      color: #fff;
      border-radius: var(--radius);
      font-size: .85rem;
      font-weight: 600;
      font-family: inherit;
      text-decoration: none;
      border: none;
      cursor: pointer;
      transition: opacity .18s, transform .18s;
    }
    .book-branch-btn mat-icon {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
    }
    .book-branch-btn:hover {
      opacity: .9;
      transform: translateY(-1px);
    }
    .book-branch-btn:focus-visible {
      outline: 3px solid var(--indigo-mid);
      outline-offset: 2px;
    }

    /* ── Skeleton Loader ── */
    @keyframes shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position: 600px 0; }
    }

    .sk {
      background: linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%);
      background-size: 600px 100%;
      animation: shimmer 1.4s infinite linear;
      border-radius: 8px;
    }

    .skeleton-card {
      pointer-events: none;
    }

    .sk-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: var(--radius-lg);
    }
    .sk-name {
      height: 18px;
      width: 70%;
      border-radius: 6px;
    }
    .sk-line {
      height: 13px;
      width: 100%;
      border-radius: 6px;
    }
    .sk-line.short { width: 55%; }
    .sk-badge {
      height: 22px;
      width: 120px;
      border-radius: var(--radius-pill);
    }
    .sk-btn {
      height: 38px;
      width: 160px;
      border-radius: var(--radius);
    }

    /* ── State Boxes ── */
    .state-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: .9rem;
      padding: 4rem 1.5rem;
    }
    .state-box h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text);
    }
    .state-box p {
      margin: 0;
      color: var(--text-sec);
      font-size: .9rem;
      max-width: 320px;
    }

    .state-icon-wrap {
      width: 60px;
      height: 60px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .state-icon-wrap.error {
      background: #FEF2F2;
      color: #EF4444;
    }
    .state-icon-wrap.empty {
      background: var(--indigo-light);
      color: var(--indigo);
    }
    .state-icon-wrap mat-icon {
      font-size: 1.75rem;
      width: 1.75rem;
      height: 1.75rem;
    }

    .retry-btn {
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      padding: .6rem 1.25rem;
      border: 2px solid var(--indigo);
      border-radius: var(--radius);
      background: transparent;
      color: var(--indigo);
      font-size: .875rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: background .15s, color .15s;
    }
    .retry-btn mat-icon {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
    }
    .retry-btn:hover {
      background: var(--indigo);
      color: #fff;
    }
    .retry-btn:focus-visible {
      outline: 3px solid var(--indigo-mid);
      outline-offset: 2px;
    }
  `],
})
export class LabLocationsComponent implements OnInit {
  branches = signal<LabBranch[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  readonly skeletons = Array(6).fill(null);

  constructor(private labBranchApi: LabBranchApiService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.labBranchApi.list().subscribe({
      next: (items) => {
        this.branches.set(items.filter((b) => b.is_active));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load lab locations. Please check your connection and try again.');
        this.loading.set(false);
      },
    });
  }
}
