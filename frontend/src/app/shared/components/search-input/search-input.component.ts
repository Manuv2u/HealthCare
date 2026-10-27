import { Component, Input, Output, EventEmitter, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search" [class]="'search--' + size">
      <span class="search__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </span>
      <input
        type="search"
        class="search__input"
        [placeholder]="placeholder"
        [(ngModel)]="query"
        (ngModelChange)="onQueryChange($event)"
        (keydown.enter)="onSubmit()"
      />
      @if (query && showClear) {
        <button class="search__clear" (click)="clear()" aria-label="Clear search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      }
      @if (loading) {
        <span class="search__spinner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="50" stroke-dashoffset="25"/>
          </svg>
        </span>
      }
    </div>
  `,
  styles: [`
    /* Same field standard as app-input. Icon geometry is shared via the
       --input-icon-* tokens so search boxes line up with every other field. */
    :host { display: block; }

    .search {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      height: var(--input-height-md);
      border: var(--input-border-width) solid var(--input-border-color);
      border-radius: var(--input-radius);
      background: var(--input-bg);
      transition:
        border-color var(--input-transition),
        box-shadow var(--input-transition),
        background var(--input-transition);
    }
    .search--sm { height: var(--input-height-sm); }
    .search--md { height: var(--input-height-md); }
    .search--lg { height: var(--input-height-lg); }

    .search:hover { border-color: var(--input-border-hover); }
    .search:focus-within {
      border-color: var(--input-accent);
      box-shadow: var(--input-ring);
    }

    .search__icon {
      display: flex;
      flex-shrink: 0;
      margin-left: var(--input-icon-inset);
      color: var(--input-icon-color);
      transition: color var(--input-transition);
    }
    .search__icon svg { width: var(--input-icon-size); height: var(--input-icon-size); display: block; }
    .search:focus-within .search__icon { color: var(--input-accent); }

    .search__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      /* icon inset + icon + gap = the same text start as app-input */
      padding: 0 var(--input-padding-x) 0 11px;
      background: transparent;
      border: none;
      font-family: inherit;
      font-size: var(--input-font-size);
      font-weight: var(--input-font-weight);
      color: var(--input-ink);
    }
    .search__input::placeholder { color: var(--input-placeholder); font-weight: 400; }
    .search__input:focus { outline: none; }
    .search__input::-webkit-search-cancel-button { display: none; }

    .search__clear {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 30px;
      height: 30px;
      margin-right: 8px;
      background: transparent;
      border: none;
      border-radius: 8px;
      color: var(--input-icon-color);
      cursor: pointer;
      transition: background var(--input-transition), color var(--input-transition);
    }
    .search__clear:hover { background: var(--input-bg-disabled); color: var(--input-ink); }
    .search__clear:focus-visible { outline: 2px solid var(--input-accent); outline-offset: 1px; }
    .search__clear svg { width: 16px; height: 16px; }

    .search__spinner {
      display: flex;
      flex-shrink: 0;
      margin-right: var(--input-padding-x);
      color: var(--input-accent);
    }
    .search__spinner svg {
      width: 18px;
      height: 18px;
      animation: searchSpin 1s linear infinite;
    }

    @keyframes searchSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      .search, .search__icon, .search__clear { transition: none; }
      .search__spinner svg { animation: none; }
    }
  `]
})
export class SearchInputComponent implements OnDestroy {
  @Input() placeholder = 'Search...';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() debounce = 300;
  @Input() showClear = true;
  @Input() loading = false;
  @Input() set value(val: string) { this.query = val; }
  
  @Output() search = new EventEmitter<string>();
  @Output() submit = new EventEmitter<string>();
  
  query = '';
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  
  constructor() {
    this.searchSubject.pipe(
      debounceTime(this.debounce),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(value => this.search.emit(value));
  }
  
  onQueryChange(value: string): void {
    this.searchSubject.next(value);
  }
  
  onSubmit(): void {
    this.submit.emit(this.query);
  }
  
  clear(): void {
    this.query = '';
    this.search.emit('');
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
