import { Component, computed, inject, Input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookingWizardStore } from '../../../core/store/booking-wizard.store';
import { ServiceAreaApiService } from '../../../core/api/services/service-area-api.service';
import { ContactSettingsApiService } from '../../../core/api/services/contact-settings-api.service';
import { LabBranchApiService } from '../../../core/api/services/lab-branch-api.service';
import { UserApiService } from '../../../core/api/services/user-api.service';
import { SettingsApiService, CancellationSetting } from '../../../core/api/services/settings-api.service';
import { ContactSettings, LabBranch, Serviceability, UserAddress } from '../../../core/api/api.types';
import { ButtonComponent, SpinnerComponent, BadgeComponent, ModalComponent, AlertComponent } from '../../../shared/components';

type CollectionType = 'home' | 'lab';

@Component({
  selector: 'app-collection-type-step-new',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule, ButtonComponent, SpinnerComponent, BadgeComponent, ModalComponent, AlertComponent],
  template: `
    <div class="collection-step">
      <!-- Collection Type Selection -->
      <div class="type-toggle">
        <button
          type="button"
          class="type-btn"
          [class.type-btn--active]="collectionType() === 'home'"
          (click)="selectType('home')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Home Collection
        </button>
        <button
          type="button"
          class="type-btn"
          [class.type-btn--active]="collectionType() === 'lab'"
          (click)="selectType('lab')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
            <path d="M9 22v-4h6v4"/>
            <path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/>
            <path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/>
            <path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>
          </svg>
          Visit Lab
        </button>
      </div>

      <a routerLink="/available-locations" target="_blank" rel="noopener" class="check-locations-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        Not sure if we cover your area? Check serviceable locations
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="check-locations-link__arrow">
          <path d="M7 17L17 7"/><path d="M7 7h10v10"/>
        </svg>
      </a>

      <!-- Home Collection Summary -->
      @if (collectionType() === 'home') {
        @if (cancellationNoticeText()) {
          <div class="notice-banner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{{ cancellationNoticeText() }}</span>
          </div>
        }

        <div class="selection-card">
          <button type="button" class="selection-btn" (click)="openAddressBrowser()">
            @if (selectedAddress(); as addr) {
              <div class="selection-btn__content">
                <div class="selection-btn__row">
                  <span class="selection-btn__label">{{ addr.label }}</span>
                  @if (addr.is_default) {
                    <app-badge variant="info" size="sm">Default</app-badge>
                  }
                </div>
                <span class="selection-btn__text">{{ addr.address_line1 }}, {{ addr.city }} - {{ addr.pincode }}</span>
                @if (checkingServiceability()) {
                  <span class="sv-badge sv-badge--checking">
                    <app-spinner size="sm" />
                    Checking availability...
                  </span>
                } @else {
                  @if (serviceabilityFor(addr); as sv) {
                    <span class="sv-badge" [class.sv-badge--yes]="sv.serviceable" [class.sv-badge--no]="!sv.serviceable">
                      <span class="sv-badge__dot"></span>
                      {{ sv.serviceable ? 'Home Collection Available' : 'Home Collection Not Available' }}
                    </span>
                  }
                }
              </div>
            } @else if (loadingAddresses()) {
              <span class="selection-btn__placeholder">Loading addresses...</span>
            } @else {
              <span class="selection-btn__placeholder">Select delivery address</span>
            }
            <span class="selection-btn__change">Change</span>
          </button>

          <!-- No dead end: whenever the chosen address can't be served, offer a way forward,
               right on the same card instead of a separate banner underneath. -->
          @if (unavailableSelection()) {
            <button type="button" class="selection-card__footer" (click)="openUnavailableOptions()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>Home Collection isn't available for this address.</span>
              <span class="selection-card__footer-action">View Options</span>
            </button>
          }
        </div>
      }

      <!-- Lab Visit Summary -->
      @if (collectionType() === 'lab') {
        <div class="selection-card">
          <button type="button" class="selection-btn" (click)="openLabBrowser()">
            @if (selectedLab(); as lab) {
              <div class="selection-btn__content">
                <span class="selection-btn__label">{{ lab.name }}</span>
                <span class="selection-btn__text">{{ lab.address }}, {{ lab.city }} - {{ lab.pincode }}</span>
              </div>
            } @else if (loadingBranches()) {
              <span class="selection-btn__placeholder">Loading laboratories...</span>
            } @else {
              <span class="selection-btn__placeholder">Select laboratory</span>
            }
            <span class="selection-btn__change">Change</span>
          </button>
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
          <app-button variant="primary" size="lg" [disabled]="!canProceed()" (click)="onNext()">
            Continue
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </app-button>
        </div>
      }
    </div>

    <!-- Address Browser Modal -->
    <app-modal [isOpen]="showAddressBrowser()" title="Select Delivery Address" size="md" (close)="closeAddressBrowser()">
      @if (loadingAddresses()) {
        <div class="loading-inline">
          <app-spinner size="sm" />
          <span>Loading addresses...</span>
        </div>
      } @else if (addresses().length === 0) {
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <p class="empty-state__title">No saved addresses found.</p>
          <p class="empty-state__desc">Add your delivery address to check Home Collection availability.</p>
          <app-button variant="primary" size="sm" (click)="openAddressModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon btn-icon--left">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Address
          </app-button>
        </div>
      } @else {
        <div class="address-list">
          @for (addr of addresses(); track addr.id) {
            <!-- Wrapper so Edit can sit visually inside the card without
                 nesting a button inside the card's own button. -->
            <div class="address-row">
              <button
                type="button"
                class="address-card"
                [class.address-card--selected]="selectedAddressId() === addr.id"
                [class.address-card--unavailable]="isUnavailable(addr)"
                (click)="selectAddress(addr)"
              >
                <div class="address-card__header">
                  <span class="address-card__label">{{ addr.label }}</span>
                  @if (addr.is_default) {
                    <app-badge variant="info" size="sm">Default</app-badge>
                  }
                </div>
                <p class="address-card__text">
                  {{ addr.address_line1 }}
                  @if (addr.address_line2) {
                    , {{ addr.address_line2 }}
                  }
                  , {{ addr.city }} - {{ addr.pincode }}
                </p>

                <!-- Serviceability badge: the user knows before pressing Continue -->
                @if (checkingServiceability()) {
                  <span class="sv-badge sv-badge--checking">
                    <app-spinner size="sm" />
                    Checking availability...
                  </span>
                } @else {
                  @if (serviceabilityFor(addr); as sv) {
                    <span class="sv-badge" [class.sv-badge--yes]="sv.serviceable" [class.sv-badge--no]="!sv.serviceable">
                      <span class="sv-badge__dot"></span>
                      {{ sv.serviceable ? 'Home Collection Available' : 'Home Collection Not Available' }}
                    </span>
                  }
                }

                <div class="address-card__check" [class.address-card__check--visible]="selectedAddressId() === addr.id">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              </button>

              <button
                type="button"
                class="address-edit"
                [attr.aria-label]="'Edit address ' + addr.label"
                (click)="openAddressModal(addr)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </button>

              @if (isUnavailable(addr)) {
                <button type="button" class="selection-card__footer" (click)="selectAddressAndViewOptions(addr)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>Home Collection isn't available for this address.</span>
                  <span class="selection-card__footer-action">View Options</span>
                </button>
              }
            </div>
          }
        </div>

        <button type="button" class="add-another" (click)="openAddressModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add New Address
        </button>
      }

      <div modal-footer>
        <app-button variant="primary" (click)="closeAddressBrowser()">Done</app-button>
      </div>
    </app-modal>

    <!-- Lab Browser Modal -->
    <app-modal [isOpen]="showLabBrowser()" title="Select Laboratory" size="md" (close)="closeLabBrowser()">
      @if (loadingBranches()) {
        <div class="loading-inline">
          <app-spinner size="sm" />
          <span>Loading laboratories...</span>
        </div>
      } @else if (labBranches().length === 0) {
        <div class="no-labs">
          <p>No laboratories available in your area</p>
        </div>
      } @else {
        <div class="lab-list">
          @for (lab of labBranches(); track lab.id) {
            <button
              type="button"
              class="lab-card"
              [class.lab-card--selected]="selectedLabId() === lab.id"
              (click)="selectLab(lab)"
            >
              <div class="lab-card__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                  <path d="M9 22v-4h6v4"/>
                </svg>
              </div>
              <div class="lab-card__content">
                <h5 class="lab-card__name">{{ lab.name }}</h5>
                <p class="lab-card__address">{{ lab.address }}, {{ lab.city }} - {{ lab.pincode }}</p>
                @if (lab.operating_hours) {
                  <span class="lab-card__hours">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    {{ lab.operating_hours }}
                  </span>
                }
              </div>
              <div class="lab-card__check" [class.lab-card__check--visible]="selectedLabId() === lab.id">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            </button>
          }
        </div>
      }

      <div modal-footer>
        <app-button variant="primary" (click)="closeLabBrowser()">Done</app-button>
      </div>
    </app-modal>

    <!-- Unavailable Address: Options Modal -->
    <app-modal [isOpen]="showUnavailableOptions()" title="Choose How to Proceed" size="md" (close)="closeUnavailableOptions()">
      @if (unavailableSelection(); as sv) {
        <p class="action-panel__sub">
          {{ sv.message }}
          @if (hasOtherServiceableAddress()) {
            Pick one of your other saved addresses, or choose an option below.
          } @else {
            Don't worry — you can still continue your booking with one of these options.
          }
        </p>
      }

      <div class="action-panel__options">
        <div class="opt">
          <span class="opt__icon opt__icon--add">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </span>
          <h5 class="opt__title">Add New Address</h5>
          <p class="opt__desc">Add another address to check if Home Collection is available in your area.</p>
          <app-button variant="primary" size="sm" (click)="openAddressModal()">+ Add New Address</app-button>
        </div>

        <div class="opt">
          <span class="opt__icon opt__icon--lab">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
              <path d="M9 22v-4h6v4"/>
            </svg>
          </span>
          <h5 class="opt__title">Switch to Lab Visit</h5>
          <p class="opt__desc">Continue your booking by visiting the laboratory.</p>
          <app-button variant="outline" size="sm" (click)="switchToLabVisit(); closeUnavailableOptions()">Choose Lab Visit</app-button>
        </div>

        @if (showCallOption()) {
          <div class="opt">
            <span class="opt__icon opt__icon--call">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
            </span>
            <h5 class="opt__title">Book via Call</h5>
            <p class="opt__desc">Our support team can help arrange your booking or suggest the nearest available collection area.</p>
            <div class="opt__contact">
              <span class="opt__contact-label">Call Support</span>
              <span class="opt__contact-number">{{ contact()?.phone_number }}</span>
              @if (contact()?.working_hours) {
                <span class="opt__contact-hours">{{ contact()?.working_hours }}</span>
              }
            </div>
            <div class="opt__actions">
              @if (contact()?.call_enabled) {
                <a class="opt__btn opt__btn--call" [href]="callHref()">Call Now</a>
              }
              @if (contact()?.whatsapp_enabled) {
                <a class="opt__btn opt__btn--wa" [href]="whatsappHref()" target="_blank" rel="noopener">WhatsApp</a>
              }
            </div>
          </div>
        }
      </div>
    </app-modal>

    <!-- Add Address Modal -->
    <app-modal
      [isOpen]="showAddAddress()"
      [title]="editingAddressId() ? 'Edit Address' : 'Add New Address'"
      size="md"
      (close)="closeAddressModal()"
    >
      @if (addressError()) {
        <app-alert type="error" [dismissible]="true" (dismiss)="addressError.set(null)">
          {{ addressError() }}
        </app-alert>
      }

      <form [formGroup]="addressForm" (ngSubmit)="saveAddress()" class="address-form">
        <div class="form-row">
          <div class="form-group">
            <label for="label">Address Label *</label>
            <input 
              id="label"
              type="text" 
              formControlName="label"
              placeholder="e.g. Home, Office, etc."
              class="form-input"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="address_line1">Address Line 1 *</label>
            <input 
              id="address_line1"
              type="text" 
              formControlName="address_line1"
              placeholder="House/Flat no, Building name"
              class="form-input"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="address_line2">Address Line 2</label>
            <input 
              id="address_line2"
              type="text" 
              formControlName="address_line2"
              placeholder="Street, Area, Landmark (optional)"
              class="form-input"
            />
          </div>
        </div>

        <div class="form-row form-row--2">
          <div class="form-group">
            <label for="city">City *</label>
            <input 
              id="city"
              type="text" 
              formControlName="city"
              placeholder="City"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="state">State *</label>
            <input 
              id="state"
              type="text" 
              formControlName="state"
              placeholder="State"
              class="form-input"
            />
          </div>
        </div>

        <div class="form-row form-row--2">
          <div class="form-group">
            <label for="pincode">Pincode *</label>
            <input 
              id="pincode"
              type="text" 
              formControlName="pincode"
              placeholder="6-digit pincode"
              maxlength="6"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                formControlName="is_default"
                class="checkbox-input"
              />
              <span>Set as default address</span>
            </label>
          </div>
        </div>
      </form>

      <div modal-footer>
        <app-button variant="outline" (click)="closeAddressModal()" [disabled]="savingAddress()">
          Cancel
        </app-button>
        <app-button 
          variant="primary" 
          (click)="saveAddress()" 
          [disabled]="addressForm.invalid || savingAddress()"
          [loading]="savingAddress()"
        >
          {{ editingAddressId() ? 'Update Address' : 'Save Address' }}
        </app-button>
      </div>
    </app-modal>
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

    .collection-step {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* Collection Type Selection — two distinct, independently-bordered
       cards rather than a single segmented bar, so "pick one of two
       options" reads clearly instead of looking like a tab strip. */
    .type-toggle {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }

    .type-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.875rem 1rem;
      background: #FFFFFF;
      border: 1.5px solid #E2E8F0;
      border-radius: 0.75rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: all 150ms;

      svg {
        width: 20px;
        height: 20px;
        color: #94A3B8;
        transition: color 150ms;
      }

      &:hover {
        border-color: #84A6FF;
        color: #0F172A;
      }
    }

    .type-btn--active {
      border-color: #0047CC;
      background: #EEF4FF;
      color: #002577;

      svg {
        color: #0047CC;
      }
    }

    .check-locations-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #475569;
      text-decoration: none;

      svg {
        width: 15px;
        height: 15px;
        flex-shrink: 0;
        color: #94A3B8;
      }

      &:hover {
        color: #0047CC;

        svg {
          color: #0047CC;
        }
      }
    }

    .check-locations-link__arrow {
      width: 12px !important;
      height: 12px !important;
    }

    /* Details Section */
    .notice-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      background: #EEF4FF;
      border: 1px solid #B3CAFF;
      color: #001B57;
      border-radius: 0.75rem;
      padding: 0.875rem 1rem;
      font-size: 0.8125rem;
      line-height: 1.5;
      margin-bottom: 1rem;

      svg {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        margin-top: 1px;
      }
    }

    /* Compact selection trigger — opens the browse modal instead of showing
       the full address/lab list inline. */
    /* Wraps the selection-btn (and, when the address is unserviceable, the
       footer strip below it) as a single visual card instead of two stacked
       boxes with a gap between them. */
    .selection-card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 0.75rem;
      overflow: hidden;
      transition: border-color 150ms;

      &:has(.selection-btn:hover) {
        border-color: #84A6FF;
      }
    }

    .selection-btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      width: 100%;
      padding: 0.875rem 1rem;
      background: transparent;
      border: none;
      text-align: left;
      cursor: pointer;
    }

    .selection-btn__content {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 0;
      flex: 1;
    }

    .selection-btn__row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .selection-btn__label {
      font-size: 0.9375rem;
      font-weight: 600;
      color: #0F172A;
    }

    .selection-btn__text {
      font-size: 0.8125rem;
      color: #475569;
    }

    .selection-btn__placeholder {
      font-size: 0.875rem;
      color: #94A3B8;
    }

    .selection-btn__change {
      flex-shrink: 0;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #0047CC;
    }

    .loading-inline {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      color: #475569;
    }

    .no-labs {
      padding: 1.5rem;
      text-align: center;
      color: #475569;

      p {
        margin: 0 0 0.75rem 0;
      }
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 2rem 1.5rem;
      background: #FFFFFF;
      border: 1px dashed #CBD5E1;
      border-radius: 0.75rem;
    }

    .empty-state__icon {
      width: 48px;
      height: 48px;
      border-radius: 9999px;
      background: #EEF4FF;
      color: #0047CC;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.875rem;

      svg {
        width: 24px;
        height: 24px;
      }
    }

    .empty-state__title {
      font-size: 0.9375rem;
      font-weight: 600;
      color: #0F172A;
      margin: 0 0 0.25rem 0;
    }

    .empty-state__desc {
      font-size: 0.875rem;
      color: #475569;
      margin: 0 0 1rem 0;
      max-width: 34ch;
      line-height: 1.5;
    }

    /* Address Cards */
    .address-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .address-row {
      position: relative;
      border: 1px solid #E2E8F0;
      border-radius: 0.75rem;
      overflow: hidden;
      transition: border-color 150ms;

      &:has(.address-card--selected) {
        border-color: #0047CC;
      }
    }

    .address-edit {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      background: transparent;
      border: 1px solid #E2E8F0;
      border-radius: 0.5rem;
      color: #475569;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 150ms;

      svg {
        width: 13px;
        height: 13px;
      }

      &:hover {
        border-color: #0047CC;
        color: #0047CC;
        background: #FFFFFF;
      }

      &:focus-visible {
        outline: none;
        border-color: #0047CC;
        box-shadow: 0 0 0 3px rgba(0, 71, 204, 0.15);
      }
    }

    .address-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      /* Room on the right for the Edit button and the selected check. */
      padding: 0.75rem 5.5rem 0.75rem 0.875rem;
      width: 100%;
      background: #FFFFFF;
      border: none;
      text-align: left;
      cursor: pointer;
      transition: background 150ms;

      &:hover {
        background: #F8FAFC;
      }
    }

    .address-card--selected {
      background: #EEF4FF;
    }

    .address-card__header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .address-card__label {
      font-weight: 600;
      color: #0F172A;
    }

    .address-card__text {
      font-size: 0.875rem;
      color: #475569;
      margin: 0;
    }

    .address-card__city {
      font-size: 0.875rem;
      color: #94A3B8;
      margin: 0;
    }

    .address-card__check {
      position: absolute;
      top: 50%;
      right: 1rem;
      transform: translateY(-50%) scale(0.7);
      width: 24px;
      height: 24px;
      border-radius: 9999px;
      background: #0047CC;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: all 150ms;

      svg {
        width: 14px;
        height: 14px;
      }
    }

    .address-card__check--visible {
      opacity: 1;
      transform: translateY(-50%) scale(1);
    }

    .address-card--unavailable {
      background: #FFFFFF;
      border-color: #E2E8F0;
    }

    .address-card--unavailable.address-card--selected {
      border-color: #F59E0B;
      background: #FFFBEB;
    }

    /* Serviceability Badge */
    .sv-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      margin-top: 0.25rem;
      padding: 0.25rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      align-self: flex-start;
    }

    .sv-badge__dot {
      width: 7px;
      height: 7px;
      border-radius: 9999px;
      background: currentColor;
      flex-shrink: 0;
    }

    .sv-badge--yes {
      background: #ECFDF5;
      color: #047857;
    }

    .sv-badge--no {
      background: #FEF3C7;
      color: #B45309;
    }

    .sv-badge--checking {
      background: #F1F5F9;
      color: #64748B;
    }

    /* Action Panel — the "no dead end" fallback */
    /* Compact warning banner that opens the recovery-options modal */
    .selection-card__footer {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      width: 100%;
      padding: 0.625rem 1rem;
      background: #FFFBEB;
      border: none;
      border-top: 1px solid #FDE68A;
      color: #92400E;
      font-size: 0.75rem;
      text-align: left;
      cursor: pointer;
      transition: background 150ms;

      svg {
        width: 16px;
        height: 16px;
        color: #B45309;
        flex-shrink: 0;
      }

      span:first-of-type {
        flex: 1;
      }

      &:hover {
        background: #FEF3C7;
      }
    }

    .selection-card__footer-action {
      flex-shrink: 0;
      font-weight: 600;
      color: #B45309;
    }

    .action-panel__sub {
      font-size: 0.8125rem;
      color: #92400E;
      margin: 0;
      line-height: 1.5;
    }

    .action-panel__options {
      display: grid;
      /* Sized against the panel, not the viewport: this sits in a ~550px wizard
         column, where a viewport media query would still force three cramped
         columns and wrap the support number mid-digits. */
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.75rem;
    }

    .opt {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.375rem;
      padding: 1rem;
      background: #FFFFFF;
      border: 1px solid #F1F5F9;
      border-radius: 0.75rem;
    }

    .opt__icon {
      width: 36px;
      height: 36px;
      border-radius: 0.625rem;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.25rem;

      svg {
        width: 18px;
        height: 18px;
      }
    }

    .opt__icon--add { background: #EEF4FF; color: #0047CC; }
    .opt__icon--lab { background: #D9E5FF; color: #002577; }
    .opt__icon--call { background: #ECFDF5; color: #047857; }

    .opt__title {
      font-size: 0.9375rem;
      font-weight: 600;
      color: #0F172A;
      margin: 0;
    }

    .opt__desc {
      font-size: 0.8125rem;
      color: #475569;
      margin: 0 0 0.5rem 0;
      line-height: 1.5;
      flex: 1;
    }

    .opt__contact {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      margin-bottom: 0.625rem;
    }

    .opt__contact-label {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #94A3B8;
    }

    .opt__contact-number {
      font-size: 1rem;
      font-weight: 700;
      color: #0F172A;
      /* A phone number broken across lines is unreadable — keep it on one. */
      white-space: nowrap;
    }

    .opt__contact-hours {
      font-size: 0.75rem;
      color: #64748B;
    }

    .opt__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .opt__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 36px;
      padding: 0 0.875rem;
      border-radius: 0.625rem;
      font-size: 0.8125rem;
      font-weight: 600;
      text-decoration: none;
      transition: filter 150ms;

      &:hover { filter: brightness(0.95); }
    }

    .opt__btn--call {
      background: #0047CC;
      color: #FFFFFF;
    }

    .opt__btn--wa {
      background: #ECFDF5;
      color: #047857;
      border: 1px solid #A7F3D0;
    }

    /* Add another address */
    .add-another {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
      padding: 0.5rem 0.875rem;
      background: transparent;
      border: 1px dashed #CBD5E1;
      border-radius: 0.75rem;
      color: #0047CC;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 150ms;

      svg {
        width: 16px;
        height: 16px;
      }

      &:hover {
        border-color: #0047CC;
        background: #EEF4FF;
      }
    }

    /* Lab Cards */
    .lab-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .lab-card {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 0.75rem;
      text-align: left;
      cursor: pointer;
      transition: all 150ms;

      &:hover {
        border-color: #84A6FF;
      }
    }

    .lab-card--selected {
      border-color: #0047CC;
      background: #EEF4FF;
    }

    .lab-card__icon {
      width: 44px;
      height: 44px;
      border-radius: 0.75rem;
      background: #D9E5FF;
      color: #002577;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      svg {
        width: 22px;
        height: 22px;
      }
    }

    .lab-card__content {
      flex: 1;
      min-width: 0;
    }

    .lab-card__name {
      font-size: 1rem;
      font-weight: 600;
      color: #0F172A;
      margin: 0 0 0.25rem 0;
    }

    .lab-card__address {
      font-size: 0.875rem;
      color: #475569;
      margin: 0 0 0.5rem 0;
    }

    .lab-card__hours {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      color: #94A3B8;

      svg {
        width: 14px;
        height: 14px;
      }
    }

    .lab-card__check {
      position: absolute;
      top: 50%;
      right: 1rem;
      transform: translateY(-50%) scale(0.7);
      width: 24px;
      height: 24px;
      border-radius: 9999px;
      background: #0047CC;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: all 150ms;

      svg {
        width: 14px;
        height: 14px;
      }
    }

    .lab-card__check--visible {
      opacity: 1;
      transform: translateY(-50%) scale(1);
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

    @media (prefers-reduced-motion: reduce) {
      .type-btn,
      .address-card,
      .address-card__check,
      .lab-card,
      .lab-card__check {
        transition: none;
      }
    }

    /* Address Form */
    .address-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-row {
      display: grid;
      gap: 1rem;
    }

    .form-row--2 {
      grid-template-columns: repeat(2, 1fr);

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      label {
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
      }
    }

    .form-input {
      width: 100%;
      height: 44px;
      padding: 0 14px;
      border: 1px solid #E2E8F0;
      border-radius: 0.75rem;
      font-size: 0.875rem;
      color: #0F172A;
      transition: border-color 0.2s, box-shadow 0.2s;

      &:focus {
        outline: none;
        border-color: #0047CC;
        box-shadow: 0 0 0 3px rgba(0, 71, 204, 0.1);
      }

      &::placeholder {
        color: #94A3B8;
      }
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      padding-top: 1.75rem;

      span {
        font-size: 0.875rem;
        color: #475569;
      }
    }

    .checkbox-input {
      width: 18px;
      height: 18px;
      border-radius: 0.25rem;
      border: 2px solid #E2E8F0;
      cursor: pointer;
      transition: all 0.2s;

      &:checked {
        background-color: #0047CC;
        border-color: #0047CC;
      }

      &:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(0, 71, 204, 0.1);
      }
    }
  `]
})
export class CollectionTypeStepNewComponent implements OnInit {
  @Input() embedded = false;

