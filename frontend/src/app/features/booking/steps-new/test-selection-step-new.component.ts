import { Component, inject, OnInit, Input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestApiService } from '../../../core/api/services/test-api.service';
import { PackageApiService } from '../../../core/api/services/package-api.service';
import { BookingWizardStore } from '../../../core/store/booking-wizard.store';
import { Test, Package, FeatureCardItem } from '../../../core/api/api.types';
import {
  ButtonComponent, CardComponent, BadgeComponent,
  SpinnerComponent, SearchInputComponent, TabsComponent, ModalComponent
} from '../../../shared/components';

type SelectionMode = 'tests' | 'packages';

interface SelectedItem {
  id: string;
  name: string;
  price: number;
}

@Component({
  selector: 'app-test-selection-step-new',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    CardComponent,
    BadgeComponent,
    SpinnerComponent,
    SearchInputComponent,
    TabsComponent,
    ModalComponent
  ],
  template: `
    <div class="test-selection">
      @if (!focusedMode()) {
        <ng-container *ngTemplateOutlet="browseUI" />
      }

      <!-- Selection Summary -->
      @if (hasSelection()) {
        <div class="selection-summary">
          <div class="summary-header">
            <h4>Selected Items</h4>
            <button class="clear-btn" (click)="clearSelection()" aria-label="Clear all">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </button>
          </div>

          <div class="summary-items">
            @for (item of selectedTests(); track item.id) {
              <div class="summary-item">
                <span class="summary-item__check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
                <span class="summary-item__name">{{ item.name }}</span>
                <span class="summary-item__price">₹{{ item.price | number:'1.0-0' }}</span>
                <button class="summary-item__remove" (click)="removeTest(item.id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            }
            @for (item of selectedPackages(); track item.id) {
              <div class="summary-item">
                <span class="summary-item__check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
                <span class="summary-item__name">{{ item.name }}</span>
                <span class="summary-item__price">₹{{ item.price | number:'1.0-0' }}</span>
                <button class="summary-item__remove" (click)="removePackage(item.id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            }
          </div>
        </div>
      }

      <!-- Add more: the deliberate way out of the focused single-item view -->
      @if (focusedMode()) {
        <div class="focused-actions">
          <button type="button" class="focused-action-btn" (click)="openBrowseModal('tests')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 17H2a3 3 0 003 3h14a3 3 0 003-3zM2 17V5a3 3 0 013-3h14a3 3 0 013 3v12"/>
            </svg>
            + Add Test
          </button>
          <button type="button" class="focused-action-btn" (click)="openBrowseModal('packages')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
            </svg>
            + Add Package
          </button>
        </div>
      }

      @if (hasSelection()) {
        <div class="summary-total">
          <span>Total</span>
          <span class="summary-total__amount">₹{{ totalAmount() | number:'1.0-0' }}</span>
        </div>
      }

      <!-- Actions -->
      @if (!embedded) {
        <div class="step-actions">
          <app-button variant="outline" size="lg" (click)="back.emit()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon btn-icon--left">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </app-button>
          <app-button variant="primary" size="lg" [disabled]="!hasSelection()" (click)="onNext()">
            Continue
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </app-button>
        </div>
      }
    </div>

    <!-- Browse modal: how "+ Add Test" / "+ Add Package" surface the full catalog
         when the screen is focused on a single deep-linked item. -->
    <app-modal [isOpen]="showBrowseModal()" title="Add Tests & Packages" size="xl" (close)="closeBrowseModal()">
      <ng-container *ngTemplateOutlet="browseUI" />
      <div modal-footer>
        <app-button variant="primary" (click)="closeBrowseModal()">Done</app-button>
      </div>
    </app-modal>

    <ng-template #browseUI>
      <!-- Search & Tabs -->
      <div class="selection-header">
        <div class="selection-tabs">
          <button
            class="tab-btn"
            [class.tab-btn--active]="mode() === 'tests'"
            (click)="setMode('tests')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 17H2a3 3 0 003 3h14a3 3 0 003-3zM2 17V5a3 3 0 013-3h14a3 3 0 013 3v12"/>
            </svg>
            Individual Tests
          </button>
          <button
            class="tab-btn"
            [class.tab-btn--active]="mode() === 'packages'"
            (click)="setMode('packages')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
            </svg>
            Health Packages
          </button>
        </div>

        <div class="search-row">
          <div class="search-wrapper">
            <input
              type="text"
              class="search-input"
              [placeholder]="mode() === 'tests' ? 'Search tests by name or category...' : 'Search packages by name or included test...'"
              [(ngModel)]="searchQuery"
              (input)="onSearch()"
            />
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>

          @if (mode() === 'tests') {
            <select class="category-select" [(ngModel)]="selectedCategory" (change)="filterTests()">
              <option value="">All Categories</option>
              @for (cat of categories(); track cat) {
                <option [value]="cat">{{ cat }}</option>
              }
            </select>
          }
        </div>
      </div>

      <!-- Scrollable Content Area -->
      <div class="selection-content">
        @if (loading()) {
          <div class="loading-state">
            <app-spinner size="lg" />
            <p>Loading {{ mode() === 'tests' ? 'tests' : 'packages' }}...</p>
          </div>
        } @else {
          <!-- Tests Grid -->
          @if (mode() === 'tests') {
            @if (filteredTests().length === 0) {
              <div class="empty-state">
                <div class="empty-state__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </div>
                <h3>No tests found</h3>
                <p>Try adjusting your search or category filter</p>
              </div>
            } @else {
              <div class="items-grid">
                @for (test of filteredTests(); track test.id) {
                  <button
                    type="button"
                    class="item-card"
                    [class.item-card--selected]="isTestSelected(test.id)"
                    (click)="toggleTest(test)"
                  >
                    <div class="item-card__header">
                      <app-badge variant="default" size="sm">{{ test.category }}</app-badge>
                      @if (test.discount_percentage > 0) {
                        <app-badge variant="success" size="sm">{{ test.discount_percentage }}% OFF</app-badge>
                      }
                    </div>
                    <h4 class="item-card__name">{{ test.name }}</h4>
                    @if (test.description) {
                      <p class="item-card__desc">{{ test.description }}</p>
                    }
                    <div class="item-card__footer">
                      <div class="item-card__price">
                        <span class="price-current">₹{{ test.effective_price }}</span>
                        @if (test.discount_percentage > 0) {
                          <span class="price-original">₹{{ test.price }}</span>
                        }
                      </div>
                      <div class="item-card__meta">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {{ test.turnaround_hours }} hrs
                      </div>
                    </div>
                    <div class="item-card__check" [class.item-card__check--visible]="isTestSelected(test.id)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  </button>
                }
              </div>
            }
          }

          <!-- Packages Grid -->
          @if (mode() === 'packages') {
            @if (filteredPackages().length === 0) {
              <div class="empty-state">
                <div class="empty-state__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                  </svg>
                </div>
                @if (packages().length === 0) {
                  <h3>No packages available</h3>
                  <p>Check back later for health packages</p>
                } @else {
                  <h3>No packages found</h3>
                  <p>Try adjusting your search</p>
                }
              </div>
            } @else {
              <div class="packages-grid">
                @for (pkg of filteredPackages(); track pkg.id) {
                  <button
                    type="button"
                    class="package-card"
                    [class.package-card--selected]="isPackageSelected(pkg.id)"
                    (click)="togglePackage(pkg)"
                  >
                    <div class="package-card__header">
                      <h4 class="package-card__name">{{ pkg.name }}</h4>
                      @if (Number(pkg.discounted_price) < Number(pkg.original_price)) {
                        <app-badge variant="success" size="sm">
                          {{ getSavingsPercent(pkg) }}% OFF
                        </app-badge>
                      }
                    </div>

                    @if (pkg.description) {
                      <p class="package-card__desc">{{ pkg.description }}</p>
                    }

                    <div class="package-card__tests">
                      <span class="package-card__tests-label">Includes {{ pkg.tests.length }} tests:</span>
                      <div class="package-card__tests-list">
                        @for (test of pkg.tests.slice(0, 4); track test.id) {
                          <span class="package-card__test-name">{{ test.name }}</span>
                        }
                        @if (pkg.tests.length > 4) {
                          <span class="package-card__test-more">+{{ pkg.tests.length - 4 }} more</span>
                        }
                      </div>
                    </div>

                    <div class="package-card__footer">
                      <div class="package-card__price">
                        <span class="price-current">₹{{ Number(pkg.discounted_price) | number:'1.0-0' }}</span>
                        @if (Number(pkg.discounted_price) < Number(pkg.original_price)) {
                          <span class="price-original">₹{{ Number(pkg.original_price) | number:'1.0-0' }}</span>
                        }
                      </div>
                      <span class="package-card__save">
                        Save ₹{{ (Number(pkg.original_price) - Number(pkg.discounted_price)) | number:'1.0-0' }}
                      </span>
                    </div>

                    <div class="package-card__check" [class.package-card__check--visible]="isPackageSelected(pkg.id)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  </button>
                }
              </div>
            }
          }
        }
      </div>
    </ng-template>
  `,
  styles: [`
    :host {
      --color-primary-50: #EEF4FF;
      --color-primary-100: #D9E5FF;
      --color-primary-500: #0047CC;
      --color-primary-600: #003399;
      --color-primary-700: #002577;
      --color-primary-800: #001B57;
      --shadow-primary: 0 4px 14px 0 rgba(0, 51, 153, 0.28);
      display: block;
    }

    .test-selection {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    /* Scrollable Content */
    .selection-content {
      overflow-y: auto;
      max-height: 500px;
      padding-right: 0.5rem;
    }

    .selection-content::-webkit-scrollbar {
      width: 6px;
    }

    .selection-content::-webkit-scrollbar-track {
      background: #F1F5F9;
      border-radius: 3px;
    }

    .selection-content::-webkit-scrollbar-thumb {
      background: #CBD5E1;
      border-radius: 3px;
    }

    .selection-content::-webkit-scrollbar-thumb:hover {
      background: #94A3B8;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      gap: 1rem;

      p {
        color: #475569;
        margin: 0;
      }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 3rem;
      gap: 0.75rem;
    }

    .empty-state__icon {
      width: 64px;
      height: 64px;
      border-radius: 9999px;
      background: #F8FAFC;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94A3B8;

      svg {
        width: 32px;
        height: 32px;
      }
    }

    .empty-state h3 {
      font-size: 1.125rem;
      font-weight: 600;
      color: #0F172A;
      margin: 0;
    }

    .empty-state p {
      color: #475569;
      margin: 0;
    }

    /* Focused mode (deep-linked "Book Test"/"Book Package") */
    .focused-actions {
      display: flex;
      gap: 0.75rem;
    }

    .focused-action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: #FFFFFF;
      border: 1px solid #B3CAFF;
      border-radius: 0.625rem;
      color: #0047CC;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: border-color 150ms, background 150ms;

      svg {
        width: 18px;
        height: 18px;
      }

      &:hover {
        background: #EEF4FF;
        border-color: #0047CC;
      }
    }

    /* Header */
    .selection-header {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .selection-tabs {
      display: flex;
      gap: 0.5rem;
      padding: 0.25rem;
      background: #F8FAFC;
      border-radius: 0.75rem;
    }

    .tab-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: transparent;
      border: none;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      transition: all 150ms;

      svg {
        width: 18px;
        height: 18px;
      }

      &:hover {
        color: #0F172A;
        background: #FFFFFF;
      }
    }

    .tab-btn--active {
      background: #FFFFFF;
      color: #002577;
      box-shadow: 0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px -1px rgba(0,0,0,.1);
    }

    .search-row {
      display: flex;
      gap: 0.75rem;

      @media (max-width: 640px) {
        flex-direction: column;
      }
    }

    .search-wrapper {
      flex: 1;
      position: relative;
    }

    .search-input {
      width: 100%;
      padding: 0.75rem 0.75rem 0.75rem 2.5rem;
      border: 1.5px solid #E2E8F0;
      border-radius: 0.75rem;
      background: #FFFFFF;
      font-size: 1rem;
      color: #0F172A;
      transition: all 150ms;

      &:focus {
        outline: none;
        border-color: #0047CC;
        box-shadow: 0 0 0 4px #B3CAFF;
      }

      &::placeholder {
        color: #94A3B8;
      }
    }

    .search-icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      width: 20px;
      height: 20px;
      color: #94A3B8;
    }

    .category-select {
      min-width: 160px;
      padding: 0.75rem;
      border: 1.5px solid #E2E8F0;
      border-radius: 0.75rem;
      background: #FFFFFF;
      font-size: 0.875rem;
      color: #0F172A;
      cursor: pointer;

      &:focus {
        outline: none;
        border-color: #0047CC;
      }
    }

    /* Items Grid */
    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1rem;
    }

    .item-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.875rem;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 0.75rem;
      text-align: left;
      cursor: pointer;
      transition: border-color 150ms, background 150ms;

      &:hover {
        border-color: #84A6FF;
      }
    }

    .item-card--selected {
      border-color: #0047CC;
      background: #EEF4FF;
    }

    .item-card__header {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      /* keep badges clear of the absolutely-positioned selection check */
      padding-right: 1.75rem;
    }

    .item-card__name {
      font-size: 1rem;
      font-weight: 600;
      color: #0F172A;
      margin: 0;
      line-height: 1.375;
    }

    .item-card__desc {
      font-size: 0.875rem;
      color: #475569;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .item-card__footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
      padding-top: 0.75rem;
      border-top: 1px solid #F1F5F9;
    }

    .item-card__price {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }

    .price-current {
      font-size: 1.125rem;
      font-weight: 700;
      color: #0F172A;
    }

    .price-original {
      font-size: 0.875rem;
      color: #94A3B8;
      text-decoration: line-through;
    }

    .item-card__meta {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.875rem;
      color: #475569;

      svg {
        width: 14px;
        height: 14px;
      }
    }

    .item-card__check {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      width: 24px;
      height: 24px;
      border-radius: 9999px;
      background: #0047CC;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transform: scale(0.7);
      transition: all 150ms;

      svg {
        width: 14px;
        height: 14px;
      }
    }

    .item-card__check--visible {
      opacity: 1;
      transform: scale(1);
    }

    /* Packages Grid */
    .packages-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }

    .package-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 0.75rem;
      text-align: left;
      cursor: pointer;
      transition: border-color 150ms, background 150ms;

      &:hover {
        border-color: #84A6FF;
      }
    }

    .package-card--selected {
      border-color: #0047CC;
      background: #EEF4FF;
    }

    .package-card__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
      /* keep the % OFF badge clear of the absolutely-positioned selection check */
      padding-right: 2.5rem;
    }

    .package-card__name {
      font-size: 1.125rem;
      font-weight: 700;
      color: #0F172A;
      margin: 0;
    }

    .package-card__desc {
      font-size: 0.875rem;
      color: #475569;
      margin: 0;
    }

    .package-card__tests {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      background: #F8FAFC;
      border-radius: 0.75rem;
    }

    .package-card__tests-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .package-card__tests-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    .package-card__test-name {
      font-size: 0.875rem;
      color: #0F172A;
      padding: 0.25rem 0.5rem;
      background: #FFFFFF;
      border-radius: 0.25rem;
    }

    .package-card__test-more {
      font-size: 0.875rem;
      color: #003399;
      font-weight: 500;
      padding: 0.25rem 0.5rem;
    }

    .package-card__footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.75rem;
      border-top: 1px solid #F1F5F9;
    }

    .package-card__price {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }

    .package-card__save {
      font-size: 0.875rem;
      font-weight: 600;
      color: #2F855A;
    }

    .package-card__check {
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 28px;
      height: 28px;
      border-radius: 9999px;
      background: #0047CC;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transform: scale(0.7);
      transition: all 150ms;

      svg {
        width: 16px;
        height: 16px;
      }
    }

    .package-card__check--visible {
      opacity: 1;
      transform: scale(1);
    }

    /* Selection Summary */
    .selection-summary {
      padding: 0.875rem 1rem;
      background: #F8FAFC;
      border-radius: 0.75rem;
      border: 1px solid #E2E8F0;
    }

    .summary-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.625rem;

      h4 {
        font-size: 0.875rem;
        font-weight: 700;
        color: #0F172A;
        margin: 0;
      }
    }

    .clear-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      color: #64748B;
      cursor: pointer;
      border-radius: 0.375rem;
      transition: background 0.15s, color 0.15s;

      svg {
        width: 18px;
        height: 18px;
      }

      &:hover {
        background: #FEF2F2;
        color: #DC2626;
      }
    }

    .summary-items {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.5rem 0.625rem;
      background: #FFFFFF;
      border: 1px solid #F1F5F9;
      border-radius: 0.5rem;
    }

    .summary-item__check {
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      border-radius: 9999px;
      background: #ECFDF5;
      color: #059669;
      display: flex;
      align-items: center;
      justify-content: center;

      svg {
        width: 13px;
        height: 13px;
      }
    }

    .summary-item__name {
      flex: 1;
      font-size: 0.8125rem;
      color: #0F172A;
    }

    .summary-item__price {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #0F172A;
    }

    .summary-item__remove {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      border-radius: 9999px;
      color: #94A3B8;
      cursor: pointer;
      transition: all 150ms;

      svg {
        width: 14px;
        height: 14px;
      }

      &:hover {
        background: #FEF2F2;
        color: #DC2626;
      }
    }

    .summary-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.875rem 1rem;
      background: #F8FAFC;
      border-radius: 0.75rem;
      border: 1px solid #E2E8F0;

      span:first-child {
        font-size: 0.875rem;
        font-weight: 600;
        color: #0F172A;
      }
    }

    .summary-total__amount {
      font-size: 1.0625rem;
      font-weight: 700;
      color: #002577;
    }

    /* Step Actions */
    .step-actions {
      display: flex;
      justify-content: space-between;
      padding-top: 1rem;
      border-top: 1px solid #F1F5F9;
    }

    .btn-icon {
      width: 18px;
      height: 18px;
      margin-left: 0.5rem;
    }

    .btn-icon--left {
      margin-left: 0;
      margin-right: 0.5rem;
    }

    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      .item-card,
      .package-card,
      .item-card__check,
      .package-card__check,
      .tab-btn {
        transition: none;
      }
    }

    /* Responsive */
    @media (max-width: 768px) {
      .selection-content {
        max-height: 400px;
      }
    }
  `]
})
export class TestSelectionStepNewComponent implements OnInit {
  @Input() preselectedPackageId: string | null = null;
  @Input() preselectedTestId: string | null = null;
  @Input() embedded = false;

