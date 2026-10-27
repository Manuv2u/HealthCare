import { Component, Input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../../shared/components';
import { PatientStepNewComponent } from './patient-step-new.component';
import { TestSelectionStepNewComponent } from './test-selection-step-new.component';

/**
 * Merges the Patient and Tests screens into a single step. Both children run
 * `embedded` (no internal Back/Continue, patch the wizard store live as the
 * user picks) — this wrapper only owns the combined gating and the single
 * Continue action.
 */
@Component({
  selector: 'app-who-what-step-new',
  standalone: true,
  imports: [CommonModule, ButtonComponent, PatientStepNewComponent, TestSelectionStepNewComponent],
  template: `
    <div class="who-what-step">
      <section class="sub-step">
        <h3 class="sub-step__title">Who is this for?</h3>
        <app-patient-step-new [embedded]="true" #patientStep />
      </section>

      <section class="sub-step">
        <h3 class="sub-step__title">What would you like to test?</h3>
        <app-test-selection-step-new
          [embedded]="true"
          [preselectedPackageId]="preselectedPackageId"
          [preselectedTestId]="preselectedTestId"
          #testsStep
        />
      </section>

      <div class="step-actions">
        <app-button
          variant="primary"
          size="lg"
          [disabled]="!(patientStep.canProceed() && testsStep.canProceed())"
          (click)="onNext(patientStep, testsStep)"
        >
          Continue
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </app-button>
      </div>
    </div>
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

    .who-what-step {
      display: flex;
      flex-direction: column;
    }

    .sub-step {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem 0;

      &:first-child {
        padding-top: 0;
      }
    }

    .sub-step + .sub-step {
      border-top: 1px solid #F1F5F9;
    }

    .sub-step__title {
      font-size: 1rem;
      font-weight: 600;
      color: #0F172A;
      margin: 0;
    }

    .step-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 1rem;
      border-top: 1px solid #F1F5F9;
    }

    .btn-icon {
      width: 18px;
      height: 18px;
      margin-left: 0.5rem;
    }
  `]
})
export class WhoWhatStepNewComponent {
  @Input() preselectedPackageId: string | null = null;
  @Input() preselectedTestId: string | null = null;

  next = output<void>();

  onNext(patientStep: PatientStepNewComponent, testsStep: TestSelectionStepNewComponent): void {
    if (!patientStep.canProceed() || !testsStep.canProceed()) return;
    this.next.emit();
  }
}
