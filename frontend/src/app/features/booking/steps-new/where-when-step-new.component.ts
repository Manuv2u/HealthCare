import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../../shared/components';
import { CollectionTypeStepNewComponent } from './collection-type-step-new.component';
import { SlotSelectionStepNewComponent } from './slot-selection-step-new.component';

/**
 * Merges the Collection and Schedule screens into a single step. Both children
 * run `embedded` (no internal Back/Continue, patch the wizard store live as
 * the user picks) — this wrapper only owns the combined gating and the single
 * Back/Continue actions. The slot picker already reads collection type live
 * from the store, so putting both on one screen surfaces that coupling instead
 * of hiding it behind a page transition.
 */
@Component({
  selector: 'app-where-when-step-new',
  standalone: true,
  imports: [CommonModule, ButtonComponent, CollectionTypeStepNewComponent, SlotSelectionStepNewComponent],
  template: `
    <div class="where-when-step">
      <section class="sub-step">
        <h3 class="sub-step__title">Where should we collect the sample?</h3>
        <app-collection-type-step-new [embedded]="true" #collectionStep />
      </section>

      <section class="sub-step">
        <h3 class="sub-step__title">When works for you?</h3>
        <div class="when-wrap" [class.when-wrap--locked]="!collectionStep.collectionType()">
          <app-slot-selection-step-new [embedded]="true" #slotStep />
          @if (!collectionStep.collectionType()) {
            <div class="when-lock">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="10" rx="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <p>Choose Home Collection or Visit Lab above to see available times.</p>
            </div>
          }
        </div>
      </section>

      <div class="step-actions">
        <app-button variant="outline" size="lg" (click)="back.emit()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon btn-icon--left">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </app-button>
        <app-button
          variant="primary"
          size="lg"
          [disabled]="!(collectionStep.canProceed() && slotStep.canProceed())"
          (click)="onNext(collectionStep, slotStep)"
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

    .where-when-step {
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

    /* Blocks the date/time picker until a collection type is chosen, so users
       can't fill this in first and then be silently stuck at Continue without
       knowing why. */
    .when-wrap {
      position: relative;
    }

    .when-wrap--locked > app-slot-selection-step-new {
      opacity: 0.35;
      pointer-events: none;
      filter: blur(1.5px);
    }

    .when-lock {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      text-align: center;
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.7);
      border-radius: 0.75rem;

      svg {
        width: 24px;
        height: 24px;
        color: #94A3B8;
      }

      p {
        margin: 0;
        max-width: 26ch;
        font-size: 0.875rem;
        font-weight: 500;
        color: #475569;
      }
    }

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
  `]
})
export class WhereWhenStepNewComponent {
  next = output<void>();
  back = output<void>();

  onNext(collectionStep: CollectionTypeStepNewComponent, slotStep: SlotSelectionStepNewComponent): void {
    if (!collectionStep.canProceed() || !slotStep.canProceed()) return;
    this.next.emit();
  }
}
