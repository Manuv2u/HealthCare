import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ServiceAreaApiService } from '../../core/api/services/service-area-api.service';
import { ServiceArea } from '../../core/api/api.types';
import { BadgeComponent, ButtonComponent, SearchInputComponent } from '../../shared/components';

interface Suggestion {
  label: string;
  sub: string;
  area: ServiceArea;
}

function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
}

@Component({
  selector: 'app-available-locations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, BadgeComponent, ButtonComponent, SearchInputComponent],
  template: `
    <div class="page">
      <!-- Hero -->
      <section class="hero">
        <h1 class="hero__title">Available Locations</h1>
        <p class="hero__subtitle">Check whether home sample collection is available in your area before you book.</p>
      </section>

      <!-- Search & Filters -->
      <section class="filters">
        <div class="search-wrap" (focusin)="searchFocused.set(true)" (focusout)="onSearchBlur()">
          <app-search-input
            placeholder="Search by city, area, or PIN code..."
            [value]="searchQuery()"
            (search)="searchQuery.set($event)"
          />
          @if (searchFocused() && suggestions().length > 0) {
            <div class="suggestions">
              @for (s of suggestions(); track s.sub) {
                <button type="button" class="suggestion" (click)="selectSuggestion(s)">
                  <mat-icon class="suggestion__icon">place</mat-icon>
                  <span class="suggestion__text">
                    <span class="suggestion__label">{{ s.label }}</span>
                    <span class="suggestion__sub">{{ s.sub }}</span>
                  </span>
                </button>
              }
            </div>
          }
        </div>

        <div class="filter-row">
          <select class="filter-select" [ngModel]="filterState()" (ngModelChange)="onStateChange($event)" aria-label="Filter by state">
            <option value="">All States</option>
            @for (s of states(); track s) { <option [value]="s">{{ s }}</option> }
          </select>
          <select class="filter-select" [ngModel]="filterDistrict()" (ngModelChange)="onDistrictChange($event)" aria-label="Filter by district">
            <option value="">All Districts</option>
            @for (d of districts(); track d) { <option [value]="d">{{ d }}</option> }
          </select>
          <select class="filter-select" [ngModel]="filterCity()" (ngModelChange)="onCityChange($event)" aria-label="Filter by city">
            <option value="">All Cities</option>
            @for (c of cities(); track c) { <option [value]="c">{{ c }}</option> }
          </select>
          <select class="filter-select" [ngModel]="filterArea()" (ngModelChange)="onAreaChange($event)" aria-label="Filter by area">
            <option value="">All Areas</option>
            @for (a of areasList(); track a) { <option [value]="a">{{ a }}</option> }
          </select>
          @if (hasFilters()) {
            <button type="button" class="clear-btn" (click)="clearFilters()">Clear filters</button>
          }
        </div>
      </section>

      <!-- Results -->
      <section class="content">
        @if (loading()) {
          <div class="state-box">
            <mat-icon class="state-box__icon">hourglass_top</mat-icon>
            <p>Loading service locations...</p>
          </div>
        } @else if (error()) {
          <div class="state-box state-box--error">
            <mat-icon class="state-box__icon">error_outline</mat-icon>
            <p>{{ error() }}</p>
            <app-button variant="outline" size="sm" (click)="load()">Try Again</app-button>
          </div>
        } @else if (filtered().length === 0) {
          <div class="state-box">
            <mat-icon class="state-box__icon">location_off</mat-icon>
            <p>No matching locations found. Try a different search or filter.</p>
            @if (hasFilters()) {
              <app-button variant="outline" size="sm" (click)="clearFilters()">Clear filters</app-button>
            }
          </div>
        } @else {
          <div class="result-count">
            {{ filtered().length }} location{{ filtered().length === 1 ? '' : 's' }} available
          </div>
          <div class="location-grid">
            @for (a of filtered(); track a.id) {
              <div class="location-card">
                <div class="location-card__top">
                  <mat-icon class="location-card__icon">location_on</mat-icon>
                  <app-badge variant="success" size="sm">Home Collection Available</app-badge>
                </div>
                <h3 class="location-card__title">{{ a.area || a.city }}</h3>
                <p class="location-card__text">
                  {{ a.city }}@if (a.taluk) {, {{ a.taluk }}}, {{ a.district }}
                  @if (a.state) {, {{ a.state }}}
                </p>
                <span class="location-card__pincode">{{ a.pincode }}</span>
              </div>
            }
          </div>
        }
      </section>

      <!-- Booking CTA -->
      <section class="cta">
        <p>Found your area?</p>
        <a routerLink="/booking" class="cta__btn">Book a Test Now</a>
      </section>
    </div>
  `,
  styles: [`
    :host {
      --color-primary-50: #EEF4FF;
      --color-primary-100: #D9E5FF;
      --color-primary-500: #0047CC;
      --color-primary-600: #003399;
      --color-primary-700: #002577;
      display: block;
      background: #F8F9FF;
      min-height: 100vh;
    }

    .page {
      max-width: 1000px;
      margin: 0 auto;
      padding: 0 1.5rem 3rem;
    }

    /* Hero */
    .hero {
      position: relative;
      background: url('/assets/maps/city.jpg') center / cover no-repeat;
      margin: 0 -1.5rem;
      padding: 3rem 1.5rem 2.5rem;
      text-align: center;
      color: #FFFFFF;
      overflow: hidden;
    }

    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
    }

    .hero__title {
      position: relative;
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0 0 0.5rem 0;
      color: #FFFFFF;
    }

    .hero__subtitle {
      position: relative;
      font-size: 1rem;
      color: #F1F5F9;
      margin: 0;
      max-width: 40ch;
      margin-inline: auto;
    }

    /* Filters */
    .filters {
      margin-top: -1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      background: #FFFFFF;
      border-radius: 1rem;
      border: 1px solid #F1F5F9;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,.08),0 4px 6px -4px rgba(0,0,0,.08);
      padding: 1rem;
      position: relative;
      z-index: 2;
    }

    .search-wrap {
      position: relative;
    }

    .suggestions {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 0.75rem;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1);
      overflow: hidden;
      z-index: 10;
    }

    .suggestion {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      width: 100%;
      padding: 0.625rem 0.875rem;
      background: transparent;
      border: none;
      text-align: left;
      cursor: pointer;

      &:hover {
        background: #F8FAFC;
      }

      &:not(:last-child) {
        border-bottom: 1px solid #F1F5F9;
      }
    }

    .suggestion__icon {
      color: #94A3B8;
      flex-shrink: 0;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .suggestion__text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .suggestion__label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #0F172A;
    }

    .suggestion__sub {
      font-size: 0.75rem;
      color: #94A3B8;
    }

    .filter-row {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .filter-select {
      flex: 1;
      min-width: 140px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 0.625rem;
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
      color: #0F172A;
      cursor: pointer;

      &:focus {
        outline: none;
        border-color: #0047CC;
      }
    }

    .clear-btn {
      background: transparent;
      border: none;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #0047CC;
      cursor: pointer;
      padding: 0.5rem 0.25rem;
      white-space: nowrap;

      &:hover {
        text-decoration: underline;
      }
    }

    /* Content */
    .content {
      padding-top: 1.5rem;
    }

    .result-count {
      font-size: 0.8125rem;
      color: #475569;
      margin-bottom: 0.75rem;
    }

    .state-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 3rem 1.5rem;
      text-align: center;
      color: #475569;

      p {
        margin: 0;
      }
    }

    .state-box__icon {
      color: #94A3B8;
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .state-box--error .state-box__icon {
      color: #DC2626;
    }

    .location-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 0.75rem;
    }

    .location-card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 0.75rem;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .location-card__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .location-card__icon {
      color: #0047CC;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .location-card__title {
      font-size: 1rem;
      font-weight: 700;
      color: #0F172A;
      margin: 0;
    }

    .location-card__text {
      font-size: 0.8125rem;
      color: #475569;
      margin: 0;
    }

    .location-card__pincode {
      font-size: 0.75rem;
      font-weight: 600;
      color: #0047CC;
      background: #EEF4FF;
      border-radius: 9999px;
      padding: 0.125rem 0.625rem;
      width: fit-content;
    }

    /* CTA */
    .cta {
      margin-top: 2.5rem;
      text-align: center;
      padding: 2rem;
      background: #FFFFFF;
      border: 1px solid #F1F5F9;
      border-radius: 1rem;

      p {
        margin: 0 0 0.75rem 0;
        font-size: 0.9375rem;
        color: #475569;
      }
    }

    .cta__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 44px;
      padding: 0 1.5rem;
      background: #0047CC;
      color: #FFFFFF;
      border-radius: 0.75rem;
      font-size: 0.9375rem;
      font-weight: 600;
      text-decoration: none;

      &:hover {
        background: #003399;
      }
    }

    @media (max-width: 640px) {
      .filter-select {
        min-width: 100%;
      }
    }
  `]
})
export class AvailableLocationsComponent implements OnInit {
  private serviceAreaApi = inject(ServiceAreaApiService);

