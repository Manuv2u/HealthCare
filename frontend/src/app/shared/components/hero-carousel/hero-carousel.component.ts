import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Banner } from '../../../core/api/api.types';

/**
 * Reusable, dependency-free hero banner carousel.
 *
 * Features: autoplay (2s), prev/next arrows, pagination dots, swipe gestures,
 * pause-on-hover, infinite loop, keyboard navigation and ARIA roles.
 * Slides are fully data-driven — pass a `banners` array.
 */
@Component({
  selector: 'app-hero-carousel',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <section
      class="hc"
      role="region"
      aria-roledescription="carousel"
      aria-label="Promotional banners"
      (mouseenter)="pause()"
      (mouseleave)="resume()"
      (touchstart)="onTouchStart($event)"
      (touchend)="onTouchEnd($event)"
      (keydown)="onKeydown($event)"
      tabindex="0"
    >
      <div class="hc__viewport">
        <div
          class="hc__track"
          [style.transform]="'translateX(-' + current() * 100 + '%)'"
        >
          @for (banner of banners; track banner.id; let i = $index) {
            <div
              class="hc__slide"
              [class]="'cat-' + banner.category"
              role="group"
              aria-roledescription="slide"
              [attr.aria-label]="i + 1 + ' of ' + banners.length"
              [attr.aria-hidden]="current() !== i"
            >
              @if (bgImage(banner); as src) {
                <picture class="hc__media">
                  @if (banner.mobile_image_url) {
                    <source media="(max-width: 640px)" [srcset]="banner.mobile_image_url" />
                  }
                  <img
                    [src]="src"
                    [alt]="banner.title || 'Promotional banner'"
                    [attr.loading]="i === 0 ? 'eager' : 'lazy'"
                    decoding="async"
                  />
                </picture>
              }

              @if (hasContent(banner)) {
                <span class="hc__scrim" aria-hidden="true"></span>
                <span class="hc__orb hc__orb--a" aria-hidden="true"></span>
                <span class="hc__orb hc__orb--b" aria-hidden="true"></span>

                <div class="hc__inner">
                  <div class="hc__content">
                    @if (banner.title) {
                      <span class="hc__tag">{{ categoryLabel(banner.category) }}</span>
                      @if (discountLabel(banner); as discount) {
                        <span class="hc__discount-badge">{{ discount }} OFF</span>
                      }
                      <h2 class="hc__title">{{ banner.title }}</h2>
                    }
                    @if (banner.subtitle) {
                      <p class="hc__subtitle">{{ banner.subtitle }}</p>
                    }

                    @if (banner.coupon) {
                      <div class="hc__coupon-badge">Use code <strong>{{ banner.coupon.code }}</strong></div>
                    }

                    @if (banner.highlights.length) {
                      <ul class="hc__highlights">
                        @for (h of banner.highlights; track h) {
                          <li>
                            <mat-icon aria-hidden="true">check_circle</mat-icon>
                            <span>{{ h }}</span>
                          </li>
                        }
                      </ul>
                    }

                    @if (banner.cta_text || banner.cta2_text) {
                      <div class="hc__actions">
                        @if (banner.cta_text) {
                          <button
                            type="button"
                            class="hc__btn hc__btn--primary"
                            (click)="go(banner.cta_link)"
                          >
                            {{ banner.cta_text }}
                            <mat-icon aria-hidden="true">arrow_forward</mat-icon>
                          </button>
                        }
                        @if (banner.cta2_text) {
                          <button
                            type="button"
                            class="hc__btn hc__btn--ghost"
                            (click)="go(banner.cta2_link)"
                          >
                            {{ banner.cta2_text }}
                          </button>
                        }
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      @if (banners.length > 1) {
        <button
          type="button"
          class="hc__nav hc__nav--prev"
          (click)="prev()"
          aria-label="Previous banner"
        >
          <mat-icon>chevron_left</mat-icon>
        </button>
        <button
          type="button"
          class="hc__nav hc__nav--next"
          (click)="next()"
          aria-label="Next banner"
        >
          <mat-icon>chevron_right</mat-icon>
        </button>

        <div class="hc__dots" role="tablist" aria-label="Choose banner">
          @for (banner of banners; track banner.id; let i = $index) {
            <button
              type="button"
              class="hc__dot"
              [class.active]="current() === i"
              role="tab"
              [attr.aria-selected]="current() === i"
              [attr.aria-label]="'Go to banner ' + (i + 1)"
              (click)="goTo(i)"
            ></button>
          }
        </div>
      }
    </section>
  `,
  styleUrl: './hero-carousel.component.scss',
})
export class HeroCarouselComponent implements OnInit, OnChanges, OnDestroy {
  @Input() banners: Banner[] = [];
  /** Autoplay interval in milliseconds. */
  @Input() interval = 2000;

  private router = inject(Router);
  readonly current = signal(0);

  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private touchStartX = 0;

  private readonly labels: Record<string, string> = {
    packages: 'Health Packages',
    home_collection: 'Home Collection',
    corporate: 'Corporate Wellness',
    health_awareness: 'Health Awareness',
    offers: 'Special Offers',
    diagnostics: 'Diagnostic Tests',
  };

  /** Effective banner artwork: only the admin-uploaded image. A banner with
   * no upload renders blank rather than substituting a stock photo, so the
   * homepage always matches what the admin Preview shows. */
  bgImage(banner: Banner): string {
    return banner.desktop_image_url || banner.mobile_image_url || '';
  }

  ngOnInit(): void {
    this.startAuto();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['banners']) {
      if (this.current() >= this.banners.length) this.current.set(0);
      this.startAuto();
    }
  }

  ngOnDestroy(): void {
    this.stopAuto();
  }

  categoryLabel(cat: string): string {
    return this.labels[cat] ?? 'Sri Health Plus';
  }

  /** "20% OFF" / "₹200 OFF" ribbon text, or null when no coupon is linked. */
  discountLabel(banner: Banner): string | null {
    if (!banner.coupon) return null;
    return banner.coupon.discount_type === 'fixed'
      ? `₹${banner.coupon.discount_value}`
      : `${banner.coupon.discount_value}%`;
  }

  /** Whether this banner has any content to overlay on the image — if the
   * admin left every field blank, the image alone fills the slide. */
  hasContent(banner: Banner): boolean {
    return !!(
      banner.title ||
      banner.subtitle ||
      banner.description ||
      banner.highlights.length ||
      banner.cta_text ||
      banner.cta2_text
    );
  }

  // ── navigation ─────────────────────────────────────────────────────────────
  next(): void {
    if (!this.banners.length) return;
    this.current.set((this.current() + 1) % this.banners.length);
  }

  prev(): void {
    if (!this.banners.length) return;
    this.current.set((this.current() - 1 + this.banners.length) % this.banners.length);
  }

  goTo(i: number): void {
    this.current.set(i);
  }

  go(link?: string | null): void {
    if (!link) return;
    if (/^https?:\/\//i.test(link)) {
      window.open(link, '_blank', 'noopener');
    } else {
      this.router.navigateByUrl(link);
    }
  }

  // ── autoplay ───────────────────────────────────────────────────────────────
  private startAuto(): void {
    this.stopAuto();
    if (this.banners.length > 1 && this.interval > 0) {
      this.timer = setInterval(() => {
        if (!this.paused) this.next();
      }, this.interval);
    }
  }

  private stopAuto(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  // ── swipe ──────────────────────────────────────────────────────────────────
  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.changedTouches[0].screenX;
    this.pause();
  }

  onTouchEnd(e: TouchEvent): void {
    const delta = e.changedTouches[0].screenX - this.touchStartX;
    if (Math.abs(delta) > 40) {
      delta < 0 ? this.next() : this.prev();
    }
    this.resume();
  }

  // ── keyboard ───────────────────────────────────────────────────────────────
  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowLeft') {
      this.prev();
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      this.next();
      e.preventDefault();
    }
  }
}