  next = output<void>();
  back = output<void>();

  private serviceAreaApi = inject(ServiceAreaApiService);
  private contactSettingsApi = inject(ContactSettingsApiService);
  private labBranchApi = inject(LabBranchApiService);
  private userApi = inject(UserApiService);
  private settingsApi = inject(SettingsApiService);
  private fb = inject(FormBuilder);
  readonly store = inject(BookingWizardStore);

  /* State */
  collectionType = signal<CollectionType | null>(null);
  cancellationSetting = signal<CancellationSetting | null>(null);
  contact = signal<ContactSettings | null>(null);
  addresses = signal<UserAddress[]>([]);
  labBranches = signal<LabBranch[]>([]);
  /* Serviceability verdicts keyed by pincode, as returned by the backend rules engine. */
  serviceability = signal<Record<string, Serviceability>>({});
  checkingServiceability = signal(false);
  selectedAddressId = signal<string | null>(null);
  selectedLabId = signal<string | null>(null);
  loadingAddresses = signal(false);
  loadingBranches = signal(false);
  showAddAddress = signal(false);
  /* The "browse & pick" modals opened from the compact selection button. */
  showAddressBrowser = signal(false);
  showLabBrowser = signal(false);
  showUnavailableOptions = signal(false);
  /* Non-null when the modal is editing an existing address rather than adding one. */
  editingAddressId = signal<string | null>(null);
  savingAddress = signal(false);
  addressError = signal<string | null>(null);

