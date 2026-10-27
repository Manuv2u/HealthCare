import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PackageApiService } from '../../../core/api/services/package-api.service';
import { HealthConcernApiService } from '../../../core/api/services/health-concern-api.service';
import { BannerApiService } from '../../../core/api/services/banner-api.service';
import { Banner, HealthConcern, Package, Test } from '../../../core/api/api.types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { SearchInputComponent } from '../../../shared/components/search-input/search-input.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { HealthImageComponent } from '../../../shared/components/health-image/health-image.component';
import { PackageCardComponent } from './package-card/package-card.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { SeoService } from '../../../core/services/seo.service';
import { buildBreadcrumbSchema } from '../../../core/seo/schema.util';

// Per-category theming for test icons in the details modal.
// Colors resolve through the app's primary-blue token ramp, not raw hex.
const CATEGORY_META: Record<string, { icon: string; color: string; light: string }> = {
  'Diabetes':       { icon: 'water_drop',        color: 'var(--color-primary-600)', light: 'var(--color-primary-50)' },
  'Heart':          { icon: 'favorite',          color: 'var(--color-primary-800)', light: 'var(--color-primary-50)' },
  'Kidney':         { icon: 'opacity',           color: 'var(--color-primary-600)', light: 'var(--color-primary-100)' },
  'Liver':          { icon: 'eco',               color: 'var(--color-primary-800)', light: 'var(--color-primary-50)' },
  'Thyroid':        { icon: 'psychology',        color: 'var(--color-primary-800)', light: 'var(--color-primary-50)' },
  'Full Body':      { icon: 'accessibility_new', color: 'var(--color-primary-600)', light: 'var(--color-primary-50)' },
  "Women's Health": { icon: 'spa',               color: 'var(--color-primary-600)', light: 'var(--color-primary-50)' },
  'Vitamin':        { icon: 'wb_sunny',          color: 'var(--color-primary-900)', light: 'var(--color-primary-50)' },
};
const DEFAULT_META = { icon: 'science', color: 'var(--color-primary-600)', light: 'var(--color-primary-50)' };

/** Lowercase, strip punctuation to spaces, collapse whitespace — used for the
 * in-modal "search tests in this package" box. */
