import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BookingWizardStore } from '../../../core/store/booking-wizard.store';
import { StepperComponent } from '../../../shared/components';
import { ActionCardsComponent } from '../../../shared/components/action-cards/action-cards.component';

/* Step components */
import { WhoWhatStepNewComponent } from '../steps-new/who-what-step-new.component';
import { WhereWhenStepNewComponent } from '../steps-new/where-when-step-new.component';
import { PaymentStepNewComponent } from '../steps-new/payment-step-new.component';

interface WizardStep {
  label: string;
  description: string;
  icon: string;
}

const WIZARD_STEPS: WizardStep[] = [
  { label: 'Who & What', description: 'Patient & tests', icon: 'user' },
  { label: 'Where & When', description: 'Collection & time', icon: 'location' },
  { label: 'Review & Pay', description: 'Complete order', icon: 'payment' },
];

@Component({
  selector: 'app-booking-wizard-new',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    StepperComponent,
    ActionCardsComponent,
    WhoWhatStepNewComponent,
    WhereWhenStepNewComponent,
    PaymentStepNewComponent
  ],
  template: `
    <div class="wizard">
      <!-- Progress Header -->
      <header class="wizard__header">
        <div class="wizard__header-inner">
          <div class="wizard__progress">
            <div class="wizard__progress-bar" [style.width.%]="progressPercent()"></div>
          </div>
          
          <app-stepper
            [steps]="steps"
            [currentStep]="currentStep()"
            [clickable]="true"
            (stepClick)="goToStep($event)"
          />
        </div>
      </header>

      <!-- Main Content -->
      <main class="wizard__main">
        <div class="wizard__container">
          <!-- Step Header -->
          <div class="wizard__step-header">
            <div class="wizard__step-badge">Step {{ currentStep() + 1 }} of {{ steps.length }}</div>
            <h1 class="wizard__step-title">{{ steps[currentStep()].label }}</h1>
            <p class="wizard__step-subtitle">{{ getStepDescription(currentStep()) }}</p>
          </div>

          <!-- Step Content -->
          <div class="wizard__content">
            @switch (currentStep()) {
              @case (0) {
                <app-who-what-step-new
                  [preselectedPackageId]="preselectedPackageId()"
                  [preselectedTestId]="preselectedTestId()"
                  (next)="nextStep()"
                />
              }
              @case (1) {
                <app-where-when-step-new (next)="nextStep()" (back)="prevStep()" />
              }
              @case (2) {
                <app-payment-step-new (back)="prevStep()" />
              }
            }
          </div>
        </div>

        <!-- Sidebar: trust badges, why-choose, contact actions -->
        <aside class="wizard__side">
          <div class="wizard__trust">
            <div class="trust-badge">
              <div class="trust-badge__icon trust-badge__icon--primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div class="trust-badge__content">
                <span class="trust-badge__title">NABL Accredited</span>
                <span class="trust-badge__desc">Quality assured testing</span>
              </div>
            </div>

            <div class="trust-badge">
              <div class="trust-badge__icon trust-badge__icon--success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div class="trust-badge__content">
                <span class="trust-badge__title">Reports in 24 hrs</span>
                <span class="trust-badge__desc">Quick turnaround</span>
              </div>
            </div>

            <div class="trust-badge">
              <div class="trust-badge__icon trust-badge__icon--accent">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <div class="trust-badge__content">
                <span class="trust-badge__title">Free Home Collection</span>
                <span class="trust-badge__desc">No extra charges</span>
              </div>
            </div>
          </div>

          @if (store.selectedFeatureCards().length) {
            <div class="why-choose">
              <h3 class="why-choose__title">Why Choose This Test</h3>
              <div class="why-choose__list">
                @for (card of store.selectedFeatureCards(); track card.title) {
                  <div class="why-choose__item">
                    <span class="why-choose__icon"><mat-icon>{{ card.icon }}</mat-icon></span>
                    <span class="why-choose__label">{{ card.title }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <app-action-cards layout="stack" />
        </aside>
      </main>
    </div>
  `,
  styles: [`
    :host {
      /* Realign shared design-tokens (app-button/app-badge/app-input/app-spinner)
         from the legacy teal palette to the app's indigo/orange theme. */
      --color-primary-50: #EEF4FF;
      --color-primary-100: #D9E5FF;
      --color-primary-500: #0047CC;
      --color-primary-600: #003399;
      --color-primary-700: #002577;
      --color-primary-800: #001B57;
      --color-accent-100: #EEF4FF;
      --color-accent-700: #001B57;
      --shadow-primary: 0 4px 14px 0 rgba(0, 51, 153, 0.28);
      --border-focus: #0047CC;
      display: block;
    }

    .wizard {
      min-height: calc(100vh - 64px);
      background: #F8F9FF;
    }

    /* Header */
    .wizard__header {
      background: #FFFFFF;
      border-bottom: 1px solid #F1F5F9;
      padding: 1rem 1.5rem;
      position: sticky;
      top: 0;
      z-index: 20;
      box-shadow: 0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px -1px rgba(0,0,0,.1);
    }

    .wizard__header-inner {
      max-width: 1000px;
      margin: 0 auto;
    }

    .wizard__progress {
      height: 4px;
      background: #E2E8F0;
      border-radius: 9999px;
      margin-bottom: 1rem;
      overflow: hidden;
    }

    .wizard__progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #0047CC, #003399);
      border-radius: 9999px;
      transition: width 300ms cubic-bezier(0.4,0,0.2,1);
    }

    /* Main Content */
    .wizard__main {
      max-width: 1000px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      display: grid;
      grid-template-columns: 1fr 280px;
      align-items: start;
      gap: 2rem;

      @media (max-width: 1024px) {
        grid-template-columns: 1fr;
        padding: 1.5rem 1rem;
      }

      /* Grid items default to min-width:auto, so they refuse to shrink below
         their content and drag the whole page into horizontal scroll on phones. */
      > * {
        min-width: 0;
      }
    }

    .wizard__container {
      background: #FFFFFF;
      border-radius: 1.25rem;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1);
      border: 1px solid #F1F5F9;
      overflow: hidden;
    }

    .wizard__step-header {
      padding: 1rem 1.5rem;
      background: #FFFFFF;
      border-bottom: 1px solid #F1F5F9;
    }

    .wizard__step-badge {
      display: inline-flex;
      padding: 0.125rem 0.625rem;
      background: #D9E5FF;
      color: #002577;
      border-radius: 9999px;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      margin-bottom: 0.375rem;
    }

    .wizard__step-title {
      font-family: 'Plus Jakarta Sans','Inter',-apple-system,sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      color: #0F172A;
      margin: 0 0 0.125rem 0;
    }

    .wizard__step-subtitle {
      font-size: 0.875rem;
      color: #475569;
      margin: 0;
    }

    .wizard__content {
      padding: 1.5rem;
    }

    /* Sidebar */
    .wizard__side {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* Trust Badges */
    .wizard__trust {
      display: flex;
      flex-direction: column;
      gap: 1rem;

      @media (max-width: 1024px) {
        flex-direction: row;
        overflow-x: auto;
        padding-bottom: 0.5rem;
      }
    }

    /* Why Choose This Test */
    .why-choose {
      padding: 1.25rem 1rem;
      background: #FFFFFF;
      border-radius: 1rem;
      border: 1px solid #F1F5F9;
    }

    .why-choose__title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #0F172A;
      margin: 0 0 0.85rem 0;
    }

    .why-choose__list {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;

      @media (max-width: 1024px) {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      }
    }

    .why-choose__item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.6rem 0.75rem;
      background: #F8FAFC;
      border-radius: 0.75rem;
    }

    .why-choose__icon {
      width: 34px;
      height: 34px;
      border-radius: 0.6rem;
      background: #EEF4FF;
      color: #003399;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        font-size: 19px;
        width: 19px;
        height: 19px;
      }
    }

    .why-choose__label {
      font-size: 0.82rem;
      font-weight: 600;
      color: #0F172A;
      line-height: 1.35;
    }

    .trust-badge {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem;
      background: #FFFFFF;
      border-radius: 1rem;
      border: 1px solid #F1F5F9;

      @media (max-width: 1024px) {
        flex-shrink: 0;
        min-width: 200px;
      }
    }

    .trust-badge__icon {
      width: 40px;
      height: 40px;
      border-radius: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      svg {
        width: 20px;
        height: 20px;
      }
    }

    .trust-badge__icon--primary {
      background: #EEF4FF;
      color: #003399;
    }

    .trust-badge__icon--success {
      background: #F0FFF4;
      color: #2F855A;
    }

    .trust-badge__icon--accent {
      background: #EEF4FF;
      color: #002577;
    }

    .trust-badge__content {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .trust-badge__title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #0F172A;
    }

    .trust-badge__desc {
      font-size: 0.75rem;
      color: #475569;
    }

    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      .wizard__progress-bar {
        transition: none;
      }
    }
  `]
})
export class BookingWizardNewComponent implements OnInit {
  readonly store = inject(BookingWizardStore);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly steps = WIZARD_STEPS;
  currentStep = signal(0);
  preselectedPackageId = signal<string | null>(null);
  preselectedTestId = signal<string | null>(null);