  /* The verdict for the currently selected address, once it has been checked. */
  selectedServiceability = computed<Serviceability | null>(() => {
    const addr = this.addresses().find(a => a.id === this.selectedAddressId());
    return addr ? this.serviceability()[addr.pincode] ?? null : null;
  });

  /* Non-null only when the selected address is known to be unserviceable — drives the action panel. */
  unavailableSelection = computed<Serviceability | null>(() => {
    const sv = this.selectedServiceability();
    return sv && !sv.serviceable ? sv : null;
  });

  /* Whether some *other* saved address can be served, so we can point the user at it. */
  hasOtherServiceableAddress = computed(() =>
    this.addresses().some(
      a => a.id !== this.selectedAddressId() && this.serviceability()[a.pincode]?.serviceable
    )
  );

  /* The call card needs at least one reachable channel and a number to show. */
  showCallOption = computed(() => {
    const c = this.contact();
    return !!c && !!c.phone_number && (c.call_enabled || c.whatsapp_enabled);
  });

  selectedAddress = computed(() => this.addresses().find(a => a.id === this.selectedAddressId()) ?? null);
  selectedLab = computed(() => this.labBranches().find(l => l.id === this.selectedLabId()) ?? null);

  /* Address Form */
  addressForm = this.fb.group({
    label: ['', Validators.required],
    address_line1: ['', Validators.required],
    address_line2: [''],
    city: ['', Validators.required],
    state: ['', Validators.required],
    pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    is_default: [false]
  });

