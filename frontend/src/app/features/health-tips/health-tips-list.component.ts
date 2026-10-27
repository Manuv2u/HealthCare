import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { HEALTH_ARTICLES, articleImg } from './health-articles.data';
import { SeoService } from '../../core/services/seo.service';
import { buildBreadcrumbSchema, buildItemListSchema } from '../../core/seo/schema.util';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';

/**
 * "View All Articles" landing page for the Health Tips & Insights section.
 * Lists every hardcoded health article as a card linking to its read-more page.
 */
@Component({
  selector: 'app-health-tips-list',
  standalone: true,
  imports: [RouterLink, MatIconModule, BreadcrumbComponent],
  template: `
    <!-- ── HERO ─────────────────────────────────────────────── -->
    <section class="ht-hero">
      <div class="shell">
        <app-breadcrumb [items]="[{ label: 'Home', path: '/' }, { label: 'Blog' }]" />
        <span class="ht-eyebrow"><mat-icon>menu_book</mat-icon> Blog</span>
        <h1 class="ht-h1">Health Tips &amp; Insights</h1>
        <p class="ht-lead">
          Clear, doctor-backed guidance on common health conditions, preventive
          care and healthy living. Understanding your body is the first step
          toward protecting it — explore our articles below.
        </p>
      </div>
    </section>

    <!-- ── ARTICLE GRID ─────────────────────────────────────── -->
    <section class="ht-section">
      <div class="shell">
        <div class="ht-grid">
          @for (a of articles; track a.slug) {
            <a [routerLink]="['/blog', a.slug]" class="ht-card">
              <div class="ht-card__media">
                <img [src]="img(a.image, 600)" [alt]="a.title" loading="lazy" />
                <span class="ht-cat" [style.background]="a.accentBg" [style.color]="a.accent">
                  <mat-icon>{{ a.icon }}</mat-icon>{{ a.category }}
                </span>
              </div>
              <div class="ht-card__body">
                <div class="ht-meta"><mat-icon>schedule</mat-icon>{{ a.readingTime }}</div>
                <h2 class="ht-title">{{ a.title }}</h2>
                <p class="ht-desc">{{ a.excerpt }}</p>
                <span class="ht-more" [style.color]="a.accent">Read More <mat-icon>arrow_forward</mat-icon></span>
              </div>
            </a>
          }
        </div>

        <!-- CTA strip -->
        <div class="ht-cta">
          <div>
            <h3>Turn knowledge into action</h3>
            <p>Book a preventive health checkup and stay ahead of hidden health risks.</p>
          </div>
          <a routerLink="/packages" class="btn-primary btn-primary--lg">Book a Health Checkup <mat-icon>arrow_forward</mat-icon></a>
        </div>
      </div>
    </section>
  `,
  styleUrl: './health-tips-list.component.scss',
})
export class HealthTipsListComponent implements OnInit {
  private readonly seo = inject(SeoService);

  articles = HEALTH_ARTICLES;
  img = articleImg;

  ngOnInit(): void {
    this.seo.setPage({
      title: 'Blog — Health Tips & Insights',
      description:
        'Doctor-backed articles on preventive care, common health conditions and healthy living from the Sri Health Plus medical team.',
      path: '/blog',
    });
    this.seo.setJsonLd('breadcrumb', buildBreadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog' },
    ]));
    this.seo.setJsonLd('itemlist', buildItemListSchema(
      this.articles.map((a) => ({ name: a.title, path: `/blog/${a.slug}` })),
    ));
  }
}