  progressPercent = computed(() => 
    (this.currentStep() / (this.steps.length - 1)) * 100
  );

  ngOnInit(): void {
    const pkgId = this.route.snapshot.queryParamMap.get('package_id');
    const testId = this.route.snapshot.queryParamMap.get('test_id');
    /* A package/test deep link is an intentional fresh start — it should win
       over any in-progress session rather than silently resuming an old one. */
    const freshDeepLink = !!(pkgId || testId);

    const restored = !freshDeepLink && this.store.loadFromSession();
    if (restored) {
      this.currentStep.set(this.store.currentStep());
    } else {
      this.store.reset();
    }

    if (pkgId) this.preselectedPackageId.set(pkgId);
    if (testId) this.preselectedTestId.set(testId);
  }

  getStepDescription(step: number): string {
    const descriptions = [
      'Choose who this booking is for and select your tests or packages',
      'Choose home collection or a lab visit, then pick a convenient date and time',
      'Review your order and complete the payment'
    ];
    return descriptions[step] || '';
  }

  nextStep(): void {
    if (this.currentStep() < this.steps.length - 1) {
      this.currentStep.update(s => s + 1);
      this.store.patch({ currentStep: this.currentStep() });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  prevStep(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update(s => s - 1);
      this.store.patch({ currentStep: this.currentStep() });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  goToStep(step: number): void {
    if (step < this.currentStep()) {
      this.currentStep.set(step);
      this.store.patch({ currentStep: step });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