function normalizeText(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(normalized: string): string[] {
  return normalized ? normalized.split(' ').filter(t => t.length > 0) : [];
}

@Component({
  selector: 'app-packages-list',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, RouterLink,
    EmptyStateComponent, ModalComponent,
    SearchInputComponent, ButtonComponent,
    HealthImageComponent, PackageCardComponent, BreadcrumbComponent,
  ],
  template: `
    <div class="packages-page">

      <!-- Brand hero — always shown -->
      <div class="hero">
        <div class="hero-inner">
          <div class="hero-copy">
            <app-breadcrumb [items]="[{ label: 'Home', path: '/' }, { label: 'Health Packages' }]" />
            <div class="hero-eyebrow">
              <span class="eyebrow-dot"></span>
              Sri Health Packages
            </div>
            <h1 class="hero-title">Complete health checkups<br>at unbeatable prices</h1>
            <p class="hero-sub">
              Curated diagnostic panels for early detection, annual wellness and<br class="hero-br">
              targeted health monitoring — all under one booking.
            </p>
            <div class="hero-stats">
              <div class="stat"><span class="stat-n">{{ packages().length || '—' }}</span><span class="stat-l">Packages</span></div>
              <div class="stat-divider"></div>
              <div class="stat"><span class="stat-n">NABL</span><span class="stat-l">Accredited Lab</span></div>
              <div class="stat-divider"></div>
              <div class="stat"><span class="stat-n">24h</span><span class="stat-l">Report Delivery</span></div>
            </div>
          </div>
          <app-health-image class="hero-photo" src="assets/photos/packages-hero.jpg" [ratioInput]="1.2" [rounded]="false" alt="Doctor guiding a family through a preventive health checkup" />
        </div>
        <div class="hero-bg-orb hero-orb-1"></div>
        <div class="hero-bg-orb hero-orb-2"></div>
      </div>

      <!-- Real, backend-driven sale banner — entirely hidden when no live "packages" banner exists -->
      @if (activePromoBanner(); as banner) {
        <div class="sale-banner">
          <div class="sale-banner-inner">
            <div class="sale-left">
              <span class="sale-icon" aria-hidden="true">📢</span>
              <div class="sale-copy">
                <h2 class="sale-title">{{ banner.title || 'Health Package Offers' }}</h2>
                @if (banner.subtitle) { <p class="sale-sub">{{ banner.subtitle }}</p> }
              </div>
            </div>
            <div class="sale-countdown">
              <span class="countdown-label">Offer Ends In</span>
              <div class="countdown-boxes">
                <div class="countdown-box"><span class="countdown-num">{{ countdown().h }}</span><span class="countdown-unit">HRS</span></div>
                <span class="countdown-colon">:</span>
                <div class="countdown-box"><span class="countdown-num">{{ countdown().m }}</span><span class="countdown-unit">MINS</span></div>
                <span class="countdown-colon">:</span>
                <div class="countdown-box"><span class="countdown-num">{{ countdown().s }}</span><span class="countdown-unit">SECS</span></div>
              </div>
            </div>
            <div class="sale-valid">
              <div class="valid-till"><mat-icon>event_available</mat-icon> Valid till {{ validTillLabel() }}</div>
              <div class="valid-online"><mat-icon>check_circle</mat-icon> Applicable only online</div>
            </div>
          </div>
        </div>
      }

      <!-- Body -->
      <div class="packages-body">

        @if (selectedConcernKeys().length) {
          <div class="concern-banner">
            <div>
              <h2 class="concern-heading">Recommended Packages for {{ concernNames() }}</h2>
              <p class="concern-sub">Curated based on the health concern(s) you selected.</p>
            </div>
            <button class="btn-clear-filters" (click)="clearConcernFilter()">
              <mat-icon>close</mat-icon> Clear filter
            </button>
          </div>
        }

        @if (loading()) {
          <div class="pkg-grid">
            @for (i of [1,2,3,4,5,6]; track i) {
              <div class="skeleton-card">
                <div class="skel-band"></div>
                <div class="skel-body">
                  <div class="skel-line skel-title"></div>
                  <div class="skel-line skel-sub"></div>
                  <div class="skel-line skel-item"></div>
                  <div class="skel-line skel-item"></div>
                  <div class="skel-line skel-item skel-short"></div>
                  <div class="skel-footer">
                    <div class="skel-line skel-price"></div>
                    <div class="skel-btn"></div>
                  </div>
                </div>
              </div>
            }
          </div>

        } @else if (error()) {
          <app-empty-state icon="file" title="Something went wrong" [description]="error() ?? ''">
            <app-button variant="danger" (clicked)="load()">Try Again</app-button>
          </app-empty-state>

        } @else if (packages().length === 0) {
          <app-empty-state illustration="health-package" title="No packages available yet" description="Our team is curating health packages. In the meantime, you can browse and book individual tests.">
            <a routerLink="/tests" class="btn-browse">Browse Individual Tests</a>
          </app-empty-state>

        } @else {
          <div class="pkg-grid">
            @for (pkg of packages(); track pkg.id) {
              <app-package-card
                [pkg]="pkg"
                [bestValue]="pkg.id === bestValuePackageId()"
                (book)="book($event)"
                (openDetails)="openDetails($event)"
              />
            }
            <div class="trust-card">
              @for (item of trustItems; track item.label) {
                <div class="trust-card-item">
                  <span class="trust-card-icon"><mat-icon>{{ item.icon }}</mat-icon></span>
                  <div>
                    <div class="trust-card-title">{{ item.label }}</div>
                    <div class="trust-card-sub">{{ item.sub }}</div>
                  </div>
                </div>
              }
            </div>
          </div>
          <p class="footer-note"><mat-icon>verified_user</mat-icon> All packages are valid for a limited time only. Offers cannot be combined with other discounts.</p>
        }

      </div>

      <!-- ── Package details modal ─────────────────────────────── -->
      <app-modal [isOpen]="!!selectedPackage()" [title]="selectedPackage()?.name ?? ''" size="lg" [showFooter]="true" (close)="closeDetails()">
        @if (selectedPackage(); as pkg) {
          <div class="modal-intro">
            <span class="modal-count">{{ pkg.tests.length }} tests</span>
            @if (pkg.description) {
              <p class="modal-desc">{{ pkg.description }}</p>
            }
          </div>

          <app-search-input
            class="modal-search"
            placeholder="Search tests in this package…"
            [debounce]="150"
            (search)="modalSearchQuery.set($event)"
          />

          @if (filteredModalTests().length === 0) {
            <p class="modal-no-results">No tests match "{{ modalSearchQuery() }}". <button type="button" class="modal-clear-search" (click)="modalSearchQuery.set('')">Clear search</button></p>
          } @else {
            <ul class="modal-test-list">
              @for (t of filteredModalTests(); track t.id) {
                <li class="modal-test" [style.--cat-color]="meta(t).color" [style.--cat-light]="meta(t).light">
                  <span class="modal-test-ic"><mat-icon>{{ meta(t).icon }}</mat-icon></span>
                  <div class="modal-test-info">
                    <div class="modal-test-top">
                      <span class="modal-test-name">{{ t.name }}</span>
                      <span class="modal-test-cat">{{ t.category }}</span>
                    </div>
                    @if (t.description) {
                      <p class="modal-test-desc">{{ t.description }}</p>
                    }
                    <div class="modal-test-meta">
                      <span class="meta-tag"><mat-icon>schedule</mat-icon>{{ t.turnaround_hours }}h results</span>
                      <span class="meta-tag"><mat-icon>home</mat-icon>Free home collection</span>
                      <span class="meta-tag"><mat-icon>verified</mat-icon>NABL certified</span>
                    </div>
                  </div>
                </li>
              }
            </ul>
          }
        }
        <div modal-footer>
          @if (selectedPackage(); as pkg) {
            <div class="modal-price">
              @if (Number(pkg.original_price) > Number(pkg.discounted_price)) {
                <span class="modal-price-orig">₹{{ Number(pkg.original_price) | number:'1.0-0' }}</span>
              }
              <span class="modal-price-final">₹{{ Number(pkg.discounted_price) | number:'1.0-0' }}</span>
              @if (pkg.eligible_coupon; as coupon) {
                <span class="modal-price-offer">Use code {{ coupon.code }} · {{ coupon.discount_type === 'percentage' ? coupon.discount_value + '% OFF' : '₹' + coupon.discount_value + ' OFF' }}</span>
              }
            </div>
            <div class="modal-footer-actions">
              <app-button variant="primary" size="lg" (clicked)="book(pkg)">Book Package</app-button>
            </div>
          }
        </div>
      </app-modal>
    </div>
  `,
  styles: [`
    /* ── Reset & base ─────────────────────────────────────────── */
    :host { display: block; font-family: var(--font-sans, 'Inter'), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

    .packages-page {
      min-height: calc(100vh - 64px);
      background: var(--bg-secondary);
    }

    /* ── Sale banner ─────────────────────────────────────────── */
    .sale-banner {
      background: linear-gradient(90deg, #FDF2F8 0%, #FCE7F3 100%);
      border-bottom: 1px solid #FBCFE8;
      padding: 1.15rem 1.5rem;
    }
    .sale-banner-inner {
      max-width: 1280px; margin: 0 auto;
      display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap;
    }
    .sale-left { display: flex; align-items: center; gap: 0.75rem; min-width: 0; flex: 1 1 260px; }
    .sale-icon { font-size: 1.8rem; flex-shrink: 0; }
    .sale-copy { min-width: 0; }
    .sale-title {
      font-family: var(--font-display, 'Poppins'), 'Inter', system-ui, sans-serif;
      font-size: 1.3rem; font-weight: 800; color: var(--text-primary); margin: 0; line-height: 1.2;
    }
    .sale-sub { font-size: 0.85rem; color: var(--text-secondary); margin: 0.15rem 0 0; }

    .sale-countdown { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; flex-shrink: 0; }
    .countdown-label { font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); }
    .countdown-boxes { display: flex; align-items: center; gap: 0.35rem; }
    .countdown-box {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      width: 46px; height: 42px; border-radius: 10px; background: #fff;
      border: 1px solid #FBCFE8; box-shadow: var(--shadow-xs);
    }
    .countdown-num { font-size: 1.05rem; font-weight: 800; color: #BE185D; font-variant-numeric: tabular-nums; line-height: 1; }
    .countdown-unit { font-size: 0.55rem; font-weight: 700; color: var(--text-muted); letter-spacing: 0.03em; }
    .countdown-colon { font-size: 1.1rem; font-weight: 800; color: #BE185D; }

    .sale-valid { display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-end; flex-shrink: 0; }
    .valid-till, .valid-online {
      display: flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);
      background: #fff; border: 1px solid #FBCFE8; border-radius: var(--radius-full); padding: 0.3rem 0.7rem;
      mat-icon { font-size: 0.9rem; width: 0.9rem; height: 0.9rem; color: #BE185D; }
    }
    .valid-online mat-icon { color: var(--color-success-600); }

    /* ── Brand hero (photo + copy) ────────────────────────────── */
    .hero {
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(255,255,255,0) 55%, rgba(255,255,255,.85) 100%),
        linear-gradient(90deg, var(--color-primary-50) 0%, rgba(238,244,255,.96) 42%, rgba(238,244,255,.68) 66%, rgba(238,244,255,.12) 100%),
        url('/assets/photos/home-collection.jpg') right center / cover no-repeat;
      padding: 3rem 1.5rem 2.75rem;
    }
    .hero-inner {
      position: relative; z-index: 2; max-width: 1100px; margin: 0 auto;
      display: flex; align-items: center; justify-content: space-between; gap: 2.5rem;
    }
    .hero-copy { flex: 1; min-width: 0; }
    .hero-photo {
      width: 320px; max-width: 38%; flex-shrink: 0; border-radius: 1rem; overflow: hidden;
      box-shadow: 0 18px 44px rgba(13,31,60,.14);
    }
    @media (max-width: 820px) { .hero-photo { display: none; } }

    .hero-eyebrow {
      display: inline-flex; align-items: center; gap: 0.45rem;
      font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--color-primary-700); background: var(--color-primary-50);
      border: 1px solid var(--color-primary-200, #B3CAFF); padding: 0.3rem 0.85rem; border-radius: 999px; margin-bottom: 1rem;
    }
    .eyebrow-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--color-primary-600); display: inline-block; flex-shrink: 0; }

    .hero-title {
      font-family: var(--font-display, 'Poppins'), 'Inter', system-ui, sans-serif;
      font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 700; line-height: 1.18; color: var(--text-primary);
      text-wrap: balance; margin: 0 0 1rem; letter-spacing: -0.02em;
    }
    .hero-sub { font-size: 0.975rem; color: var(--text-secondary); line-height: 1.65; max-width: 520px; margin: 0 0 2rem; }
    .hero-br { display: block; }

    .hero-stats { display: flex; align-items: center; gap: 1.25rem; }
    .stat { display: flex; flex-direction: column; gap: 0.1rem; }
    .stat-n { font-size: 1.2rem; font-weight: 800; color: var(--color-primary-600); font-variant-numeric: tabular-nums; line-height: 1; }
    .stat-l { font-size: 0.7rem; font-weight: 500; color: var(--text-secondary); letter-spacing: 0.04em; text-transform: uppercase; }
    .stat-divider { width: 1px; height: 2rem; background: var(--color-primary-100); }

    .hero-bg-orb { position: absolute; border-radius: 999px; pointer-events: none; }
    .hero-orb-1 { width: 380px; height: 380px; background: radial-gradient(circle, rgba(0, 71, 204, 0.07) 0%, transparent 70%); top: -120px; right: -80px; }
    .hero-orb-2 { width: 220px; height: 220px; background: radial-gradient(circle, rgba(0, 180, 174, 0.08) 0%, transparent 70%); bottom: -60px; left: 30%; }

    @media (max-width: 600px) {
      .hero { padding: 2.5rem 1.25rem 2rem; }
      .hero-sub { font-size: 0.9rem; }
      .hero-br { display: none; }
    }

    /* ── Trust card (trailing grid item) ────────────────────── */
    .trust-card {
      background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: 16px;
      padding: 1.25rem; display: flex; flex-direction: column; gap: 1.1rem; justify-content: center;
    }
    .trust-card-item { display: flex; align-items: flex-start; gap: 0.75rem; }
    .trust-card-icon {
      width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
      background: var(--color-primary-50); display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; color: var(--color-primary-600); }
    }
    .trust-card-title { font-size: 0.85rem; font-weight: 700; color: var(--text-primary); }
    .trust-card-sub { font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.1rem; }

    .footer-note {
      display: flex; align-items: center; justify-content: center; gap: 0.4rem;
      font-size: 0.8rem; color: var(--text-tertiary); text-align: center;
      margin: 1.75rem auto 0; max-width: 1100px; padding: 0 1.5rem;
      mat-icon { font-size: 1rem; width: 1rem; height: 1rem; color: var(--text-muted); }
    }

    /* ── Body ────────────────────────────────────────────────── */
    .packages-body { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem 3rem; }

    .concern-banner {
      display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap;
      background: var(--color-primary-50); border: 1px solid var(--color-primary-200, #B3CAFF); border-radius:14px;
      padding:1rem 1.25rem; margin-bottom:1.5rem;
    }
    .concern-heading { font-size:1.05rem; font-weight:700; color: var(--text-primary); margin:0 0 .2rem 0; }
    .concern-sub { font-size:.8rem; color: var(--text-tertiary); margin:0; }
    .btn-clear-filters {
      display:inline-flex; align-items:center; gap:.3rem;
      background: var(--bg-primary); border:1.5px solid var(--border-subtle); border-radius:8px;
      padding:.3rem .75rem; font-size:.78rem; font-weight:600; color: var(--text-secondary);
      transition:all .15s; flex-shrink:0;
      mat-icon { font-size:.85rem; width:.85rem; height:.85rem; }
    }
    .btn-clear-filters:hover { border-color: var(--color-primary-600); color: var(--color-primary-600); }

    /* ── Grid ────────────────────────────────────────────────── */
    .pkg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(308px, 1fr)); gap: 1.375rem; }

    /* ── Skeletons ───────────────────────────────────────────── */
    @keyframes shimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }

    .skeleton-card { border-radius: 16px; border: 1px solid var(--border-subtle); overflow: hidden; background: var(--bg-primary); }
    .skel-band { height: 84px; background: linear-gradient(90deg, var(--border-subtle) 25%, var(--color-primary-50) 50%, var(--border-subtle) 75%); background-size: 200% 100%; animation: shimmer 1.6s infinite; }
    .skel-body { padding: 1rem 1.25rem 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .skel-line { border-radius: 6px; background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border-subtle) 50%, var(--bg-tertiary) 75%); background-size: 200% 100%; animation: shimmer 1.6s infinite; }
    .skel-title { height: 18px; width: 70%; }
    .skel-sub { height: 12px; width: 90%; }
    .skel-item { height: 12px; width: 85%; }
    .skel-short { width: 55%; }
    .skel-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; padding-top: 0.75rem; border-top: 1px solid var(--bg-tertiary); }
    .skel-price { height: 22px; width: 90px; border-radius: 6px; background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border-subtle) 50%, var(--bg-tertiary) 75%); background-size: 200% 100%; animation: shimmer 1.6s infinite; }
    .skel-btn { height: 36px; width: 110px; border-radius: 10px; background: linear-gradient(90deg, var(--color-primary-50) 25%, var(--color-primary-100) 50%, var(--color-primary-50) 75%); background-size: 200% 100%; animation: shimmer 1.6s infinite; }

    .btn-browse {
      display: inline-flex; align-items: center; background: var(--gradient-primary); color: #FFFFFF;
      text-decoration: none; border-radius: 10px; padding: 0.65rem 1.5rem; font-size: 0.875rem; font-weight: 700;
      box-shadow: var(--shadow-primary); transition: box-shadow 0.18s ease, transform 0.18s ease;
      &:hover { box-shadow: var(--shadow-primary-lg); transform: translateY(-1px); }
      &:focus-visible { outline: 2px solid var(--color-primary-600); outline-offset: 2px; }
    }

    /* ── Details modal content ──────────────────────────────── */
    .modal-intro { margin-bottom: 0.75rem; }
    .modal-count {
      display: inline-block; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      background: var(--color-primary-50); color: var(--color-primary-700); padding: 0.25rem 0.6rem; border-radius: 999px; margin-bottom: 0.5rem;
    }
    .modal-desc { font-size: 0.85rem; line-height: 1.55; color: var(--text-tertiary); margin: 0.3rem 0 0; }
    .modal-search { margin-bottom: 0.85rem; }
    .modal-no-results { font-size: 0.85rem; color: var(--text-tertiary); text-align: center; padding: 2rem 1rem; }
    .modal-clear-search { background: none; border: none; padding: 0; color: var(--color-primary-600); font-weight: 700; cursor: pointer; }

    .modal-test-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
    .modal-test { display: flex; gap: 0.75rem; padding: 0.85rem; border: 1px solid var(--border-subtle); border-radius: 12px; background: var(--bg-secondary); transition: border-color 0.15s ease, box-shadow 0.15s ease; }
    .modal-test:hover { border-color: var(--cat-color, var(--color-primary-200)); box-shadow: 0 2px 10px rgba(0, 71, 204, 0.08); }
    .modal-test-ic {
      width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
      background: var(--cat-light, var(--color-primary-50));
      mat-icon { font-size: 1.15rem; width: 1.15rem; height: 1.15rem; color: var(--cat-color, var(--color-primary-600)); }
    }
    .modal-test-info { flex: 1; min-width: 0; }
    .modal-test-top { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
    .modal-test-name { font-size: 0.9rem; font-weight: 700; color: var(--text-primary); line-height: 1.35; }
    .modal-test-cat {
      flex-shrink: 0; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase;
      color: var(--cat-color, var(--color-primary-600)); background: var(--cat-light, var(--color-primary-50)); padding: 0.15rem 0.5rem; border-radius: 999px;
    }
    .modal-test-desc { font-size: 0.78rem; color: var(--text-tertiary); line-height: 1.5; margin: 0.3rem 0 0; }
    .modal-test-meta { display: flex; flex-wrap: wrap; gap: 0.4rem 0.75rem; margin-top: 0.5rem; }
    .meta-tag { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; font-weight: 500; color: var(--text-tertiary); mat-icon { font-size: 0.85rem; width: 0.85rem; height: 0.85rem; color: var(--text-muted); } }

    .modal-price { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; flex: 1; }
    .modal-price-orig { font-size: 0.85rem; color: var(--text-muted); text-decoration: line-through; font-variant-numeric: tabular-nums; }
    .modal-price-final { font-size: 1.4rem; font-weight: 800; color: var(--color-primary-700); font-variant-numeric: tabular-nums; }
    .modal-price-offer { flex-basis: 100%; font-size: 0.72rem; font-weight: 700; color: #DC2626; }
    .modal-footer-actions { display: flex; align-items: center; gap: 0.6rem; }

    /* ── Responsive ──────────────────────────────────────────── */
    @media (max-width: 700px) {
      .sale-banner-inner { justify-content: flex-start; }
      .sale-valid { align-items: flex-start; }
    }

    @media (max-width: 600px) {
      .sale-banner { padding: 1rem; }
      .sale-title { font-size: 1.1rem; }
      .plain-heading { padding: 1.5rem 1rem 0.25rem; }
      .packages-body { padding: 1.75rem 1rem 3rem; }
      .pkg-grid { grid-template-columns: 1fr; gap: 1rem; }
    }
  `],
})
export class PackagesListComponent implements OnInit, OnDestroy {
  private packageApi = inject(PackageApiService);
  private healthConcernApi = inject(HealthConcernApiService);
  private bannerApi = inject(BannerApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private seo = inject(SeoService);

  packages = signal<Package[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  packageBanners = signal<Banner[]>([]);
  activePromoBanner = computed(() => this.packageBanners()[0] ?? null);

  /** Ticks down to local midnight — a real, honest clock (not a fabricated
   * deadline) since the public banner/coupon APIs don't expose an expiry date. */
  countdown = signal({ h: '00', m: '00', s: '00' });
  validTillLabel = computed(() =>
    new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  );
  private countdownTimer?: ReturnType<typeof setInterval>;

  selectedConcernKeys = signal<string[]>([]);
  allConcerns = signal<HealthConcern[]>([]);

  selectedPackage = signal<Package | null>(null);
  modalSearchQuery = signal('');

  Number = Number;

  concernNames = computed(() =>
    this.selectedConcernKeys()
      .map(k => this.allConcerns().find(c => c.key === k)?.name ?? k)
      .join(', ')
  );

  trustItems = [
    { icon: 'verified', label: '100% NABL Accredited', sub: 'Trusted & certified labs' },
    { icon: 'home', label: 'Home Sample Collection', sub: 'Free sample pickup at your home' },
    { icon: 'schedule', label: '24h Report Delivery', sub: 'Reports within 24 hours' },
    { icon: 'shield', label: 'Secure & Reliable', sub: 'Your data is safe with us' },
  ];

  bestValuePackageId = computed<string | null>(() => {
    let best: Package | null = null;
    let bestPct = 0;
    for (const p of this.packages()) {
      const pct = this.discountPct(p);
      if (pct <= 0) continue;
      if (!best || pct > bestPct || (pct === bestPct && p.tests.length > best.tests.length)) {
        best = p;
        bestPct = pct;
      }
    }
    return best?.id ?? null;
  });

  filteredModalTests = computed(() => {
    const pkg = this.selectedPackage();
    if (!pkg) return [];
    const q = normalizeText(this.modalSearchQuery());
    if (!q) return pkg.tests;
    const tokens = tokenize(q);
    return pkg.tests.filter(t => {
      const name = normalizeText(t.name);
      const cat = normalizeText(t.category);
      return name.includes(q) || cat.includes(q) || tokens.some(tok => tok.length >= 3 && (name.includes(tok) || cat.includes(tok)));
    });
  });

  private pendingPackageId: string | null = null;

  ngOnInit(): void {
    this.seo.setPage({
      title: 'Health Packages — Curated Diagnostic Checkups',
      description:
        'Compare NABL-accredited health packages for annual wellness, early detection and targeted screening, with free home sample collection and reports within 24 hours.',
      path: '/packages',
      image: 'assets/photos/packages-hero.jpg',
    });
    this.seo.setJsonLd('breadcrumb', buildBreadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Health Packages', path: '/packages' },
    ]));

    this.healthConcernApi.list().subscribe({ next: (list) => this.allConcerns.set(list) });
    this.loadBanners();
    this.route.queryParams.subscribe(params => {
      const concernParam = params['health_concern'];
      this.selectedConcernKeys.set(concernParam ? concernParam.split(',').filter(Boolean) : []);
      this.pendingPackageId = params['pkg'] ?? null;
      this.load();
    });
    this.tickCountdown();
    this.countdownTimer = setInterval(() => this.tickCountdown(), 1000);
  }