  next = output<void>();
  back = output<void>();

  private testApi = inject(TestApiService);
  private packageApi = inject(PackageApiService);
  readonly store = inject(BookingWizardStore);

  // Make Number available in template
  Number = Number;

  /* State */
  loading = signal(false);
  mode = signal<SelectionMode>('tests');
  tests = signal<Test[]>([]);
  packages = signal<Package[]>([]);
  filteredTests = signal<Test[]>([]);
  filteredPackages = signal<Package[]>([]);
  categories = signal<string[]>([]);
  selectedTests = signal<SelectedItem[]>([]);
  selectedPackages = signal<SelectedItem[]>([]);

  /* True when we arrived via a "Book Test"/"Book Package" deep link: the screen
     stays focused on that single item instead of dumping the whole catalog. */
  focusedMode = signal(false);
  showBrowseModal = signal(false);

  searchQuery = '';
  selectedCategory = '';

  totalAmount = computed(() => {
    const testsTotal = this.selectedTests().reduce((sum, t) => sum + t.price, 0);
    const packagesTotal = this.selectedPackages().reduce((sum, p) => sum + p.price, 0);
    return testsTotal + packagesTotal;
  });

  hasSelection = computed(() => 
    this.selectedTests().length > 0 || this.selectedPackages().length > 0
  );