  loading = signal(true);
  error = signal<string | null>(null);
  allAreas = signal<ServiceArea[]>([]);

  searchQuery = signal('');
  searchFocused = signal(false);
  filterState = signal('');
  filterDistrict = signal('');
  filterCity = signal('');
  filterArea = signal('');

  states = computed(() => unique(this.allAreas().map(a => a.state)));

  districts = computed(() => {
    const st = this.filterState();
    return unique(this.allAreas().filter(a => !st || a.state === st).map(a => a.district));
  });

  cities = computed(() => {
    const st = this.filterState();
    const d = this.filterDistrict();
    return unique(
      this.allAreas()
        .filter(a => (!st || a.state === st) && (!d || a.district === d))
        .map(a => a.city)
    );
  });

  areasList = computed(() => {
    const st = this.filterState();
    const d = this.filterDistrict();
    const c = this.filterCity();
    return unique(
      this.allAreas()
        .filter(a => (!st || a.state === st) && (!d || a.district === d) && (!c || a.city === c))
        .map(a => a.area)
    );
  });

  filtered = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const st = this.filterState();
    const d = this.filterDistrict();
    const c = this.filterCity();
    const ar = this.filterArea();

    return this.allAreas().filter(a => {
      if (st && a.state !== st) return false;
      if (d && a.district !== d) return false;
      if (c && a.city !== c) return false;
      if (ar && a.area !== ar) return false;
      if (q) {
        const hay = [a.city, a.area, a.taluk, a.district, a.state, a.pincode]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  suggestions = computed<Suggestion[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return [];

    const seen = new Set<string>();
    const results: Suggestion[] = [];
    for (const a of this.allAreas()) {
      const hay = [a.city, a.area, a.pincode, a.district].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) continue;

      const key = `${a.city}|${a.area}|${a.pincode}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        label: [a.area, a.city].filter(Boolean).join(', '),
        sub: `${a.pincode} · ${a.district}`,
        area: a,
      });
      if (results.length >= 6) break;
    }
    return results;
  });

  hasFilters = computed(() =>
    !!(this.searchQuery() || this.filterState() || this.filterDistrict() || this.filterCity() || this.filterArea())
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.serviceAreaApi.list().subscribe({
      next: areas => {
        this.allAreas.set(areas);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load service locations. Please try again.');
        this.loading.set(false);
      }
    });
  }

  onSearchBlur(): void {
    setTimeout(() => this.searchFocused.set(false), 150);
  }

  selectSuggestion(s: Suggestion): void {
    this.searchQuery.set(s.area.pincode);
    this.searchFocused.set(false);
  }

  onStateChange(value: string): void {
    this.filterState.set(value);
    this.filterDistrict.set('');
    this.filterCity.set('');
    this.filterArea.set('');
  }

  onDistrictChange(value: string): void {
    this.filterDistrict.set(value);
    this.filterCity.set('');
    this.filterArea.set('');
  }

  onCityChange(value: string): void {
    this.filterCity.set(value);
    this.filterArea.set('');
  }

  onAreaChange(value: string): void {
    this.filterArea.set(value);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.filterState.set('');
    this.filterDistrict.set('');
    this.filterCity.set('');
    this.filterArea.set('');
  }
}