  ngOnInit(): void {
    this.loadLabBranches();
    this.settingsApi.getCancellationSetting().subscribe({
      next: s => this.cancellationSetting.set(s),
      error: () => this.cancellationSetting.set(null),
    });
    this.contactSettingsApi.get().subscribe({
      next: c => this.contact.set(c),
      error: () => this.contact.set(null),
    });

    /* Resuming a persisted session: reflect the prior choice locally too, not
       just in the store, so the toggle/address/lab show as selected. */
    const restoredType = this.store.collectionType();
    if (restoredType === 'home') {
      this.collectionType.set('home');
      this.selectedAddressId.set(this.store.selectedAddressId());
      this.loadAddresses();
    } else if (restoredType === 'lab') {
      this.collectionType.set('lab');
      this.selectedLabId.set(this.store.labBranchId());
    }
  }

  cancellationNoticeText(): string {
    const s = this.cancellationSetting();
    if (!s) return '';
    const amount = s.charge_type === 'percentage' ? `${s.charge_value}%` : `₹${s.charge_value}`;
    return `Home Collection bookings may incur a ${amount} cancellation charge if cancelled after confirmation or technician assignment.`;
  }

  private loadLabBranches(): void {
    this.loadingBranches.set(true);
    this.labBranchApi.list().subscribe({
      next: (labs) => {
        const active = labs.filter(l => l.is_active);
        this.labBranches.set(active);
        this.loadingBranches.set(false);

        /* Only one lab in the whole network — nothing to actually choose,
           so pick it silently instead of making the user open a picker for it. */
        if (active.length === 1 && !this.selectedLabId()) {
          this.selectedLabId.set(active[0].id);
          if (this.collectionType() === 'lab') this.commitSelection();
        }
      },
      error: () => this.loadingBranches.set(false)
    });
  }

