import { Component, Input, forwardRef, signal, computed, HostListener, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

export interface SelectOption {
  value: any;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => SelectComponent),
    multi: true
  }],
  template: `
    <div class="select-wrapper" [class.select-wrapper--error]="error" [class.select-wrapper--disabled]="disabled">
      @if (label) {
        <label class="select__label">
          {{ label }}
          @if (required) { <span class="select__required">*</span> }
        </label>
      }
      <div 
        class="select__container"
        [class.select__container--open]="isOpen()"
        [class]="'select__container--' + size"
        (click)="toggle()"
        role="combobox"
        [attr.aria-expanded]="isOpen()"
        tabindex="0"
        (keydown.enter)="toggle()"
        (keydown.space)="toggle(); $event.preventDefault()"
        (keydown.escape)="close()"
      >
        <span class="select__value" [class.select__value--placeholder]="!selectedOption()">
          {{ selectedOption()?.label || placeholder }}
        </span>
        <span class="select__arrow" [class.select__arrow--open]="isOpen()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </span>
      </div>
      
      @if (isOpen()) {
        <div class="select__dropdown" role="listbox">
          @for (option of options; track option.value) {
            <div 
              class="select__option"
              [class.select__option--selected]="option.value === value()"
              [class.select__option--disabled]="option.disabled"
              (click)="selectOption(option, $event)"
              role="option"
              [attr.aria-selected]="option.value === value()"
            >
              {{ option.label }}
              @if (option.value === value()) {
                <svg class="select__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              }
            </div>
          }
        </div>
      }
      
      @if (error && errorMessage) {
        <span class="select__error">{{ errorMessage }}</span>
      }
    </div>
  `,
  styles: [`
    /* Matches app-input exactly — same tokens, same states. See input.component.ts
       for why selectors are written out rather than nested with &--. */
    .select-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--input-gap);
    }

    .select__label {
      font-size: 13px;
      font-weight: 600;
      color: var(--input-ink);
      padding-left: 2px;
    }
    .select__required { color: var(--input-error); margin-left: 2px; }

    .select__container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      height: var(--input-height-md);
      padding: 0 var(--input-padding-x);
      border: var(--input-border-width) solid var(--input-border-color);
      border-radius: var(--input-radius);
      background: var(--input-bg);
      cursor: pointer;
      transition:
        border-color var(--input-transition),
        box-shadow var(--input-transition),
        background var(--input-transition);
    }
    .select__container--sm { height: var(--input-height-sm); }
    .select__container--md { height: var(--input-height-md); }
    .select__container--lg { height: var(--input-height-lg); }

    .select__container:hover { border-color: var(--input-border-hover); }
    .select__container:focus,
    .select__container--open {
      outline: none;
      border-color: var(--input-accent);
      box-shadow: var(--input-ring);
    }

    .select-wrapper--error .select__container { border-color: var(--input-error); }
    .select-wrapper--error .select__container:focus,
    .select-wrapper--error .select__container--open { box-shadow: var(--input-ring-error); }

    .select-wrapper--disabled .select__container {
      background: var(--input-bg-disabled);
      cursor: not-allowed;
    }
    .select-wrapper--disabled .select__value { color: var(--input-placeholder); }

    .select__value {
      flex: 1;
      min-width: 0;
      font-size: var(--input-font-size);
      font-weight: var(--input-font-weight);
      color: var(--input-ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .select__value--placeholder { color: var(--input-placeholder); font-weight: 400; }

    .select__arrow {
      flex-shrink: 0;
      width: var(--input-icon-size);
      height: var(--input-icon-size);
      color: var(--input-icon-color);
      transition: transform var(--input-transition), color var(--input-transition);
    }
    .select__arrow svg { width: 100%; height: 100%; display: block; }
    .select__arrow--open { transform: rotate(180deg); }
    .select__container:focus .select__arrow,
    .select__container--open .select__arrow { color: var(--input-accent); }

    .select__dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 6px;
      background: var(--input-bg);
      border: 1px solid var(--input-border-color);
      border-radius: var(--input-radius);
      box-shadow: var(--shadow-lg);
      max-height: 240px;
      overflow-y: auto;
      z-index: var(--z-dropdown);
      padding: 6px;
      animation: selectSlideDown var(--input-transition) var(--ease-out);
    }

    @keyframes selectSlideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .select__option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 9px;
      font-size: var(--input-font-size);
      color: var(--input-ink);
      cursor: pointer;
      transition: background var(--input-transition), color var(--input-transition);
    }
    .select__option:hover { background: var(--color-primary-50); }
    .select__option--selected {
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      font-weight: 600;
    }
    .select__option--disabled { opacity: 0.5; cursor: not-allowed; }
    .select__option--disabled:hover { background: transparent; }

    .select__check {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      color: var(--input-accent);
    }

    .select__error {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-left: 4px;
      font-size: 12.5px;
      line-height: 1.4;
      color: var(--input-error);
    }

    @media (prefers-reduced-motion: reduce) {
      .select__container, .select__arrow, .select__dropdown { transition: none; animation: none; }
    }
  `]
})
export class SelectComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() placeholder = 'Select an option';
  @Input() options: SelectOption[] = [];
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() disabled = false;
  @Input() required = false;
  @Input() error = false;
  @Input() errorMessage?: string;
  
  private elementRef = inject(ElementRef);
  
  isOpen = signal(false);
  value = signal<any>(null);
  
  selectedOption = computed(() => 
    this.options.find(opt => opt.value === this.value())
  );
  
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};
  
  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }
  
  writeValue(value: any): void {
    this.value.set(value);
  }
  
  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }
  
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
  
  toggle(): void {
    if (!this.disabled) {
      this.isOpen.update(v => !v);
    }
  }
  
  close(): void {
    this.isOpen.set(false);
    this.onTouched();
  }
  
  selectOption(option: SelectOption, event: Event): void {
    event.stopPropagation();
    if (!option.disabled) {
      this.value.set(option.value);
      this.onChange(option.value);
      this.close();
    }
  }
}
