import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { HEALTH_ARTICLES, HealthArticle, articleImg, findArticle } from './health-articles.data';
import { SeoService } from '../../core/services/seo.service';
import { buildBreadcrumbSchema } from '../../core/seo/schema.util';
import { ORG_INFO } from '../../core/seo/organization.data';

interface SafeVideo { title: string; url: SafeResourceUrl; }

/**
 * Read-more page for a single health article (/health-tips/:slug). Renders a
 * banner, the article body with inline illustrations, key takeaways, a
 * conclusion, a "Book a Health Checkup" CTA and 1–2 embedded YouTube videos.
 */
@Component({
  selector: 'app-health-tips-detail',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    @if (article(); as a) {
      <article class="art">
        <!-- ── BANNER ─────────────────────────────────────────── -->
        <header class="art-banner">
          <img [src]="img(a.image, 1600)" [alt]="a.title" class="art-banner__img" />
          <div class="art-banner__scrim"></div>
          <div class="art-banner__inner shell">
            <nav class="art-crumbs">
              <a routerLink="/">Home</a>
              <mat-icon>chevron_right</mat-icon>
              <a routerLink="/blog">Blog</a>
            </nav>
            <span class="art-cat" [style.background]="a.accentBg" [style.color]="a.accent">
              <mat-icon>{{ a.icon }}</mat-icon>{{ a.category }}
            </span>
            <h1 class="art-title">{{ a.title }}</h1>
            <div class="art-meta">
              <span><mat-icon>schedule</mat-icon>{{ a.readingTime }}</span>
              <span><mat-icon>verified</mat-icon>Reviewed by Sri Health Plus medical team</span>
            </div>
          </div>
        </header>

        <!-- ── BODY ───────────────────────────────────────────── -->
        <div class="shell art-body">
          <p class="art-intro">{{ a.intro }}</p>

          @for (s of a.sections; track s.heading) {
            <section class="art-sec">
              <h2 class="art-h2" [style.borderColor]="a.accent">{{ s.heading }}</h2>
              @if (s.body) { <p class="art-p">{{ s.body }}</p> }
              @if (s.points?.length) {
                <ul class="art-list">
                  @for (p of s.points; track p) {
                    <li><mat-icon [style.color]="a.accent">check_circle</mat-icon><span>{{ p }}</span></li>
                  }
                </ul>
              }
              @if (s.image) {
                <figure class="art-figure">
                  <img [src]="img(s.image, 1000)" [alt]="s.imageAlt || s.heading" loading="lazy" />
                </figure>
              }
            </section>
          }

          <!-- Key takeaways -->
          <aside class="art-takeaways" [style.background]="a.accentBg">
            <h3><mat-icon [style.color]="a.accent">lightbulb</mat-icon> Key Takeaways</h3>
            <ul>
              @for (k of a.keyTakeaways; track k) {
                <li><mat-icon [style.color]="a.accent">done</mat-icon><span>{{ k }}</span></li>
              }
            </ul>
          </aside>

          <!-- Conclusion -->
          <section class="art-sec">
            <h2 class="art-h2" [style.borderColor]="a.accent">Conclusion</h2>
            <p class="art-p">{{ a.conclusion }}</p>
          </section>

          <!-- CTA -->
          <div class="art-cta">
            <div class="art-cta__copy">
              <h3>Ready to take charge of your health?</h3>
              <p>Book a preventive health checkup with Sri Health Plus — NABL-accredited lab, home sample collection and same-day digital reports.</p>
            </div>
            <div class="art-cta__actions">
              <a routerLink="/packages" class="btn-cta">Book a Health Checkup <mat-icon>arrow_forward</mat-icon></a>
              <a routerLink="/tests" class="btn-cta-ghost">Browse Tests</a>
            </div>
          </div>

          <!-- Videos -->
          <section class="art-videos">
            <div class="art-videos__head">
              <span class="art-eyebrow"><mat-icon>play_circle</mat-icon> Watch &amp; Learn</span>
              <h2 class="art-h2 art-h2--plain">Learn more in these videos</h2>
            </div>
            <div class="art-videos__grid" [class.single]="videos().length === 1">
              @for (v of videos(); track v.title) {
                <div class="art-video">
                  <div class="art-video__frame">
                    <iframe
                      [src]="v.url"
                      title="{{ v.title }}"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerpolicy="strict-origin-when-cross-origin"
                      allowfullscreen></iframe>
                  </div>
                  <p class="art-video__title">{{ v.title }}</p>
                </div>
              }
            </div>
          </section>
        </div>

        <!-- ── RELATED ────────────────────────────────────────── -->
        @if (related().length) {
          <section class="art-related">
            <div class="shell">
              <h2 class="art-related__title">More Health Tips &amp; Insights</h2>
              <div class="art-related__grid">
                @for (r of related(); track r.slug) {
                  <a [routerLink]="['/blog', r.slug]" class="rel-card">
                    <div class="rel-card__media">
                      <img [src]="img(r.image, 500)" [alt]="r.title" loading="lazy" />
                      <span class="rel-cat" [style.background]="r.accentBg" [style.color]="r.accent">{{ r.category }}</span>
                    </div>
                    <div class="rel-card__body">
                      <div class="rel-meta"><mat-icon>schedule</mat-icon>{{ r.readingTime }}</div>
                      <h3 class="rel-title">{{ r.title }}</h3>
                    </div>
                  </a>
                }
              </div>
            </div>
          </section>
        }
      </article>
    } @else {
      <section class="art-missing shell">
        <mat-icon>search_off</mat-icon>
        <h1>Article not found</h1>
        <p>The article you're looking for doesn't exist or may have moved.</p>
        <a routerLink="/blog" class="btn-cta">View All Articles</a>
      </section>
    }
  `,
  styleUrl: './health-tips-detail.component.scss',
})
export class HealthTipsDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private seo = inject(SeoService);
  private sub?: Subscription;

  article = signal<HealthArticle | undefined>(undefined);
  videos = signal<SafeVideo[]>([]);
  related = signal<HealthArticle[]>([]);
  img = articleImg;

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? '';
      const found = findArticle(slug);
      this.article.set(found);

      if (found) {
        this.videos.set(
          found.videos.map((v) => ({
            title: v.title,
            url: this.sanitizer.bypassSecurityTrustResourceUrl(
              `https://www.youtube-nocookie.com/embed/${v.id}?rel=0`,
            ),
          })),
        );
        this.related.set(HEALTH_ARTICLES.filter((a) => a.slug !== slug).slice(0, 3));

        const heroImage = this.img(found.image, 1200);
        this.seo.setPage({
          title: found.title,
          description: found.excerpt,
          path: `/blog/${found.slug}`,
          image: heroImage,
        });
        this.seo.setJsonLd('breadcrumb', buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
          { name: found.title, path: `/blog/${found.slug}` },
        ]));
        this.seo.setJsonLd('article', {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: found.title,
          description: found.excerpt,
          image: heroImage,
          author: { '@type': 'Organization', name: ORG_INFO.name },
          publisher: { '@type': 'Organization', name: ORG_INFO.name, logo: { '@type': 'ImageObject', url: ORG_INFO.logo } },
          mainEntityOfPage: this.seo.absoluteUrl(`/blog/${found.slug}`),
        });
      } else {
        this.videos.set([]);
        this.related.set([]);
        this.seo.clearJsonLd('breadcrumb');
        this.seo.clearJsonLd('article');
      }
      // Scroll-to-top on navigation (incl. related-article clicks) is handled
      // globally in AppComponent's NavigationEnd subscription.
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