  selectType(type: CollectionType): void {
    this.collectionType.set(type);

    if (type === 'home') {
      this.selectedLabId.set(null);
      this.loadAddresses();
      this.showAddressBrowser.set(true);
    } else {
      this.selectedAddressId.set(null);

      if (this.labBranches().length === 1) {
        this.selectedLabId.set(this.labBranches()[0].id);
      } else {
        this.showLabBrowser.set(this.labBranches().length > 1);
      }
    }

    this.commitSelection();
  }

  openAddressBrowser(): void {
    this.showAddressBrowser.set(true);
  }

  closeAddressBrowser(): void {
    this.showAddressBrowser.set(false);
  }

  openLabBrowser(): void {
    if (this.labBranches().length <= 1) return;
    this.showLabBrowser.set(true);
  }

  closeLabBrowser(): void {
    this.showLabBrowser.set(false);
  }

  openUnavailableOptions(): void {
    this.showUnavailableOptions.set(true);
  }

  closeUnavailableOptions(): void {
    this.showUnavailableOptions.set(false);
  }

  /** Patches the store immediately so an embedded sibling step (e.g. the slot
      picker, which reads store.collectionType()) or a refresh sees the choice
      right away, rather than waiting for this step's own Continue. */
  private commitSelection(): void {
    const selectedAddr = this.addresses().find(a => a.id === this.selectedAddressId());

    this.store.patch({
      collectionType: this.collectionType(),
      selectedAddressId: this.selectedAddressId(),
      pincode: selectedAddr?.pincode ?? null,
      labBranchId: this.selectedLabId(),
    });
  }

