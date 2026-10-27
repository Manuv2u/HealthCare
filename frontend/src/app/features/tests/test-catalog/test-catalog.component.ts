import { Component, OnInit, signal, computed, effect, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TestApiService } from '../../../core/api/services/test-api.service';
import { HealthConcernApiService } from '../../../core/api/services/health-concern-api.service';
import { UserApiService } from '../../../core/api/services/user-api.service';
import { HealthImageComponent } from '../../../shared/components/health-image/health-image.component';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { Test, HealthConcern } from '../../../core/api/api.types';
import { SeoService } from '../../../core/services/seo.service';
import { buildBreadcrumbSchema, buildItemListSchema } from '../../../core/seo/schema.util';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';

const CATEGORY_META: Record<string, { icon: string; color: string; light: string; border: string }> = {
  'Diabetes':       { icon: 'water_drop',      color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
  'Heart':          { icon: 'favorite',         color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
  'Kidney':         { icon: 'opacity',          color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
  'Liver':          { icon: 'eco',              color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
  'Thyroid':        { icon: 'psychology',       color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
  'Full Body':      { icon: 'accessibility_new',color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
  "Women's Health": { icon: 'spa',              color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
  'Vitamin':        { icon: 'wb_sunny',         color: '#0047CC', light: '#EEF4FF', border: '#B3CAFF' },
};

const CATEGORY_ICONS = [
  { label: 'All',           icon: 'apps',             key: null },
  { label: 'Diabetes',      icon: 'water_drop',       key: 'Diabetes' },
  { label: 'Heart',         icon: 'favorite',         key: 'Heart' },
  { label: 'Kidney',        icon: 'opacity',          key: 'Kidney' },
  { label: 'Liver',         icon: 'eco',              key: 'Liver' },
  { label: 'Thyroid',       icon: 'psychology',       key: 'Thyroid' },
  { label: 'Full Body',     icon: 'accessibility_new',key: 'Full Body' },
  { label: "Women's Health",icon: 'spa',              key: "Women's Health" },
  { label: 'Vitamin',       icon: 'wb_sunny',         key: 'Vitamin' },
];

/**
 * Medical abbreviation / synonym expansion map.
 * Keys and values are stored normalized (lowercase, no punctuation).
 * When a user query matches a key, the expansions are treated as aliases
 * of the query so that e.g. "cbc" surfaces "Complete Blood Count".
 */
const SEARCH_SYNONYMS: Record<string, string[]> = {
  'cbc': ['complete blood count'],
  'fbs': ['fasting blood sugar', 'blood sugar fasting', 'glucose fasting'],
  'ppbs': ['post prandial blood sugar', 'blood sugar post prandial'],
  'rbs': ['random blood sugar'],
  'lft': ['liver function test'],
  'kft': ['kidney function test', 'renal function test'],
  'rft': ['renal function test', 'kidney function test'],
  'crp': ['c reactive protein'],
  'esr': ['erythrocyte sedimentation rate'],
  'tsh': ['thyroid stimulating hormone', 'thyroid'],
  'hba1c': ['glycated haemoglobin', 'glycosylated hemoglobin', 'glycated hemoglobin'],
  'typhoid': ['widal', 'salmonella', 'enteric fever'],
  'widal': ['typhoid', 'salmonella'],
  'lipid': ['cholesterol', 'lipid profile'],
  'cholesterol': ['lipid'],
  'sugar': ['glucose'],
  'glucose': ['sugar'],
  'diabetes': ['sugar', 'glucose', 'hba1c'],
  'thyroid': ['tsh', 't3', 't4'],
  'vitamin d': ['25 hydroxy', 'cholecalciferol'],
  'vit d': ['vitamin d', '25 hydroxy'],
  'bp': ['blood pressure'],
  'cardiac': ['heart'],
  'renal': ['kidney'],
  'hepatic': ['liver'],
};

/** Lowercase, strip punctuation to spaces, collapse whitespace. */
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

/** Alias phrases for the query, derived from the synonym map. */
function expandQuery(normalized: string, tokens: string[]): string[] {
  const out = new Set<string>();
  if (SEARCH_SYNONYMS[normalized]) SEARCH_SYNONYMS[normalized].forEach(e => out.add(e));
  tokens.forEach(t => {
    if (SEARCH_SYNONYMS[t]) SEARCH_SYNONYMS[t].forEach(e => out.add(e));
  });
  return Array.from(out);
}

interface ScoredTest { test: Test; score: number; }

/**
 * Relevance score for a single test against a query.
 * Higher = more relevant. 0 = no match (test is excluded).
 * Priority tiers follow the product spec: exact name > starts-with >
 * partial name > all-tokens name > alias > some-token name > description > category.
 */
function scoreTest(test: Test, qNorm: string, tokens: string[], expansions: string[]): number {
  const name = normalizeText(test.name);
  const desc = normalizeText(test.description ?? '');
  const cat = normalizeText(test.category ?? '');

  if (name === qNorm) return 1000;                                   // exact name
  if (name.startsWith(qNorm)) return 850;                            // starts with
  if (name.includes(qNorm)) return 700;                              // partial name (contiguous)
  if (tokens.length && tokens.every(t => name.includes(t))) return 600; // all tokens in name
  if (expansions.some(e => name.includes(e))) return 500;            // alias / synonym in name
  if (tokens.some(t => t.length >= 3 && name.includes(t))) return 400; // some token in name

  // description matches (query, tokens, or aliases)
  if (desc.includes(qNorm) ||
      tokens.some(t => t.length >= 3 && desc.includes(t)) ||
      expansions.some(e => desc.includes(e))) return 250;

  // category matches (lowest priority)
  if (cat.includes(qNorm) ||
      tokens.some(t => t.length >= 3 && cat.includes(t)) ||
      expansions.some(e => cat.includes(e))) return 100;

  return 0;
}

@Component({
  selector: 'app-test-catalog',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, MatIconModule, HealthImageComponent, BreadcrumbComponent],
  template: `
    <!-- ═══════════════════════════════════════════════
         HERO BANNER
    ════════════════════════════════════════════════ -->
    <section class="hero">
      <div class="hero-bg-shapes" aria-hidden="true">
        <span class="shape shape-1"></span>
        <span class="shape shape-2"></span>
        <span class="shape shape-3"></span>
      </div>
      <div class="hero-inner">
        <app-breadcrumb [items]="[{ label: 'Home', path: '/' }, { label: 'Browse Tests' }]" />
        <p class="hero-eyebrow">
          <mat-icon class="eyebrow-icon">verified</mat-icon>
          NABL Certified Labs · Free Home Collection
        </p>
        <h1 class="hero-headline">Find the right<br>test for you</h1>
        <p class="hero-sub">Trusted by 3500+ patients · Results within 24 hours</p>

        <div class="hero-search-wrap">
          <div class="hero-search" [class.focused]="searchFocused">
            <mat-icon class="search-icon">search</mat-icon>
            <input
              #searchInput
              [formControl]="searchCtrl"
              placeholder="Search CBC, Thyroid, HbA1c, Lipid Panel…"
              autocomplete="off"
              (focus)="onSearchFocus()"
              (blur)="onSearchBlur()"
              (keydown.escape)="closeSuggestions()"
              (keydown.enter)="closeSuggestions()"
              class="search-input"
            />
            @if (searchCtrl.value) {
              <button class="search-clear" (click)="clearSearch()" aria-label="Clear search">
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>

          <!-- AUTOCOMPLETE SUGGESTIONS -->
          @if (searchFocused && suggestions().length > 0) {
            <ul class="search-suggest" role="listbox">
              @for (s of suggestions(); track s.id) {
                <li class="suggest-item" role="option"
                    (mousedown)="selectSuggestion(s.name); $event.preventDefault()">
                  <mat-icon class="suggest-icon">search</mat-icon>
                  <span class="suggest-text" [innerHTML]="highlight(s.name)"></span>
                  <span class="suggest-cat">{{ s.category }}</span>
                </li>
              }
            </ul>
          }

          @if (hasActiveSearch()) {
            <div class="search-hint">
              <mat-icon>info_outline</mat-icon>
              {{ searchResults().length }} result{{ searchResults().length !== 1 ? 's' : '' }} for "{{ searchQuery() }}"
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════
         CATEGORY PILLS — sticky below hero
    ════════════════════════════════════════════════ -->
    <div class="cats-bar-wrap">
      <div class="cats-fade cats-fade--left" [class.visible]="canScrollLeft()"></div>
      <div class="cats-fade cats-fade--right" [class.visible]="canScrollRight()"></div>
      <nav class="cats-bar" #catsBar aria-label="Filter by category"
           (scroll)="updateCatsFade()" (wheel)="onCatsWheel($event)">
        @for (cat of categoryChips(); track $index) {
          <button
            class="cat-chip"
            [class.active]="selectedCategory() === cat.key"
            [class.dimmed]="cat.key !== null && getCatCount(cat.key) === 0"
            [style.--chip-color]="getCatColor(cat.key)"
            [style.--chip-light]="getCatLight(cat.key)"
            [style.--chip-border]="getCatBorder(cat.key)"
            (click)="selectCategory(cat.key)"
          >
            <mat-icon class="chip-icon">{{ cat.icon }}</mat-icon>
            <span class="chip-label">{{ cat.label }}</span>
            @if (cat.key !== null) {
              <span class="chip-count">{{ getCatCount(cat.key) }}</span>
            } @else {
              <span class="chip-count">{{ searchResults().length }}</span>
            }
          </button>
        }
      </nav>
    </div>

    <!-- ═══════════════════════════════════════════════
         MAIN CONTENT
    ════════════════════════════════════════════════ -->
    <main class="content-wrap">

      <!-- Recommended / concern banners — hidden whenever a search or category filter is active -->
      @if (!hasActiveFilters()) {
        @if (selectedConcernKeys().length) {
          <div class="concern-banner">
            <div>
              <h2 class="concern-heading">Recommended Tests for {{ concernNames() }}</h2>
              <p class="concern-sub">Curated based on the health concern(s) you selected.</p>
            </div>
            <button class="btn-clear-filters" (click)="clearConcernFilter()">
              <mat-icon>close</mat-icon> Clear filter
            </button>
          </div>
        } @else if (savedConcernNames()) {
          <div class="concern-banner concern-banner--suggestion">
            <div>
              <h2 class="concern-heading">Recommended for you</h2>
              <p class="concern-sub">Based on your saved interest in {{ savedConcernNames() }}.</p>
            </div>
            <button class="btn-clear-filters" (click)="applySavedConcerns()">
              <mat-icon>arrow_forward</mat-icon> Show recommended
            </button>
          </div>
        }
      }

      <!-- LOADING SKELETONS -->
      @if (loading()) {
        <div class="skeletons-featured">
          <div class="skeleton-feat"></div>
        </div>
        <div class="tests-grid">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="skeleton-card">
              <div class="sk-top"></div>
              <div class="sk-title"></div>
              <div class="sk-line"></div>
              <div class="sk-line sk-short"></div>
              <div class="sk-footer">
                <div class="sk-price"></div>
                <div class="sk-btn"></div>
              </div>
            </div>
          }
        </div>
      } @else if (error()) {
        <div class="state-panel error-panel">
          <div class="state-icon-wrap error-icon-wrap">
            <mat-icon>wifi_off</mat-icon>
          </div>
          <h3>Could not load tests</h3>
          <p>{{ error() }}</p>
          <button class="btn-primary" (click)="load()">
            <mat-icon>refresh</mat-icon> Try Again
          </button>
        </div>
      } @else {

        <!-- RESULT COUNT BAR -->
        <div class="result-bar">
          <span class="result-count">
            @if (selectedCategory()) {
              <strong>{{ selectedCategory() }}</strong> ·
            }
            {{ finalTests().length }} test{{ finalTests().length !== 1 ? 's' : '' }}
            @if (hasActiveSearch()) { matching "{{ searchQuery() }}" }
          </span>
          @if (hasActiveFilters()) {
            <button class="btn-clear-filters" (click)="clearFilters()">
              <mat-icon>tune</mat-icon> Clear filters
            </button>
          }
        </div>

        <!-- FEATURED CARD — only in pure browse mode (no search, no category) -->
        @if (finalTests().length > 0 && !hasActiveFilters()) {
          <div class="featured-card" (click)="book(finalTests()[0])" role="button" tabindex="0"
               (keydown.enter)="book(finalTests()[0])" (keydown.space)="book(finalTests()[0])">
            <div class="featured-left-bar" [style.background]="getFeaturedGradient()"></div>

            <div class="featured-body">
              <div class="featured-info">
                <div class="featured-header-row">
                  @if (finalTests()[0].is_popular) {
                    <span class="featured-badge">
                      <mat-icon>local_fire_department</mat-icon> Most Popular
                    </span>
                  }
                  <span class="featured-cat-chip"
                        [style.background]="getCatLight(finalTests()[0].category)"
                        [style.color]="getCatColor(finalTests()[0].category)"
                        [style.border-color]="getCatBorder(finalTests()[0].category)">
                    <mat-icon>{{ getCatIcon(finalTests()[0].category) }}</mat-icon>
                    {{ finalTests()[0].category }}
                  </span>
                </div>
                <h2 class="featured-name">{{ finalTests()[0].name }}</h2>
                @if (finalTests()[0].description) {
                  <p class="featured-desc">{{ finalTests()[0].description }}</p>
                }
                <div class="featured-meta-row">
                  <span class="meta-tag">
                    <mat-icon>schedule</mat-icon>
                    {{ finalTests()[0].turnaround_hours }}h results
                  </span>
                  <span class="meta-tag">
                    <mat-icon>home</mat-icon>
                    Free home collection
                  </span>
                  <span class="meta-tag">
                    <mat-icon>verified</mat-icon>
                    NABL Certified
                  </span>
                </div>
              </div>

              <div class="featured-action">
                <div class="featured-price-block">
                  @if (finalTests()[0].discount_percentage > 0) {
                    <span class="feat-price-orig">₹{{ finalTests()[0].price }}</span>
                    <span class="feat-discount-pill">{{ finalTests()[0].discount_percentage }}% off</span>
                  }
                  <span class="feat-price-eff">₹{{ finalTests()[0].effective_price }}</span>
                </div>
                <button class="btn-book-featured" (click)="book(finalTests()[0]); $event.stopPropagation()">
                  Book Now
                  <mat-icon>arrow_forward</mat-icon>
                </button>
                <a [routerLink]="['/tests', finalTests()[0].id]" class="feat-details-link"
                   (click)="$event.stopPropagation()">View details</a>
              </div>
            </div>
          </div>
        }

        <!-- ═══ EMPTY STATES ═══ -->

        <!-- Category mismatch: search has matches, but none in the selected category -->
        @if (finalTests().length === 0 && hasActiveSearch() && searchResults().length > 0 && selectedCategory()) {
          <div class="state-panel empty-panel">
            <app-health-image class="empty-illus" name="empty-search" [rounded]="false" alt="No matching tests" />
            <h3>No {{ selectedCategory() }} tests found matching "{{ searchQuery() }}"</h3>
            <p>
              {{ searchResults().length }} test{{ searchResults().length !== 1 ? 's' : '' }}
              match "{{ searchQuery() }}" in other categories.
            </p>
            <div class="empty-actions">
              <button class="btn-primary" (click)="clearCategory()">
                <mat-icon>filter_alt</mat-icon> Clear Category Filter
              </button>
              <button class="btn-secondary" (click)="clearFilters()">Browse All Tests</button>
            </div>
          </div>
        } @else if (finalTests().length === 0 && hasActiveSearch()) {
          <div class="state-panel empty-panel">
            <app-health-image class="empty-illus" name="empty-search" [rounded]="false" alt="No tests found" />
            <h3>No tests found for "{{ searchQuery() }}"</h3>
            <p>Try one of these searches instead:</p>
            <div class="suggest-chips">
              @for (s of didYouMean(); track s) {
                <button class="suggest-chip" (click)="setSearch(s)">{{ s }}</button>
              }
            </div>
            <div class="empty-actions">
              <button class="btn-primary" (click)="clearFilters()">
                <mat-icon>tune</mat-icon> Clear Filters
              </button>
              <button class="btn-secondary" (click)="clearFilters()">Browse All Tests</button>
            </div>
          </div>
        } @else if (finalTests().length === 0) {
          <div class="state-panel empty-panel">
            <app-health-image class="empty-illus" name="empty-search" [rounded]="false" alt="No tests match" />
            <h3>No tests match your search.</h3>
            <p>Try a different keyword or browse all categories.</p>
            <div class="empty-actions">
              <button class="btn-primary" (click)="clearFilters()">
                <mat-icon>apps</mat-icon> View All Tests
              </button>
            </div>
          </div>
        } @else {
          <div class="tests-grid">
            @for (test of gridTests(); track test.id) {
              <article class="test-card"
                       [style.--cat-color]="getCatColor(test.category)"
                       [style.--cat-light]="getCatLight(test.category)"
                       [style.--cat-border]="getCatBorder(test.category)">
                <div class="card-top-bar"></div>
                <div class="card-body">
                  <div class="card-header-row">
                    <div class="card-badges-left">
                      <span class="card-cat-badge">
                        <mat-icon>{{ getCatIcon(test.category) }}</mat-icon>
                        {{ test.category }}
                      </span>
                      @if (test.is_popular) {
                        <span class="card-popular-badge">
                          <mat-icon>local_fire_department</mat-icon> Most Popular
                        </span>
                      }
                    </div>
                    @if (test.discount_percentage > 0) {
                      <span class="card-discount-badge">{{ test.discount_percentage }}% off</span>
                    }
                  </div>

                  <h3 class="card-name" [innerHTML]="highlight(test.name)"></h3>

                  @if (test.description) {
                    <p class="card-desc">{{ test.description }}</p>
                  }

                  <div class="card-tags-row">
                    <span class="card-tag">
                      <mat-icon>schedule</mat-icon> {{ test.turnaround_hours }}h
                    </span>
                    <span class="card-tag home-tag">
                      <mat-icon>home</mat-icon> Home collection
                    </span>
                  </div>

                  <div class="card-footer">
                    <div class="card-price">
                      @if (test.discount_percentage > 0) {
                        <span class="card-price-orig">₹{{ test.price }}</span>
                      }
                      <span class="card-price-eff">₹{{ test.effective_price }}</span>
                    </div>
                    <div class="card-actions">
                      <a [routerLink]="['/tests', test.id]" class="btn-details-sm">Details</a>
                      <button class="btn-book-sm" (click)="book(test)">
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            }
          </div>

          <!-- PAGINATION -->
          @if (totalPages() > 1) {
            <div class="pagination">
              <button class="page-btn" [disabled]="page() === 1" (click)="changePage(page() - 1)" aria-label="Previous page">
                <mat-icon>chevron_left</mat-icon>
              </button>
              @for (p of pageRange(); track p) {
                <button class="page-num" [class.active]="p === page()" (click)="changePage(p)">{{ p }}</button>
              }
              <button class="page-btn" [disabled]="page() === totalPages()" (click)="changePage(page() + 1)" aria-label="Next page">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
          }
        }

      }
    </main>
  `,
  styles: [`
    /* ─── RESET / BASE ──────────────────────────── */
    :host { display:block; font-family:'Inter',system-ui,-apple-system,sans-serif; background:#F8F9FF; }
    *, *::before, *::after { box-sizing:border-box; }
    button { font-family:inherit; cursor:pointer; }
    a { font-family:inherit; }

    /* ─── HERO ───────────────────────────────────── */
    .hero {
      position:relative;
      background:
        linear-gradient(180deg, rgba(255,255,255,0) 55%, rgba(255,255,255,.85) 100%),
        linear-gradient(90deg, #EEF4FF 0%, rgba(238,244,255,.96) 40%, rgba(238,244,255,.62) 62%, rgba(238,244,255,.06) 100%),
        url('/assets/photos/home-diagnostics.jpg') right center / cover no-repeat;
      padding:2.75rem 1.5rem 2.5rem;
      overflow:hidden;
    }
    .hero-bg-shapes { position:absolute; inset:0; pointer-events:none; }
    .shape {
      position:absolute; border-radius:50%;
      background:none; border:1.5px solid rgba(0, 71, 204, .08);
    }
    .shape-1 { width:320px; height:320px; top:-80px; right:-60px; }
    .shape-2 { width:200px; height:200px; bottom:-60px; left:-40px; border-color:rgba(0, 71, 204, .06); }
    .shape-3 { width:120px; height:120px; top:50%; left:60%; border:none; background:rgba(0, 180, 174, .07); }

    .hero-inner {
      position:relative; z-index:1;
      max-width:680px; margin:0 auto; text-align:center;
      display:flex; flex-direction:column; align-items:center; gap:.75rem;
    }
    .hero-eyebrow {
      display:inline-flex; align-items:center; gap:.35rem;
      background:#E6F8F7; color:#007A76;
      font-size:.72rem; font-weight:600; letter-spacing:.08em;
      text-transform:uppercase; padding:.3rem .85rem; border-radius:999px;
      border:1px solid rgba(0, 180, 174, .28);
    }
    .eyebrow-icon { font-size:.85rem; width:.85rem; height:.85rem; color:#009994; }
    .hero-headline {
      font-family:'Poppins','Inter',system-ui,sans-serif;
      font-size:clamp(1.9rem, 5vw, 2.6rem); font-weight:700;
      color:#0D1F3C; line-height:1.15; text-wrap:balance;
      letter-spacing:-.02em; margin:0;
    }
    .hero-sub {
      font-size:.9rem; color:#64748B;
      margin:0; letter-spacing:.01em;
    }

    .hero-search-wrap { width:100%; max-width:560px; display:flex; flex-direction:column; gap:.5rem; margin-top:.5rem; position:relative; }
    .hero-search {
      display:flex; align-items:center; gap:.5rem;
      background:#fff;
      border-radius:14px; padding:.65rem 1rem;
      box-shadow:0 10px 30px rgba(13,31,60,.07), 0 2px 8px rgba(13,31,60,.04);
      border:1.5px solid #E2E8F0;
      transition:border-color .2s, box-shadow .2s;
    }
    .hero-search.focused {
      border-color:#0047CC;
      box-shadow:0 10px 30px rgba(0, 71, 204,.12), 0 0 0 4px rgba(0, 71, 204,.10);
    }
    .search-icon { color:#94A3B8; font-size:1.15rem; width:1.15rem; height:1.15rem; flex-shrink:0; }
    .search-input {
      flex:1; border:none; outline:none;
      font-size:.95rem; color:#0F172A; background:transparent;
      font-family:inherit;
    }
    .search-input::placeholder { color:#94A3B8; }
    .search-clear {
      background:none; border:none; padding:.1rem;
      display:flex; align-items:center;
      color:#94A3B8; transition:color .15s;
    }
    .search-clear:hover { color:#475569; }
    .search-clear mat-icon { font-size:1rem; width:1rem; height:1rem; }
    .search-hint {
      display:inline-flex; align-items:center; gap:.3rem;
      font-size:.8rem; color:#64748B; align-self:flex-start; padding-left:.25rem;
    }
    .search-hint mat-icon { font-size:.85rem; width:.85rem; height:.85rem; }

    /* ─── AUTOCOMPLETE SUGGESTIONS ───────────────── */
    .search-suggest {
      position:absolute; top:calc(100% + .35rem); left:0; right:0; z-index:60;
      margin:0; padding:.35rem; list-style:none;
      background:#fff; border-radius:14px;
      box-shadow:0 12px 40px rgba(13,31,60,.12), 0 2px 8px rgba(13,31,60,.06);
      border:1px solid #E2E8F0;
      max-height:340px; overflow-y:auto; text-align:left;
    }
    .suggest-item {
      display:flex; align-items:center; gap:.6rem;
      padding:.6rem .75rem; border-radius:10px; cursor:pointer;
      transition:background .12s;
    }
    .suggest-item:hover { background:#F1F5F9; }
    .suggest-icon { color:#94A3B8; font-size:1rem; width:1rem; height:1rem; flex-shrink:0; }
    .suggest-text { flex:1; font-size:.9rem; color:#0F172A; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .suggest-cat { font-size:.7rem; font-weight:600; color:#64748B; background:#F1F5F9; padding:.15rem .5rem; border-radius:999px; flex-shrink:0; }
    .suggest-text ::ng-deep mark, .card-name ::ng-deep mark {
      background:#FDE68A; color:inherit; border-radius:3px; padding:0 .1em; font-weight:700;
    }

    /* ─── CATEGORY PILLS BAR ─────────────────────── */
    .cats-bar-wrap {
      background:#fff;
      border-bottom:1px solid #E2E8F0;
      position:sticky; top:68px; z-index:40;
      box-shadow:0 2px 8px rgba(0,0,0,.05);
    }
    .cats-bar {
      display:flex; gap:.5rem; align-items:center;
      flex-wrap:nowrap;
      overflow-x:auto; padding:.75rem 1.5rem;
      max-width:1280px; margin:0 auto;
      scrollbar-width:none;
      scroll-behavior:smooth;
      -webkit-overflow-scrolling:touch;
      overscroll-behavior-x:contain;
      touch-action:pan-x;
    }
    .cats-bar::-webkit-scrollbar { display:none; }
    .cats-fade {
      position:absolute; top:0; bottom:0; width:2.5rem;
      pointer-events:none; z-index:1;
      opacity:0; transition:opacity .2s ease;
    }
    .cats-fade--left {
      left:0;
      background:linear-gradient(to right, #fff, rgba(255,255,255,0));
    }
    .cats-fade--right {
      right:0;
      background:linear-gradient(to left, #fff, rgba(255,255,255,0));
    }
    .cats-fade.visible { opacity:1; }

    .cat-chip {
      display:inline-flex; align-items:center; gap:.35rem;
      flex-shrink:0;
      padding:.4rem .9rem; border-radius:999px;
      border:1.5px solid #E2E8F0;
      background:#fff; color:#475569;
      font-size:.8rem; font-weight:600;
      transition:all .18s ease; white-space:nowrap;
    }
    .cat-chip:hover {
      border-color:var(--chip-color, #0047CC);
      color:var(--chip-color, #0047CC);
      background:var(--chip-light, #EEF4FF);
    }
    .cat-chip.active {
      background:var(--chip-color, #0047CC);
      border-color:var(--chip-color, #0047CC);
      color:#fff;
      box-shadow:0 4px 12px rgba(0, 71, 204, .2);
    }
    .cat-chip.active .chip-count { background:rgba(255,255,255,.25); color:#fff; }
    .cat-chip.dimmed { opacity:.4; }
    .cat-chip.dimmed:not(.active) { color:#94A3B8; }
    .chip-icon { font-size:.85rem; width:.85rem; height:.85rem; }
    .chip-label { line-height:1; }
    .chip-count {
      font-size:.68rem; font-weight:700;
      background:#F1F5F9; color:#64748B;
      padding:.1rem .35rem; border-radius:999px;
      transition:all .18s;
    }

    /* ─── CONTENT AREA ───────────────────────────── */
    .content-wrap {
      max-width:1280px; margin:0 auto;
      padding:1.75rem 1.5rem 4rem;
      display:flex; flex-direction:column; gap:1.5rem;
    }

    /* ─── RESULT BAR ─────────────────────────────── */
    .result-bar {
      display:flex; justify-content:space-between; align-items:center;
      flex-wrap:wrap; gap:.75rem;
    }
    .result-count { font-size:.875rem; color:#475569; }
    .result-count strong { color:#0F172A; font-weight:700; }
    .btn-clear-filters {
      display:inline-flex; align-items:center; gap:.3rem;
      background:none; border:1.5px solid #E2E8F0; border-radius:8px;
      padding:.3rem .75rem; font-size:.78rem; font-weight:600; color:#475569;
      transition:all .15s;
    }
    .btn-clear-filters:hover { border-color:#0047CC; color:#0047CC; }
    .btn-clear-filters mat-icon { font-size:.85rem; width:.85rem; height:.85rem; }

    .concern-banner {
      display:flex; align-items:center; justify-content:space-between; gap:1rem;
      flex-wrap:wrap;
      background:#EEF4FF; border:1px solid #B3CAFF; border-radius:14px;
      padding:1rem 1.25rem; margin-bottom:1.25rem;
    }
    .concern-banner--suggestion { background:#EEF4FF; border-color:#99F6E4; }
    .concern-heading { font-size:1.05rem; font-weight:700; color:#0F172A; margin:0 0 .2rem 0; }
    .concern-sub { font-size:.8rem; color:#475569; margin:0; }
    .concern-banner .btn-clear-filters { background:#fff; flex-shrink:0; }

    /* ─── FEATURED CARD ──────────────────────────── */
    .featured-card {
      background:#fff;
      border-radius:20px;
      border:1px solid #E2E8F0;
      box-shadow:0 4px 20px rgba(0, 71, 204,.1), 0 1px 4px rgba(0,0,0,.05);
      overflow:hidden; display:flex;
      cursor:pointer;
      transition:box-shadow .2s, transform .2s;
      position:relative;
    }
    .featured-card:hover {
      box-shadow:0 8px 32px rgba(0, 71, 204,.18), 0 2px 8px rgba(0,0,0,.08);
      transform:translateY(-2px);
    }
    .featured-card:focus-visible {
      outline:3px solid #0047CC; outline-offset:3px;
    }
    .featured-left-bar { width:5px; flex-shrink:0; }
    .featured-body {
      flex:1; display:flex; justify-content:space-between;
      align-items:flex-start; gap:2rem; flex-wrap:wrap;
      padding:1.75rem 1.75rem 1.75rem 1.5rem;
    }
    .featured-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:.6rem; }
    .featured-header-row { display:flex; align-items:center; gap:.65rem; flex-wrap:wrap; }
    .featured-badge {
      display:inline-flex; align-items:center; gap:.25rem;
      background:linear-gradient(135deg,#003399,#002577);
      color:#fff; font-size:.7rem; font-weight:700;
      padding:.2rem .6rem; border-radius:999px; letter-spacing:.04em;
    }
    .featured-badge mat-icon { font-size:.8rem; width:.8rem; height:.8rem; }
    .featured-cat-chip {
      display:inline-flex; align-items:center; gap:.25rem;
      font-size:.72rem; font-weight:600; padding:.2rem .6rem;
      border-radius:999px; border:1.5px solid transparent;
    }
    .featured-cat-chip mat-icon { font-size:.8rem; width:.8rem; height:.8rem; }
    .featured-name {
      font-size:1.3rem; font-weight:800; color:#0F172A;
      line-height:1.2; letter-spacing:-.01em; text-wrap:balance;
      margin:0;
    }
    .featured-desc {
      font-size:.875rem; color:#475569; line-height:1.65;
      margin:0; max-width:520px;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
    }
    .featured-meta-row { display:flex; gap:.65rem; flex-wrap:wrap; }
    .meta-tag {
      display:inline-flex; align-items:center; gap:.3rem;
      font-size:.75rem; font-weight:500; color:#64748B;
      background:#F8F9FF; padding:.25rem .6rem; border-radius:8px;
      border:1px solid #E2E8F0;
    }
    .meta-tag mat-icon { font-size:.82rem; width:.82rem; height:.82rem; color:#94A3B8; }

    .featured-action {
      display:flex; flex-direction:column; align-items:flex-end;
      gap:.85rem; flex-shrink:0;
    }
    .featured-price-block { display:flex; flex-direction:column; align-items:flex-end; gap:.25rem; }
    .feat-price-orig { font-size:.85rem; color:#94A3B8; text-decoration:line-through; }
    .feat-discount-pill {
      font-size:.72rem; font-weight:700; background:#DCFCE7; color:#15803D;
      padding:.15rem .5rem; border-radius:999px;
    }
    .feat-price-eff {
      font-size:2rem; font-weight:800; color:#003399;
      line-height:1; font-variant-numeric:tabular-nums;
      letter-spacing:-.02em;
    }
    .btn-book-featured {
      display:inline-flex; align-items:center; gap:.4rem;
      background:#0047CC; color:#fff;
      border:none; border-radius:12px;
      padding:.65rem 1.35rem; font-size:.9rem; font-weight:700;
      transition:background .18s, transform .15s, box-shadow .18s;
      box-shadow:0 4px 12px rgba(0, 71, 204,.35);
    }
    .btn-book-featured:hover {
      background:#003399;
      box-shadow:0 6px 18px rgba(0, 71, 204,.45);
      transform:translateY(-1px);
    }
    .btn-book-featured mat-icon { font-size:.95rem; width:.95rem; height:.95rem; }
    .feat-details-link {
      font-size:.8rem; font-weight:500; color:#0047CC;
      text-decoration:none; text-align:center;
      transition:color .15s;
    }
    .feat-details-link:hover { color:#003399; text-decoration:underline; }

    /* ─── TEST GRID ──────────────────────────────── */
    .tests-grid {
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(260px,1fr));
      gap:1rem;
    }
    .test-card {
      background:#fff; border-radius:16px;
      border:1px solid #E2E8F0;
      overflow:hidden;
      display:flex; flex-direction:column;
      box-shadow:0 1px 4px rgba(0,0,0,.05);
      transition:box-shadow .2s, transform .2s;
    }
    .test-card:hover {
      box-shadow:0 6px 24px rgba(0,0,0,.1), 0 0 0 1.5px var(--cat-color, #0047CC);
      transform:translateY(-3px);
    }
    .card-top-bar {
      height:4px;
      background:var(--cat-color, #0047CC);
      flex-shrink:0;
    }
    .card-body {
      display:flex; flex-direction:column; gap:.6rem;
      padding:1.1rem 1.1rem 1rem; flex:1;
    }
    .card-header-row { display:flex; justify-content:space-between; align-items:flex-start; gap:.5rem; }
    .card-badges-left { display:flex; align-items:center; gap:.35rem; flex-wrap:wrap; min-width:0; }
    .card-popular-badge {
      display:inline-flex; align-items:center; gap:.25rem;
      background:linear-gradient(135deg,#003399,#002577);
      color:#fff; font-size:.7rem; font-weight:700;
      padding:.15rem .5rem; border-radius:999px; letter-spacing:.03em;
      white-space:nowrap;
    }
    .card-popular-badge mat-icon { font-size:.8rem; width:.8rem; height:.8rem; }
    .card-cat-badge {
      display:inline-flex; align-items:center; gap:.25rem;
      font-size:.7rem; font-weight:600;
      background:var(--cat-light, #EEF4FF);
      color:var(--cat-color, #0047CC);
      border:1px solid var(--cat-border, #B3CAFF);
      padding:.15rem .5rem; border-radius:999px;
    }
    .card-cat-badge mat-icon { font-size:.78rem; width:.78rem; height:.78rem; }
    .card-discount-badge {
      font-size:.68rem; font-weight:700;
      background:#DCFCE7; color:#15803D;
      padding:.15rem .45rem; border-radius:999px;
      white-space:nowrap; flex-shrink:0; align-self:flex-start;
    }
    .card-name {
      font-size:.95rem; font-weight:700; color:#0F172A;
      line-height:1.3; margin:0;
    }
    .card-desc {
      font-size:.8rem; color:#64748B; line-height:1.55;
      margin:0;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
    }
    .card-tags-row { display:flex; gap:.5rem; flex-wrap:wrap; }
    .card-tag {
      display:inline-flex; align-items:center; gap:.25rem;
      font-size:.72rem; color:#64748B;
      background:#F8FAFC; padding:.2rem .5rem; border-radius:6px;
      border:1px solid #F1F5F9;
    }
    .card-tag mat-icon { font-size:.78rem; width:.78rem; height:.78rem; color:#94A3B8; }
    .home-tag mat-icon { color:#22C55E; }

    .card-footer {
      display:flex; justify-content:space-between; align-items:center;
      margin-top:auto; padding-top:.75rem;
      border-top:1px solid #F1F5F9;
    }
    .card-price { display:flex; flex-direction:column; gap:.05rem; }
    .card-price-orig { font-size:.73rem; color:#94A3B8; text-decoration:line-through; font-variant-numeric:tabular-nums; }
    .card-price-eff {
      font-size:1.1rem; font-weight:800; color:#003399;
      font-variant-numeric:tabular-nums; line-height:1;
    }
    .card-actions { display:flex; gap:.4rem; align-items:center; }
    .btn-details-sm {
      padding:.32rem .65rem; border-radius:8px;
      border:1.5px solid #E2E8F0;
      font-size:.76rem; font-weight:600; color:#475569;
      text-decoration:none; transition:all .15s;
    }
    .btn-details-sm:hover { border-color:#0047CC; color:#0047CC; }
    .btn-book-sm {
      padding:.32rem .75rem; border-radius:8px;
      background:#0047CC; color:#fff;
      border:none; font-size:.76rem; font-weight:700;
      transition:background .15s, box-shadow .15s;
      box-shadow:0 2px 6px rgba(0, 71, 204,.3);
    }
    .btn-book-sm:hover { background:#003399; box-shadow:0 3px 10px rgba(0, 71, 204,.4); }

    /* ─── SKELETONS ──────────────────────────────── */
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .skeleton-feat {
      height:160px; border-radius:20px;
      background:linear-gradient(90deg,#EEF4FF 25%,#D9E5FF 50%,#EEF4FF 75%);
      background-size:200% 100%; animation:shimmer 1.6s infinite;
    }
    .skeleton-card {
      background:#fff; border-radius:16px; border:1px solid #E2E8F0;
      padding:1.1rem; display:flex; flex-direction:column; gap:.65rem;
      overflow:hidden;
    }
    .sk-top { height:.6rem; width:35%; border-radius:4px; background:linear-gradient(90deg,#EEF4FF 25%,#D9E5FF 50%,#EEF4FF 75%); background-size:200% 100%; animation:shimmer 1.6s infinite; }
    .sk-title { height:.9rem; width:80%; border-radius:4px; background:linear-gradient(90deg,#EEF4FF 25%,#D9E5FF 50%,#EEF4FF 75%); background-size:200% 100%; animation:shimmer 1.6s infinite; }
    .sk-line { height:.7rem; width:100%; border-radius:4px; background:linear-gradient(90deg,#EEF4FF 25%,#D9E5FF 50%,#EEF4FF 75%); background-size:200% 100%; animation:shimmer 1.6s infinite; }
    .sk-short { width:60%; }
    .sk-footer { display:flex; justify-content:space-between; align-items:center; margin-top:.3rem; }
    .sk-price { height:1.1rem; width:25%; border-radius:4px; background:linear-gradient(90deg,#EEF4FF 25%,#B3CAFF 50%,#EEF4FF 75%); background-size:200% 100%; animation:shimmer 1.6s infinite; }
    .sk-btn { height:1.75rem; width:28%; border-radius:8px; background:linear-gradient(90deg,#EEF4FF 25%,#D9E5FF 50%,#EEF4FF 75%); background-size:200% 100%; animation:shimmer 1.6s infinite; }

    /* ─── STATES ─────────────────────────────────── */
    .state-panel {
      display:flex; flex-direction:column; align-items:center;
      text-align:center; gap:1rem; padding:4rem 2rem;
    }
    .state-icon-wrap {
      width:72px; height:72px; border-radius:20px;
      display:flex; align-items:center; justify-content:center;
    }
    .state-icon-wrap mat-icon { font-size:2rem; width:2rem; height:2rem; }
    .empty-icon-wrap { background:#EEF4FF; }
    .empty-icon-wrap mat-icon { color:#0047CC; }
    .empty-illus { width:180px; max-width:56%; margin:0 auto; }
    .error-icon-wrap { background:#FEE2E2; }
    .error-icon-wrap mat-icon { color:#EF4444; }
    .state-panel h3 { font-size:1.1rem; font-weight:700; color:#0F172A; margin:0; max-width:34rem; }
    .state-panel p { font-size:.875rem; color:#64748B; margin:0; }
    .suggest-chips { display:flex; flex-wrap:wrap; gap:.5rem; justify-content:center; }
    .suggest-chip {
      background:#EEF4FF; border:1.5px solid #B3CAFF; color:#003399;
      border-radius:999px; padding:.35rem .9rem; font-size:.8rem; font-weight:600;
      transition:all .15s;
    }
    .suggest-chip:hover { background:#0047CC; border-color:#0047CC; color:#fff; }
    .empty-actions { display:flex; gap:.6rem; flex-wrap:wrap; justify-content:center; }
    .btn-primary {
      display:inline-flex; align-items:center; gap:.4rem;
      background:#0047CC; color:#fff;
      border:none; border-radius:10px;
      padding:.6rem 1.4rem; font-size:.875rem; font-weight:700;
      box-shadow:0 4px 12px rgba(0, 71, 204,.3);
      transition:background .15s, box-shadow .15s;
    }
    .btn-primary:hover { background:#003399; box-shadow:0 6px 16px rgba(0, 71, 204,.4); }
    .btn-primary mat-icon { font-size:1rem; width:1rem; height:1rem; }
    .btn-secondary {
      display:inline-flex; align-items:center; gap:.4rem;
      background:#fff; color:#475569;
      border:1.5px solid #E2E8F0; border-radius:10px;
      padding:.6rem 1.4rem; font-size:.875rem; font-weight:700;
      transition:all .15s;
    }
    .btn-secondary:hover { border-color:#0047CC; color:#0047CC; }

    /* ─── PAGINATION ─────────────────────────────── */
    .pagination { display:flex; justify-content:center; align-items:center; gap:.4rem; padding:.5rem 0; }
    .page-btn {
      width:36px; height:36px; border-radius:10px;
      border:1.5px solid #E2E8F0; background:#fff;
      display:flex; align-items:center; justify-content:center;
      color:#475569; transition:all .15s;
    }
    .page-btn:not(:disabled):hover { border-color:#0047CC; color:#0047CC; }
    .page-btn:disabled { opacity:.35; cursor:not-allowed; }
    .page-btn mat-icon { font-size:1.1rem; width:1.1rem; height:1.1rem; }
    .page-num {
      width:36px; height:36px; border-radius:10px;
      border:1.5px solid #E2E8F0; background:#fff;
      font-size:.85rem; font-weight:600; color:#475569;
      transition:all .15s; font-variant-numeric:tabular-nums;
    }
    .page-num:hover { border-color:#0047CC; color:#0047CC; }
    .page-num.active {
      background:#0047CC; border-color:#0047CC; color:#fff;
      box-shadow:0 2px 8px rgba(0, 71, 204,.3);
    }

    /* ─── RESPONSIVE ─────────────────────────────── */
    @media (max-width:768px) {
      .hero { padding:2rem 1rem 2.5rem; }
      .hero-headline { letter-spacing:-.015em; }
      .cats-bar-wrap { top:64px; }
      .content-wrap { padding:1.25rem 1rem 3rem; }
      .featured-body { gap:1.25rem; }
      .featured-action { align-items:flex-start; }
      .feat-price-eff { font-size:1.6rem; }
      .tests-grid { grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:.75rem; }
    }
    @media (max-width:480px) {
      .tests-grid { grid-template-columns:1fr; }
      .featured-body { flex-direction:column; padding:1.25rem; }
      .featured-action { align-items:flex-start; }
      .btn-book-featured { width:100%; justify-content:center; }
    }
  `],
})
export class TestCatalogComponent implements OnInit, AfterViewInit {
  @ViewChild('catsBar') catsBarRef?: ElementRef<HTMLElement>;
  canScrollLeft = signal(false);
  canScrollRight = signal(false);

  searchCtrl = new FormControl('');
  /** Debounced, applied search text — the reactive source for all filtering. */
  searchQuery = signal('');

  allTests = signal<Test[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  total = signal(0);
  page = signal(1);
  pageSize = 20;
  selectedCategory = signal<string | null>(null);
  searchFocused = false;
  private initialized = false;

  selectedConcernKeys = signal<string[]>([]);
  allConcerns = signal<HealthConcern[]>([]);
  savedConcernKeys = signal<string[]>([]);

  concernNames = computed(() =>
    this.selectedConcernKeys()
      .map(k => this.allConcerns().find(c => c.key === k)?.name ?? k)
      .join(', ')
  );

  savedConcernNames = computed(() => {
    if (this.selectedConcernKeys().length || !this.savedConcernKeys().length) return '';
    return this.savedConcernKeys()
      .map(k => this.allConcerns().find(c => c.key === k)?.name ?? k)
      .join(', ');
  });

  // ─── Search primitives (all reactive to searchQuery) ───
  private normQuery = computed(() => normalizeText(this.searchQuery()));
  private queryTokens = computed(() => tokenize(this.normQuery()));
  private queryExpansions = computed(() => expandQuery(this.normQuery(), this.queryTokens()));

  hasActiveSearch = computed(() => this.normQuery().length > 0);
  hasActiveFilters = computed(() => this.hasActiveSearch() || !!this.selectedCategory());

  /** Ranked search results (search applied, category NOT yet applied). */
  searchResults = computed<Test[]>(() => {
    const tests = this.allTests();
    const q = this.normQuery();
    if (!q) return tests; // browse mode — keep server order (popularity)
    const tokens = this.queryTokens();
    const exps = this.queryExpansions();
    const scored: ScoredTest[] = [];
    for (const test of tests) {
      const score = scoreTest(test, q, tokens, exps);
      if (score > 0) scored.push({ test, score });
    }
    scored.sort((a, b) => b.score - a.score || a.test.name.localeCompare(b.test.name));
    return scored.map(s => s.test);
  });

  /** Per-category counts based on the current search (before category filter). */
  private searchCategoryCounts = computed<Map<string, number>>(() => {
    const m = new Map<string, number>();
    for (const t of this.searchResults()) m.set(t.category, (m.get(t.category) ?? 0) + 1);
    return m;
  });

  /** Final list: search ∩ selected category. */
  finalTests = computed<Test[]>(() => {
    const cat = this.selectedCategory();
    const list = this.searchResults();
    return cat ? list.filter(t => t.category === cat) : list;
  });

  totalPages = computed(() => Math.ceil(this.finalTests().length / this.pageSize));

  gridTests = computed(() => {
    const all = this.finalTests();
    const skipFeatured = this.page() === 1 && !this.hasActiveFilters();
    const list = skipFeatured ? all.slice(1) : all;
    const start = (this.page() - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  });

  pageRange = computed(() => {
    const total = this.totalPages();
    const current = this.page();
    const delta = 2;
    const pages: number[] = [];
    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      pages.push(i);
    }
    return pages;
  });

  /** Autocomplete suggestions — top ranked matches, unique by name. */
  suggestions = computed(() => {
    if (!this.hasActiveSearch()) return [];
    const seen = new Set<string>();
    const out: Test[] = [];
    for (const t of this.searchResults()) {
      const key = t.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length >= 6) break;
    }
    return out;
  });

  /** "Did you mean" chips for the no-results empty state. */
  didYouMean = computed(() => {
    const exps = this.queryExpansions();
    if (exps.length) {
      return exps
        .map(e => e.replace(/\b\w/g, c => c.toUpperCase()))
        .slice(0, 4);
    }
    // Fall back to a few popular test names.
    return this.allTests().slice(0, 3).map(t => t.name);
  });

  categories = computed(() => {
    const map = new Map<string, number>();
    this.allTests().forEach(t => map.set(t.category, (map.get(t.category) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  });

  categoryChips = computed(() => {
    const staticKeys = new Set(CATEGORY_ICONS.slice(1).map(c => c.key));
    const extra = this.categories()
      .filter(c => !staticKeys.has(c.name))
      .map(c => ({ label: c.name, icon: 'biotech', key: c.name }));
    return [...CATEGORY_ICONS, ...extra];
  });

  constructor(
    private testApi: TestApiService,
    private healthConcernApi: HealthConcernApiService,
    private userApi: UserApiService,
    private authState: AuthStateService,
    private router: Router,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private seo: SeoService,
  ) {
    effect(() => {
      this.categoryChips();
      queueMicrotask(() => this.updateCatsFade());
    });

    effect(() => {
      const tests = this.allTests();
      if (tests.length) {
        this.seo.setJsonLd('itemlist', buildItemListSchema(
          tests.slice(0, 50).map((t) => ({ name: t.name, path: `/tests/${t.id}` })),
        ));
      }
    });
  }

  ngAfterViewInit(): void {
    this.updateCatsFade();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateCatsFade();
  }

  updateCatsFade(): void {
    const el = this.catsBarRef?.nativeElement;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    this.canScrollLeft.set(el.scrollLeft > 4);
    this.canScrollRight.set(maxScroll > 4 && el.scrollLeft < maxScroll - 4);
  }

  onCatsWheel(event: WheelEvent): void {
    const el = this.catsBarRef?.nativeElement;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    el.scrollLeft += event.deltaY;
  }

  ngOnInit(): void {
    this.seo.setPage({
      title: 'Browse Tests — 2000+ Diagnostic Tests',
      description:
        'Browse and book 2000+ NABL-certified diagnostic tests at Sri Health Plus, with free home sample collection and reports within 24 hours.',
      path: '/tests',
    });
    this.seo.setJsonLd('breadcrumb', buildBreadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Browse Tests', path: '/tests' },
    ]));

    this.healthConcernApi.list().subscribe({ next: (list) => this.allConcerns.set(list) });

    // Seed state from the URL once; thereafter only react to health_concern changes
    // (search / category / page are managed locally and pushed to the URL via replaceUrl).
    this.route.queryParams.subscribe(params => {
      const concernParam = params['health_concern'] ?? '';
      const concernKeys = concernParam ? concernParam.split(',').filter(Boolean) : [];
      const concernChanged = concernKeys.join(',') !== this.selectedConcernKeys().join(',');
      this.selectedConcernKeys.set(concernKeys);

      if (!this.initialized) {
        const q = params['q'] ?? '';
        this.searchCtrl.setValue(q, { emitEvent: false });
        this.searchQuery.set(q);
        this.selectedCategory.set(params['category'] ?? null);
        const pg = parseInt(params['page'], 10);
        if (pg > 1) this.page.set(pg);
        this.initialized = true;
        this.load();
      } else if (concernChanged) {
        this.page.set(1);
        this.load();
      }
    });

    // Debounced search → applied query signal. Instant client-side filtering; no reload.
    this.searchCtrl.valueChanges
      .pipe(debounceTime(280), distinctUntilChanged())
      .subscribe((v) => {
        this.searchQuery.set(v ?? '');
        this.page.set(1);
        this.syncUrl();
      });

    if (this.authState.isAuthenticated()) {
      this.userApi.getProfile().subscribe({
        next: (profile) => this.savedConcernKeys.set(profile.health_concerns ?? []),
      });
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const concernKeys = this.selectedConcernKeys();
    this.testApi.list({ page_size: 500, health_concern: concernKeys.length ? concernKeys.join(',') : undefined }).subscribe({
      next: (res) => {
        const activeOnly = res.items.filter((t: any) => t.is_active);
        this.allTests.set(activeOnly);
        this.total.set(activeOnly.length);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load tests. Please try again.');
        this.loading.set(false);
      },
    });
  }

  // ─── Search UX handlers ───
  onSearchFocus(): void { this.searchFocused = true; }
  onSearchBlur(): void { setTimeout(() => (this.searchFocused = false), 120); }
  closeSuggestions(): void { this.searchFocused = false; }

  selectSuggestion(name: string): void {
    this.setSearch(name);
    this.searchFocused = false;
  }

  /** Set search immediately (bypass debounce) — used by suggestions & chips. */
  setSearch(value: string): void {
    this.searchCtrl.setValue(value, { emitEvent: false });
    this.searchQuery.set(value);
    this.page.set(1);
    this.syncUrl();
  }

  clearSearch(): void {
    this.searchCtrl.setValue('', { emitEvent: false });
    this.searchQuery.set('');
    this.page.set(1);
    this.syncUrl();
  }

  selectCategory(cat: string | null): void {
    this.selectedCategory.set(cat);
    this.page.set(1);
    this.syncUrl();
  }

  clearCategory(): void { this.selectCategory(null); }

  changePage(p: number): void {
    this.page.set(p);
    this.syncUrl();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  clearFilters(): void {
    this.searchCtrl.setValue('', { emitEvent: false });
    this.searchQuery.set('');
    this.selectedCategory.set(null);
    this.page.set(1);
    this.syncUrl();
  }

  book(test: Test): void { this.router.navigate(['/booking'], { queryParams: { test_id: test.id } }); }

  /** Persist search / category / page to the URL so refresh & back restore state. */
  private syncUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.searchQuery() || null,
        category: this.selectedCategory() || null,
        page: this.page() > 1 ? this.page() : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  clearConcernFilter(): void {
    this.router.navigate(['/tests'], { queryParams: { q: this.searchQuery() || null } });
  }

  applySavedConcerns(): void {
    this.router.navigate(['/tests'], { queryParams: { health_concern: this.savedConcernKeys().join(',') } });
  }

  // ─── Highlight matched text ───
  /** Wrap query tokens / aliases in <mark> within the given text, HTML-escaped. */
  highlight(text: string): SafeHtml {
    const escaped = this.escapeHtml(text);
    const terms = this.highlightTerms();
    if (!terms.length) return this.sanitizer.bypassSecurityTrustHtml(escaped);
    const pattern = terms.map(t => this.escapeRegExp(t)).join('|');
    const re = new RegExp(`(${pattern})`, 'gi');
    return this.sanitizer.bypassSecurityTrustHtml(escaped.replace(re, '<mark>$1</mark>'));
  }

  private highlightTerms = computed<string[]>(() => {
    const terms = new Set<string>();
    const q = this.normQuery();
    if (q.length >= 2) terms.add(q);
    for (const t of this.queryTokens()) if (t.length >= 2) terms.add(t);
    for (const e of this.queryExpansions()) if (e.length >= 2) terms.add(e);
    // Longer terms first so multi-word phrases win over their sub-tokens.
    return Array.from(terms).sort((a, b) => b.length - a.length);
  });

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  private escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  getCatColor(cat: string | null): string { return cat ? (CATEGORY_META[cat]?.color ?? '#0047CC') : '#0047CC'; }
  getCatLight(cat: string | null): string { return cat ? (CATEGORY_META[cat]?.light ?? '#EEF4FF') : '#EEF4FF'; }
  getCatBorder(cat: string | null): string { return cat ? (CATEGORY_META[cat]?.border ?? '#B3CAFF') : '#B3CAFF'; }
  getCatIcon(cat: string): string { return CATEGORY_META[cat]?.icon ?? 'biotech'; }
  getCatCount(key: string | null): number {
    if (!key) return this.searchResults().length;
    return this.searchCategoryCounts().get(key) ?? 0;
  }
  getFeaturedGradient(): string {
    const test = this.finalTests()[0];
    if (!test) return 'linear-gradient(180deg,#0047CC,#003399)';
    const color = this.getCatColor(test.category);
    return `linear-gradient(180deg,${color},${color}cc)`;
  }
}
