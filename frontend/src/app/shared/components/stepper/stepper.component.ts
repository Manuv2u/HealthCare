import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Step {
  label: string;
  description?: string;
  icon?: string;
}

@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="stepper" [class.stepper--vertical]="vertical" aria-label="Progress">
      <ol class="stepper__list">
        @for (step of steps; track step.label; let i = $index) {
          <li 
            class="stepper__item"
            [class.stepper__item--completed]="i < currentStep"
            [class.stepper__item--active]="i === currentStep"
            [class.stepper__item--clickable]="clickable && i < currentStep"
            (click)="clickable && i < currentStep && stepClick.emit(i)"
          >
            <div class="stepper__marker">
              @if (i < currentStep) {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              } @else {
                <span>{{ i + 1 }}</span>
              }
            </div>
            <div class="stepper__content">
              <span class="stepper__label">{{ step.label }}</span>
              @if (step.description) {
                <span class="stepper__description">{{ step.description }}</span>
              }
            </div>
            @if (i < steps.length - 1) {
              <div class="stepper__connector" [class.stepper__connector--completed]="i < currentStep"></div>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: [`
    .stepper__list {
      display: flex;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    
    .stepper--vertical .stepper__list {
      flex-direction: column;
    }
    
    .stepper__item {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      flex: 1;
      
      &.stepper__item--clickable { cursor: pointer; }
    }
    
    .stepper--vertical .stepper__item {
      padding-bottom: var(--space-8);
      &:last-child { padding-bottom: 0; }
    }
    
    .stepper__marker {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-full);
      background: var(--bg-tertiary);
      color: var(--text-muted);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      flex-shrink: 0;
      transition: all var(--duration-fast);
      z-index: 1;
      
      svg { width: 16px; height: 16px; }
    }
    
    .stepper__item--completed .stepper__marker {
      background: var(--color-primary-600);
      color: var(--text-inverse);
    }
    
    .stepper__item--active .stepper__marker {
      background: var(--color-primary-100);
      color: var(--color-primary-700);
      box-shadow: 0 0 0 4px var(--color-primary-100);
    }
    
    .stepper__content {
      display: flex;
      flex-direction: column;
      padding-top: var(--space-1);
    }
    
    .stepper__label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--text-tertiary);
      white-space: nowrap;
    }
    
    .stepper__item--completed .stepper__label,
    .stepper__item--active .stepper__label {
      color: var(--text-primary);
    }
    
    .stepper__description {
      font-size: var(--text-xs);
      color: var(--text-muted);
      margin-top: var(--space-0-5);
    }
    
    .stepper__connector {
      background: var(--border-default);
      transition: background var(--duration-fast);
    }
    .stepper__connector--completed { background: var(--color-primary-600); }

    /* A flex sibling (not absolutely positioned) so it fills the gap after this
       item's own label instead of overlapping it — an absolute connector sized
       off the item's box, rather than the label's actual width, used to render
       on top of the text. margin-top centers it on the 32px marker. */
    .stepper:not(.stepper--vertical) .stepper__connector {
      flex: 1;
      min-width: 20px;
      height: 2px;
      margin-top: 15px;
    }

    .stepper--vertical .stepper__connector {
      position: absolute;
      left: 15px;
      top: 40px;
      bottom: 0;
      width: 2px;
    }

    @media (max-width: 768px) {
      .stepper:not(.stepper--vertical) .stepper__content {
        display: none;
      }
    }
  `]
})
export class StepperComponent {
  @Input() steps: Step[] = [];
  @Input() currentStep = 0;
  @Input() vertical = false;
  @Input() clickable = false;
  @Output() stepClick = new EventEmitter<number>();
}