  /** Option 2 on the action panel: keep the booking alive by switching mode in place. */
  switchToLabVisit(): void {
    this.selectType('lab');
  }

  private loadAddresses(): void {
    this.loadingAddresses.set(true);
    this.userApi.getAddresses().subscribe({
      next: (res) => {
        this.addresses.set(res.items);
        this.loadingAddresses.set(false);
        /* A restored session already knows which address it wants — keep it (as
           long as it still exists) rather than jumping back to the default. */
        const restored = this.selectedAddressId()
          ? res.items.find(a => a.id === this.selectedAddressId())
          : undefined;
        const preferred = restored ?? res.items.find(a => a.is_default) ?? res.items[0];
        if (preferred) {
          this.selectedAddressId.set(preferred.id);
          this.commitSelection();
        }

        /* Badge every card up front, so serviceability is known before Continue. */
        this.checkAddresses(res.items, { preferServiceable: true });
      },
      error: () => this.loadingAddresses.set(false)
    });
  }

  /**
   * Ask the backend which of these addresses we can serve — one batched round trip.
   * `preferServiceable` is for the initial load only: nudging the selection is helpful
   * when we picked the address, but not after the user deliberately chose or added one.
   */
  private checkAddresses(addrs: UserAddress[], opts: { preferServiceable?: boolean } = {}): void {
    const pincodes = [...new Set(addrs.map(a => a.pincode).filter(Boolean))];
    if (pincodes.length === 0) return;

    this.checkingServiceability.set(true);
    this.serviceAreaApi.checkServiceability(pincodes).subscribe({
      next: (results) => {
        this.serviceability.update(current => {
          const next = { ...current };
          for (const r of results) next[r.pincode] = r;
          return next;
        });
        this.checkingServiceability.set(false);
        if (opts.preferServiceable) this.preferServiceableAddress();
      },
      /* On failure leave verdicts unknown: cards show no badge and Continue stays
         disabled rather than promising a collection we may not be able to make. */
      error: () => this.checkingServiceability.set(false)
    });
  }

