import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TestApiService } from '../../../core/api/services/test-api.service';
import { FeatureCardItem, RecommendedFor, Test } from '../../../core/api/api.types';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorBannerComponent } from '../../../shared/components/error-banner.component';
import { ActionCardsComponent } from '../../../shared/components/action-cards/action-cards.component';
import { FaqAccordionComponent } from '../../../shared/components/faq-accordion/faq-accordion.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { SeoService } from '../../../core/services/seo.service';
import { buildBreadcrumbSchema } from '../../../core/seo/schema.util';

// Per-category theming — mirrors the test catalog so the detail page feels cohesive.
// Single-accent teal: categories are differentiated by icon, not colour.
const CATEGORY_META: Record<string, { icon: string; color: string; light: string; border: string }> = {
  'Diabetes':       { icon: 'water_drop',       color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
  'Heart':          { icon: 'favorite',         color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
  'Kidney':         { icon: 'opacity',          color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
  'Liver':          { icon: 'eco',              color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
  'Thyroid':        { icon: 'psychology',       color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
  'Full Body':      { icon: 'accessibility_new',color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
  "Women's Health": { icon: 'spa',              color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
  'Vitamin':        { icon: 'wb_sunny',         color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
};

const DEFAULT_META = { icon: 'science', color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' };

const RECOMMENDED_FOR_LABELS: Record<RecommendedFor, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other (Transgender)',
};

@Component({
  selector: 'app-test-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink, MatIconModule, LoadingSpinnerComponent, ErrorBannerComponent,
    ActionCardsComponent, FaqAccordionComponent, BreadcrumbComponent,
  ],
  template: `
    <div class="detail-page">
      <app-loading-spinner *ngIf="loading()" />
      <app-error-banner *ngIf="error()" [message]="error()!" />

      @if (test(); as t) {
        <app-breadcrumb [items]="[{ label: 'Home', path: '/' }, { label: 'Browse Tests', path: '/tests' }, { label: t.name }]" />
        <a routerLink="/tests" class="back-link">
          <mat-icon>arrow_back</mat-icon> Back to Tests
        </a>

        <div class="detail-layout" [style.--cat-color]="meta().color" [style.--cat-light]="meta().light" [style.--cat-border]="meta().border">
          <div class="main-col">
            <article class="detail-card">
              <div class="card-accent"></div>

              <div class="card-inner">
                <div class="head">
                  <div class="head-left">
                    <span class="cat-badge">
                      <mat-icon>{{ meta().icon }}</mat-icon>
                      {{ t.category }}
                    </span>
                    <h1 class="title">{{ t.name }}</h1>
                  </div>
                  @if (t.discount_percentage > 0) {
                    <span class="discount-pill">{{ t.discount_percentage }}% off</span>
                  }
                </div>

                @if (t.description) {
                  <p class="desc">{{ t.description }}</p>
                }

                <div class="trust-row">
                  <span class="trust-tag">
                    <mat-icon>schedule</mat-icon> {{ t.turnaround_hours }}h results
                  </span>
                  <span class="trust-tag home">
                    <mat-icon>home</mat-icon> Free home collection
                  </span>
                  <span class="trust-tag">
                    <mat-icon>verified</mat-icon> NABL certified
                  </span>
                </div>

                @if (t.sample_type || recommendedForLabel(t) || t.turnaround_hours) {
                  <div class="info-badges">
                    @if (t.sample_type) {
                      <span class="info-badge">
                        <mat-icon>water_drop</mat-icon>
                        <span><b>Sample Type:</b> {{ t.sample_type }}</span>
                      </span>
                    }
                    @if (recommendedForLabel(t); as rf) {
                      <span class="info-badge">
                        <mat-icon>wc</mat-icon>
                        <span><b>Recommended For:</b> {{ rf }}</span>
                      </span>
                    }
                    <span class="info-badge">
                      <mat-icon>schedule</mat-icon>
                      <span><b>Report:</b> Within {{ t.turnaround_hours }} Hours</span>
                    </span>
                  </div>
                }
              </div>
            </article>

            @if (visibleFeatureCards(t).length) {
              <section class="feature-section">
                <h2 class="section-title">Why Choose This Test</h2>
                <div class="feature-grid">
                  @for (card of visibleFeatureCards(t); track card.title + card.order) {
                    <div class="feature-card">
                      <span class="feature-icon"><mat-icon>{{ card.icon }}</mat-icon></span>
                      <span class="feature-title">{{ card.title }}</span>
                    </div>
                  }
                </div>
              </section>
            }

            @if (t.faqs && t.faqs.length) {
              <section class="faq-section">
                <h2 class="section-title">Frequently Asked Questions</h2>
                <app-faq-accordion [items]="t.faqs" />
              </section>
            }
          </div>

          <aside class="sidebar-col">
            <div class="price-card">
              <div class="price">
                @if (t.discount_percentage > 0) {
                  <span class="price-orig">₹{{ t.price }}</span>
                }
                <span class="price-eff">₹{{ t.effective_price }}</span>
              </div>
              <button type="button" class="book-btn" (click)="addToBooking()">
                <mat-icon>calendar_today</mat-icon> Book Now
              </button>
            </div>

            <app-action-cards layout="stack" />
          </aside>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      background: #F8F9FF;
      min-height: 100%;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; }

    .detail-page { max-width: 1140px; margin: 0 auto; padding: 1.75rem 1.5rem 4rem; }

    .back-link {
      display: inline-flex; align-items: center; gap: .35rem;
      color: #64748B; font-size: .85rem; font-weight: 600;
      text-decoration: none; margin-bottom: 1.25rem;
      transition: color .15s;
    }
    .back-link:hover { color: #0047CC; }
    .back-link mat-icon { font-size: 1.05rem; width: 1.05rem; height: 1.05rem; }

    .detail-layout {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 1.5rem;
      align-items: start;
    }
    .main-col { display: flex; flex-direction: column; gap: 1.5rem; min-width: 0; }
    .sidebar-col {
      display: flex; flex-direction: column; gap: 1rem;
      position: sticky; top: 1.5rem;
    }

    .detail-card {
      background: #fff; border-radius: 20px; border: 1px solid #E2E8F0;
      box-shadow: 0 4px 20px rgba(0, 71, 204,.08), 0 1px 4px rgba(0,0,0,.05);
      overflow: hidden;
    }
    .card-accent { height: 5px; background: var(--cat-color, #0047CC); }
    .card-inner { padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem; }

    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
    .head-left { display: flex; flex-direction: column; gap: .6rem; min-width: 0; }
    .cat-badge {
      display: inline-flex; align-items: center; gap: .3rem; align-self: flex-start;
      font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
      color: var(--cat-color, #0047CC); background: var(--cat-light, #EEF4FF);
      border: 1px solid var(--cat-border, #B3CAFF);
      padding: .25rem .6rem; border-radius: 999px;
    }
    .cat-badge mat-icon { font-size: .85rem; width: .85rem; height: .85rem; }
    .title {
      font-size: 1.75rem; font-weight: 800; color: #0F172A;
      line-height: 1.2; letter-spacing: -.01em; margin: 0;
    }
    .discount-pill {
      flex-shrink: 0; font-size: .78rem; font-weight: 700;
      background: #DCFCE7; color: #15803D;
      padding: .3rem .7rem; border-radius: 999px; white-space: nowrap;
    }

    .desc { font-size: .95rem; color: #475569; line-height: 1.7; margin: 0; }

    .trust-row { display: flex; gap: .6rem; flex-wrap: wrap; }
    .trust-tag {
      display: inline-flex; align-items: center; gap: .3rem;
      font-size: .78rem; font-weight: 500; color: #64748B;
      background: #F8FAFC; border: 1px solid #F1F5F9;
      padding: .3rem .65rem; border-radius: 8px;
    }
    .trust-tag mat-icon { font-size: .85rem; width: .85rem; height: .85rem; color: #94A3B8; }
    .trust-tag.home mat-icon { color: #22C55E; }

    .info-badges {
      display: flex; flex-direction: column; gap: .6rem;
      padding: 1.1rem 1.25rem;
      background: #F8FAFC; border: 1px solid #F1F5F9; border-radius: 14px;
    }
    .info-badge {
      display: flex; align-items: center; gap: .6rem;
      font-size: .88rem; color: #334155;
    }
    .info-badge mat-icon { font-size: 1.15rem; width: 1.15rem; height: 1.15rem; color: var(--cat-color, #0047CC); flex-shrink: 0; }
    .info-badge b { font-weight: 700; color: #0F172A; }

    .section-title { font-size: 1.15rem; font-weight: 800; color: #0F172A; margin: 0 0 1rem 0; }

    .feature-section, .faq-section {
      background: #fff; border-radius: 20px; border: 1px solid #E2E8F0;
      padding: 1.75rem 2rem;
      box-shadow: 0 4px 20px rgba(0, 71, 204,.06), 0 1px 4px rgba(0,0,0,.04);
    }
    .feature-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 1rem;
    }
    .feature-card {
      display: flex; align-items: center; gap: .85rem;
      padding: 1rem 1.1rem;
      background: #F8FAFC; border: 1px solid #F1F5F9; border-radius: 14px;
      transition: transform .15s, box-shadow .15s, border-color .15s;
    }
    .feature-card:hover {
      transform: translateY(-2px);
      border-color: var(--cat-border, #B3CAFF);
      box-shadow: 0 8px 20px -8px rgba(0, 71, 204,.25);
    }
    .feature-icon {
      width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: var(--cat-light, #EEF4FF); color: var(--cat-color, #0047CC);
    }
    .feature-icon mat-icon { font-size: 1.3rem; width: 1.3rem; height: 1.3rem; }
    .feature-title { font-size: .9rem; font-weight: 600; color: #1E293B; line-height: 1.35; }

    .price-card {
      background: #fff; border-radius: 20px; border: 1px solid #E2E8F0;
      box-shadow: 0 4px 20px rgba(0, 71, 204,.08), 0 1px 4px rgba(0,0,0,.05);
      padding: 1.5rem;
      display: flex; flex-direction: column; gap: 1.1rem;
    }
    .price { display: flex; align-items: baseline; gap: .6rem; font-variant-numeric: tabular-nums; }
    .price-orig { font-size: 1rem; color: #94A3B8; text-decoration: line-through; }
    .price-eff {
      font-size: 2rem; font-weight: 800; color: #003399;
      line-height: 1; letter-spacing: -.02em;
    }
    .book-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: .45rem;
      background: #0047CC; color: #fff; border: none; border-radius: 12px;
      padding: .85rem 1.6rem; font-size: .95rem; font-weight: 700; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 71, 204,.35);
      transition: background .18s, transform .15s, box-shadow .18s;
    }
    .book-btn:hover { background: #003399; box-shadow: 0 6px 18px rgba(0, 71, 204,.45); transform: translateY(-1px); }
    .book-btn:active { transform: translateY(0); }
    .book-btn mat-icon { font-size: 1.05rem; width: 1.05rem; height: 1.05rem; }

    @media (max-width: 900px) {
      .detail-layout { grid-template-columns: 1fr; }
      .sidebar-col { position: static; }
    }

    @media (max-width: 560px) {
      .card-inner { padding: 1.5rem 1.25rem; }
      .title { font-size: 1.45rem; }
      .feature-section, .faq-section { padding: 1.35rem 1.25rem; }
    }
  `],
})
export class TestDetailComponent implements OnInit {
  test = signal<Test | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private testApi: TestApiService,
    private seo: SeoService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.testApi.get(id).subscribe({
      next: (t) => {
        this.test.set(t);
        this.loading.set(false);

        this.seo.setPage({
          title: t.name,
          description: t.description || `Book the ${t.name} at Sri Health Plus — NABL-certified results in ${t.turnaround_hours} hours, with free home sample collection.`,
          path: `/tests/${t.id}`,
        });
        this.seo.setJsonLd('breadcrumb', buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Browse Tests', path: '/tests' },
          { name: t.name, path: `/tests/${t.id}` },
        ]));
        this.seo.setJsonLd('medicaltest', {
          '@context': 'https://schema.org',
          '@type': 'MedicalTest',
          name: t.name,
          description: t.description || undefined,
          offers: {
            '@type': 'Offer',
            price: t.effective_price,
            priceCurrency: 'INR',
            availability: 'https://schema.org/InStock',
            url: this.seo.absoluteUrl(`/tests/${t.id}`),
          },
        });
      },
      error: () => { this.error.set('Test not found.'); this.loading.set(false); },
    });
  }

  /** Category-based theming (icon + colors) for the current test. */
  meta(): { icon: string; color: string; light: string; border: string } {
    return CATEGORY_META[this.test()?.category ?? ''] ?? DEFAULT_META;
  }

  recommendedForLabel(t: Test): string | null {
    if (!t.recommended_for || t.recommended_for.length === 0) return null;
    return t.recommended_for.map((v) => RECOMMENDED_FOR_LABELS[v]).join(', ');
  }

  visibleFeatureCards(t: Test): FeatureCardItem[] {
    return (t.feature_cards ?? [])
      .filter((c) => c.enabled)
      .sort((a, b) => a.order - b.order);
  }

  addToBooking(): void {
    this.router.navigate(['/booking'], { queryParams: { test_id: this.test()?.id } });
  }
}