  ngOnInit(): void {
    /* Resuming a persisted session: reflect prior selections locally too, not
       just in the store, so the cards show as selected instead of resetting empty. */
    this.selectedTests.set(this.store.selectedTests());
    this.selectedPackages.set(this.store.selectedPackages());
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);

    this.testApi.list({ page_size: 100 }).subscribe({
      next: (res) => {
        const activeTests = res.items.filter(t => t.is_active);
        this.tests.set(activeTests);
        this.filteredTests.set(activeTests);
        
        const cats = [...new Set(activeTests.map(t => t.category))].sort();
        this.categories.set(cats);

        /* Preselect test if provided */
        if (this.preselectedTestId) {
          const test = activeTests.find(t => t.id === this.preselectedTestId);
          if (test) {
            this.selectedTests.set([{ id: test.id, name: test.name, price: test.effective_price }]);
            this.focusedMode.set(true);
          }
        }

        this.loadPackages();
      },
      error: () => this.loading.set(false)
    });
  }

  private loadPackages(): void {
    this.packageApi.list({ page_size: 100 }).subscribe({
      next: (res) => {
        // Normalize prices to numbers (backend sends Decimal as strings)
        const activePkgs = res.items
          .filter(p => p.is_active)
          .map(p => ({
            ...p,
            original_price: Number(p.original_price),
            discounted_price: Number(p.discounted_price)
          }));
        this.packages.set(activePkgs);
        this.filteredPackages.set(activePkgs);

        /* Preselect package if provided */
        if (this.preselectedPackageId) {
          const pkg = activePkgs.find(p => p.id === this.preselectedPackageId);
          if (pkg) {
            this.selectedPackages.set([{ id: pkg.id, name: pkg.name, price: Number(pkg.discounted_price) }]);
            this.mode.set('packages');
            this.focusedMode.set(true);
          }
        }

        this.syncFeatureCards();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  setMode(newMode: SelectionMode): void {
    this.mode.set(newMode);
  }

  openBrowseModal(target: SelectionMode): void {
    this.mode.set(target);
    this.showBrowseModal.set(true);
  }

  closeBrowseModal(): void {
    this.showBrowseModal.set(false);
  }

  onSearch(): void {
    this.filterTests();
    this.filterPackages();
  }

  filterPackages(): void {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      this.filteredPackages.set(this.packages());
      return;
    }
    this.filteredPackages.set(this.packages().filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query) ||
      p.tests.some(t => t.name.toLowerCase().includes(query))
    ));
  }

  filterTests(): void {
    let filtered = this.tests();

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(query) || 
        t.category.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }

    if (this.selectedCategory) {
      filtered = filtered.filter(t => t.category === this.selectedCategory);
    }

    this.filteredTests.set(filtered);
  }

  isTestSelected(id: string): boolean {
    return this.selectedTests().some(t => t.id === id);
  }

  isPackageSelected(id: string): boolean {
    return this.selectedPackages().some(p => p.id === id);
  }

  toggleTest(test: Test): void {
    const current = this.selectedTests();
    const exists = current.find(t => t.id === test.id);

    if (exists) {
      this.selectedTests.set(current.filter(t => t.id !== test.id));
    } else {
      this.selectedTests.set([...current, { id: test.id, name: test.name, price: test.effective_price }]);
    }
    this.syncFeatureCards();
  }

  togglePackage(pkg: Package): void {
    const current = this.selectedPackages();
    const exists = current.find(p => p.id === pkg.id);

    if (exists) {
      this.selectedPackages.set(current.filter(p => p.id !== pkg.id));
    } else {
      this.selectedPackages.set([...current, { id: pkg.id, name: pkg.name, price: Number(pkg.discounted_price) }]);
    }
    this.syncFeatureCards();
  }

  removeTest(id: string): void {
    this.selectedTests.update(list => list.filter(t => t.id !== id));
    this.syncFeatureCards();
  }

  removePackage(id: string): void {
    this.selectedPackages.update(list => list.filter(p => p.id !== id));
    this.syncFeatureCards();
  }

  clearSelection(): void {
    this.selectedTests.set([]);
    this.selectedPackages.set([]);
    this.syncFeatureCards();
  }

  canProceed(): boolean {
    return this.hasSelection();
  }

  /** Push the current selection and the deduped union of enabled feature cards
      into the wizard store, live, so an embedded sibling step (or a refresh)
      sees the choice right away, and the "Why Choose This Test" panel stays live. */
  private syncFeatureCards(): void {
    this.store.patch({ selectedTests: this.selectedTests(), selectedPackages: this.selectedPackages() });

    const selectedTestIds = new Set(this.selectedTests().map(t => t.id));
    const selectedPkgIds = new Set(this.selectedPackages().map(p => p.id));

    const sourceTests: Test[] = [
      ...this.tests().filter(t => selectedTestIds.has(t.id)),
      ...this.packages().filter(p => selectedPkgIds.has(p.id)).flatMap(p => p.tests),
    ];

    const byTitle = new Map<string, FeatureCardItem>();
    for (const test of sourceTests) {
      for (const card of test.feature_cards ?? []) {
        if (!card.enabled) continue;
        const key = card.title.trim().toLowerCase();
        if (!byTitle.has(key)) byTitle.set(key, card);
      }
    }

    const cards = [...byTitle.values()].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    this.store.patch({ selectedFeatureCards: cards });
  }

  getSavingsPercent(pkg: Package): number {
    const original = Number(pkg.original_price);
    const discounted = Number(pkg.discounted_price);
    if (original <= 0 || original <= discounted) return 0;
    return Math.round(((original - discounted) / original) * 100);
  }

  onNext(): void {
    if (!this.canProceed()) return;
    this.next.emit();
  }
}