  ngOnDestroy(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

  private tickCountdown(): void {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const diffSec = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
    const pad = (n: number) => String(n).padStart(2, '0');
    this.countdown.set({
      h: pad(Math.floor(diffSec / 3600)),
      m: pad(Math.floor((diffSec % 3600) / 60)),
      s: pad(diffSec % 60),
    });
  }

  loadBanners(): void {
    this.bannerApi.list().subscribe({
      next: (banners) => {
        this.packageBanners.set(
          banners.filter(b => b.category === 'packages').sort((a, b) => a.display_order - b.display_order)
        );
      },
      error: () => this.packageBanners.set([]), // hero promo is optional — never blocks the page
    });
  }

  clearConcernFilter(): void {
    this.router.navigate(['/packages']);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const concernKeys = this.selectedConcernKeys();
    this.packageApi.list({ page_size: 100, health_concern: concernKeys.length ? concernKeys.join(',') : undefined }).subscribe({
      next: (res) => {
        const normalized = res.items.map(pkg => ({
          ...pkg,
          original_price: Number(pkg.original_price),
          discounted_price: Number(pkg.discounted_price),
        }));
        this.packages.set(normalized);
        this.loading.set(false);
        if (this.pendingPackageId) {
          const match = normalized.find(p => p.id === this.pendingPackageId);
          if (match) this.openDetails(match);
          this.pendingPackageId = null;
        }
      },
      error: () => { this.error.set('Failed to load packages. Please check your connection.'); this.loading.set(false); },
    });
  }

  discountPct(p: Package): number {
    const original = Number(p.original_price);
    const final = Number(p.discounted_price);
    if (!original || original <= final) return 0;
    return Math.round((1 - final / original) * 100);
  }

  book(p: Package): void {
    this.router.navigate(['/booking'], { queryParams: { package_id: p.id } });
  }

  openDetails(p: Package): void {
    this.selectedPackage.set(p);
    this.modalSearchQuery.set('');
  }

  closeDetails(): void {
    this.selectedPackage.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.selectedPackage()) this.closeDetails();
  }

  meta(t: Test): { icon: string; color: string; light: string } {
    return CATEGORY_META[t.category] ?? DEFAULT_META;
  }
}