  /** If the auto-selected address can't be served but another can, move the user there. */
  private preferServiceableAddress(): void {
    if (this.selectedServiceability()?.serviceable !== false) return;

    const serviceable = this.addresses().find(a => this.serviceability()[a.pincode]?.serviceable);
    if (serviceable) {
      this.selectedAddressId.set(serviceable.id);
      this.commitSelection();
    }
  }

  selectAddress(addr: UserAddress): void {
    this.selectedAddressId.set(addr.id);
    this.commitSelection();

    /* Verdicts are pre-fetched for saved addresses; this only fires for a pincode
       we haven't seen yet (e.g. an address added from another tab). */
    if (!this.serviceability()[addr.pincode]) {
      this.checkAddresses([addr]);
    }
  }

  /** "View Options" clicked directly on an address row in the browse list —
      select it first so the options modal reflects *that* address, not
      whichever one happened to be selected before. */
  selectAddressAndViewOptions(addr: UserAddress): void {
    this.selectAddress(addr);
    this.openUnavailableOptions();
  }

  serviceabilityFor(addr: UserAddress): Serviceability | null {
    return this.serviceability()[addr.pincode] ?? null;
  }

  isUnavailable(addr: UserAddress): boolean {
    return this.serviceabilityFor(addr)?.serviceable === false;
  }

