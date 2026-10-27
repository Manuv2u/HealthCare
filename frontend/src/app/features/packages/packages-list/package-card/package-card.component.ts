import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CouponSummary, Package } from '../../../../core/api/api.types';

const ARROW_RIGHT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;

/** Icon/label the offer chip cycles through, matched deterministically per coupon code. */
const OFFER_THEMES = [
  { key: 'flame', icon: 'local_fire_department', tag: 'Special Offer' },
  { key: 'festival', icon: 'celebration', tag: 'Festival Offer' },
  { key: 'star', icon: 'auto_awesome', tag: 'Limited Time Offer' },
] as const;
type OfferTheme = typeof OFFER_THEMES[number];

interface TopBadge { label: string; icon: string; cls: string; }

@Component({
  selector: 'app-package-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="pkg-card">
      <div class="card-band">
        @if (topBadge(); as badge) {
          <span class="top-badge top-badge--{{ badge.cls }}">
            <mat-icon>{{ badge.icon }}</mat-icon>
            {{ badge.label }}
          </span>
        } @else {
          <span></span>
        }

        <div class="band-tests-count">
          <span class="tests-num">{{ pkg.tests.length }}</span>
          <span class="tests-label">tests</span>
        </div>
      </div>

      <div class="card-body">
        <h3 class="card-title">{{ pkg.name }}</h3>
        @if (pkg.description) {
          <p class="card-desc">{{ pkg.description }}</p>
        }

        <ul class="test-list">
          @for (t of pkg.tests.slice(0, 5); track t.id) {
            <li class="test-item">
              <span class="test-check"><mat-icon>check</mat-icon></span>
              <span class="test-name">{{ t.name }}</span>
            </li>
          }
          @if (pkg.tests.length > 5) {
            <li class="test-item test-more">
              <button type="button" class="test-more-btn" (click)="openDetails.emit(pkg)">
                <span class="test-check test-check-more"><mat-icon>add</mat-icon></span>
                <span class="test-name test-name-more">{{ pkg.tests.length - 5 }} more test{{ pkg.tests.length - 5 === 1 ? '' : 's' }} included</span>
              </button>
            </li>
          }
        </ul>
        <button type="button" class="view-all-link" (click)="openDetails.emit(pkg)">View package details</button>

        <div class="card-footer">
          <div class="footer-row">
            <div class="price-block">
              @if (Number(pkg.original_price) > Number(pkg.discounted_price)) {
                <div class="price-row-top">
                  <span class="price-original">₹{{ Number(pkg.original_price) | number:'1.0-0' }}</span>
                  <span class="save-badge">Save ₹{{ (Number(pkg.original_price) - Number(pkg.discounted_price)) | number:'1.0-0' }}</span>
                </div>
              }
              <div class="price-row-main">
                <span class="price-final">₹{{ Number(pkg.discounted_price) | number:'1.0-0' }}</span>
                @if (Number(pkg.original_price) > Number(pkg.discounted_price)) {
                  <span class="discount-pill">{{ discountPct() }}% off</span>
                }
              </div>
            </div>
            <button type="button" class="btn-book" (click)="book.emit(pkg)">
              Book Now
              <span class="btn-book-arrow" [innerHTML]="arrowIcon"></span>
            </button>
          </div>

          @if (pkg.eligible_coupon; as coupon) {
            <div class="offer-chip" [title]="'Use code ' + coupon.code + ' at checkout'">
              <mat-icon class="offer-chip-tag">local_offer</mat-icon>
              <span>{{ couponTheme(coupon).tag }} Applied: {{ couponDiscountLabel(coupon) }}</span>
              <mat-icon class="offer-chip-info">info</mat-icon>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .pkg-card {
      position: relative;
      height: 100%;
      background: var(--bg-primary);
      border-radius: 16px;
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-xs);
      display: flex;
      flex-direction: column;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .pkg-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }

    /* ── Gradient band: badge (left) + tests count (right) ──── */
    .card-band {
      position: relative;
      background: linear-gradient(115deg, var(--color-primary-800) 0%, var(--color-primary-600) 60%, var(--color-primary-600) 100%);
      padding: 1.1rem 1.25rem 1.4rem;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      clip-path: polygon(0 0, 100% 0, 100% 70%, 0 100%);
      min-height: 84px;
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
    }

    .top-badge {
      display: inline-flex; align-items: center; gap: 0.3rem;
      color: #fff; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.03em; text-transform: uppercase;
      padding: 0.3rem 0.65rem; border-radius: var(--radius-full); white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      mat-icon { font-size: 0.8rem; width: 0.8rem; height: 0.8rem; }
    }
    .top-badge--popular { background: #EA580C; }
    .top-badge--value { background: #7C3AED; }
    .top-badge--offer { background: #EA580C; }

    .band-tests-count { display: flex; flex-direction: column; align-items: flex-end; line-height: 1; }
    .tests-num { font-size: 2rem; font-weight: 800; color: rgba(255,255,255,0.95); font-variant-numeric: tabular-nums; line-height: 1; }
    .tests-label { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.65); margin-top: 0.1rem; }

    /* ── Body ────────────────────────────────────────────────── */
    .card-body { padding: 0.85rem 1.25rem 1.25rem; display: flex; flex-direction: column; gap: 0.45rem; flex: 1; }
    .card-title { font-size: 1.05rem; font-weight: 750; color: var(--text-primary); line-height: 1.3; margin: 0; }
    .card-desc {
      font-size: 0.8rem; color: var(--text-tertiary); line-height: 1.5; margin: 0 0 0.15rem;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }

    .test-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.32rem; }
    .test-item { display: flex; align-items: center; gap: 0.45rem; }
    .test-check {
      width: 17px; height: 17px; border-radius: 999px; background: var(--color-success-100);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      mat-icon { font-size: 0.68rem; width: 0.68rem; height: 0.68rem; color: var(--color-success-700); }
    }
    .test-name { font-size: 0.8rem; color: var(--text-secondary); font-weight: 500; line-height: 1.3; }

    .test-more-btn { display: flex; align-items: center; gap: 0.45rem; background: none; border: none; padding: 0; cursor: pointer; text-align: left; }
    .test-more-btn:focus-visible { outline: 2px solid var(--color-primary-600); outline-offset: 2px; }
    .test-check-more { background: var(--color-primary-50); }
    .test-check-more mat-icon { color: var(--color-primary-600) !important; }
    .test-name-more { font-size: 0.8rem; font-weight: 700; color: var(--color-primary-600); line-height: 1.3; }

    .view-all-link {
      align-self: flex-start; background: none; border: none; padding: 0.1rem 0; margin: 0.1rem 0 0.5rem;
      font-size: 0.8rem; font-weight: 700; color: var(--color-primary-600); cursor: pointer;
    }
    .view-all-link:hover { text-decoration: underline; }
    .view-all-link:focus-visible { outline: 2px solid var(--color-primary-600); outline-offset: 2px; }

    /* ── Footer: price + Book button ─────────────────────────── */
    .card-footer {
      display: flex; flex-direction: column; gap: 0.6rem;
      margin-top: auto; padding-top: 0.9rem; border-top: 1px solid var(--border-subtle);
    }
    .footer-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 0.75rem; }
    .price-block { display: flex; flex-direction: column; gap: 0.2rem; }
    .price-row-top { display: flex; align-items: center; gap: 0.4rem; }
    .price-original { font-size: 0.8rem; color: var(--text-muted); text-decoration: line-through; font-variant-numeric: tabular-nums; }
    .save-badge { font-size: 0.68rem; font-weight: 700; background: var(--color-success-100); color: var(--color-success-700); padding: 0.1rem 0.45rem; border-radius: 999px; }
    .price-row-main { display: flex; align-items: center; gap: 0.5rem; }
    .price-final { font-size: 1.3rem; font-weight: 800; color: var(--color-primary-700); font-variant-numeric: tabular-nums; line-height: 1; }
    .discount-pill { font-size: 0.68rem; font-weight: 700; background: var(--color-primary-50); color: var(--color-primary-800); padding: 0.15rem 0.45rem; border-radius: 999px; }

    /* ── Offer chip ──────────────────────────────────────────── */
    .offer-chip {
      display: flex; align-items: center; gap: 0.4rem;
      background: var(--color-success-50, #ECFDF5); color: var(--color-success-700);
      font-size: 0.76rem; font-weight: 600; border-radius: 10px; padding: 0.55rem 0.7rem;
      .offer-chip-tag { font-size: 0.9rem; width: 0.9rem; height: 0.9rem; flex-shrink: 0; }
      .offer-chip-info { font-size: 0.85rem; width: 0.85rem; height: 0.85rem; margin-left: auto; color: var(--color-success-600); flex-shrink: 0; opacity: 0.7; }
      span { flex: 1; }
    }

    /* ── Book Now button ─────────────────────────────────────── */
    .btn-book {
      display: inline-flex; align-items: center; gap: 0.4rem; flex-shrink: 0;
      background: var(--gradient-primary); color: #fff; border: none; border-radius: 10px;
      padding: 0.65rem 1.1rem; font-size: 0.85rem; font-weight: 700; cursor: pointer; white-space: nowrap;
      box-shadow: var(--shadow-primary); transition: box-shadow 0.18s ease, transform 0.18s ease;
    }
    .btn-book:hover { box-shadow: var(--shadow-primary-lg); transform: translateY(-1px); }
    .btn-book:focus-visible { outline: 2px solid var(--color-primary-700); outline-offset: 2px; }
    .btn-book-arrow { display: inline-flex; width: 0.9rem; height: 0.9rem; }
    .btn-book-arrow :is(svg) { width: 100%; height: 100%; }

    @media (max-width: 480px) {
      .footer-row { flex-wrap: wrap; }
      .btn-book { width: 100%; justify-content: center; }
    }

    @media (prefers-reduced-motion: reduce) {
      .pkg-card, .btn-book { transition: none; }
    }
  `],
})
export class PackageCardComponent {
  @Input({ required: true }) pkg!: Package;
  @Input() bestValue = false;

  @Output() book = new EventEmitter<Package>();
  @Output() openDetails = new EventEmitter<Package>();

  Number = Number;
  arrowIcon = ARROW_RIGHT_ICON;

  topBadge(): TopBadge | null {
    if (this.pkg.is_popular) return { label: 'Most Popular', icon: 'star', cls: 'popular' };
    if (this.bestValue) return { label: 'Best Value', icon: 'bolt', cls: 'value' };
    if (this.pkg.eligible_coupon) return { label: 'Special Offer', icon: 'local_fire_department', cls: 'offer' };
    return null;
  }

  couponTheme(coupon: CouponSummary): OfferTheme {
    let hash = 0;
    for (const ch of coupon.code) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return OFFER_THEMES[hash % OFFER_THEMES.length];
  }

  couponDiscountLabel(coupon: CouponSummary): string {
    return coupon.discount_type === 'percentage'
      ? `Extra ${coupon.discount_value}% OFF`
      : `₹${coupon.discount_value} OFF`;
  }

  discountPct(): number {
    const original = Number(this.pkg.original_price);
    const final = Number(this.pkg.discounted_price);
    if (!original || original <= final) return 0;
    return Math.round((1 - final / original) * 100);
  }
}