  callHref(): string {
    const phone = this.contact()?.phone_number ?? '';
    return `tel:${phone.replace(/[^\d+]/g, '')}`;
  }

  whatsappHref(): string {
    const number = (this.contact()?.whatsapp_number ?? '').replace(/\D/g, '');
    const pincode = this.unavailableSelection()?.pincode ?? '';
    const text = encodeURIComponent(
      `Hi, I'd like to book a home collection${pincode ? ` for PIN Code ${pincode}` : ''}.`
    );
    return `https://wa.me/${number}?text=${text}`;
  }

  selectLab(lab: LabBranch): void {
    this.selectedLabId.set(lab.id);
    this.commitSelection();
  }

  /** Opens the modal to add a new address, or to edit `address` when given. */
  openAddressModal(address?: UserAddress): void {
    this.editingAddressId.set(address?.id ?? null);
    this.showAddAddress.set(true);
    this.addressError.set(null);

    if (address) {
      this.addressForm.reset({
        label: address.label,
        address_line1: address.address_line1,
        address_line2: address.address_line2 ?? '',
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        is_default: address.is_default,
      });
    } else {
      this.addressForm.reset({ is_default: false });
    }
  }

  closeAddressModal(): void {
    this.showAddAddress.set(false);
    this.editingAddressId.set(null);
    this.addressForm.reset();
    this.addressError.set(null);
  }

  saveAddress(): void {
    if (this.addressForm.invalid) return;

    this.savingAddress.set(true);
    this.addressError.set(null);

    const addressData = this.addressForm.value as Partial<UserAddress>;
    const editingId = this.editingAddressId();

    const request$ = editingId
      ? this.userApi.updateAddress(editingId, addressData)
      : this.userApi.addAddress(addressData);

    request$.subscribe({
      next: (saved) => {
        this.savingAddress.set(false);
        this.closeAddressModal();

        if (editingId) {
          /* Swap the edited address in place, keeping list order stable. */
          this.addresses.update(list => list.map(a => (a.id === editingId ? saved : a)));
        } else {
          this.addresses.set([...this.addresses(), saved]);
        }

        /* Select it and re-check: an edit may have changed the pincode, which
           changes whether we can serve it. */
        this.selectedAddressId.set(saved.id);
        this.commitSelection();
        this.checkAddresses([saved]);
      },
      error: (err) => {
        this.savingAddress.set(false);
        let errorMessage = 'Failed to save address. Please try again.';
        if (err.error) {
          if (typeof err.error === 'string') {
            errorMessage = err.error;
          } else if (typeof err.error.detail === 'string') {
            errorMessage = err.error.detail;
          } else if (err.error.message) {
            errorMessage = err.error.message;
          }
        }
        this.addressError.set(errorMessage);
      }
    });
  }

  canProceed(): boolean {
    if (!this.collectionType()) return false;

    if (this.collectionType() === 'home') {
      /* Only a confirmed-serviceable address may proceed. An unserviceable one
         isn't a dead end — the action panel above offers the ways forward. */
      return this.selectedServiceability()?.serviceable === true;
    }

    return !!this.selectedLabId();
  }

  onNext(): void {
    if (!this.canProceed()) return;
    this.next.emit();
  }
}
