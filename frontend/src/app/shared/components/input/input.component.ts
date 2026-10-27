import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

/** `md` = the 58px standard. `sm` = 44px compact, for admin filter bars and table cells. */
export type InputSize = 'sm' | 'md' | 'lg';

/**
 * The one input field for the whole application.
 *
 * Every text-like field — text, email, password, tel, number, search, textarea —
 * renders through this component so radius, height, border, padding, icon
 * placement, focus ring and error styling can never drift apart again. All
 * styling comes from the `--input-*` tokens in the design system; nothing here
 * hardcodes a colour or a size.
 *
 * Icons: pass `icon` for a Material ligature name, or project your own SVG with
 * `<svg fieldIcon>`.
 *
 * NOTE: inline component styles compile as plain CSS (angular.json sets no
 * `inlineStyleLanguage`), so selectors here are written out in full — SCSS-style
 * `&--modifier` nesting silently compiles to `:is(--modifier)` and never matches.
 */
@Component({
  selector: 'app-input',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => InputComponent),
    multi: true,
  }],
  template: `
    <div class="field" [class.is-disabled]="disabled">
      @if (label) {
        <label class="field-label" [for]="inputId">
          {{ label }}
          @if (required) { <span class="field-required" aria-hidden="true">*</span> }
        </label>
      }

      <div
        class="field-control"
        [class.is-sm]="size === 'sm'"
        [class.has-icon]="hasIcon"
        [class.has-prefix]="!!prefix"
        [class.has-trailing]="type === 'password'"
        [class.is-error]="error"
        [class.is-success]="success && !error"
      >
        @if (hasIcon) {
          <span class="field-icon" aria-hidden="true">
            @if (icon) { <mat-icon>{{ icon }}</mat-icon> }
            <ng-content select="[fieldIcon]" />
          </span>
        }
        @if (prefix) {
          <span class="field-prefix" aria-hidden="true">{{ prefix }}</span>
        }

        @if (type === 'textarea') {
          <textarea
            [id]="inputId"
            class="field-input field-textarea"
            [placeholder]="placeholder"
            [disabled]="disabled"
            [readonly]="readonly"
            [rows]="rows"
            [attr.aria-invalid]="error ? 'true' : null"
            [attr.aria-describedby]="describedBy"
            [ngModel]="value"
            (ngModelChange)="onValueChange($event)"
            (blur)="onTouched()"
          ></textarea>
        } @else {
          <input
            [id]="inputId"
            class="field-input"
            [type]="showPassword ? 'text' : type"
            [placeholder]="placeholder"
            [disabled]="disabled"
            [readonly]="readonly"
            [attr.inputmode]="inputmode"
            [attr.maxlength]="maxlength"
            [attr.autocomplete]="autocomplete"
            [attr.min]="min"
            [attr.max]="max"
            [attr.step]="step"
            [attr.aria-invalid]="error ? 'true' : null"
            [attr.aria-describedby]="describedBy"
            [ngModel]="value"
            (ngModelChange)="onValueChange($event)"
            (blur)="onTouched()"
          />
        }

        @if (type === 'password') {
          <button
            type="button"
            class="field-trailing"
            (click)="togglePassword()"
            [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
            tabindex="-1"
          >
            @if (showPassword) {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            } @else {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            }
          </button>
        }
      </div>

      @if (error && errorMessage) {
        <p class="field-msg field-msg-error" [id]="inputId + '-msg'" role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {{ errorMessage }}
        </p>
      } @else if (hint) {
        <p class="field-msg" [id]="inputId + '-msg'">{{ hint }}</p>
      }
    </div>
  `,
  styles: [`
    /* Custom elements default to inline; without this the field won't size
       correctly as a grid/flex child. */
    :host { display: block; }

    .field {
      display: flex;
      flex-direction: column;
      gap: var(--input-gap);
    }

    .field-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--input-ink);
      padding-left: 2px;
    }
    .field-required { color: var(--input-error); margin-left: 2px; }

    .field-control { position: relative; display: block; }

    .field-input {
      width: 100%;
      height: var(--input-height-md);
      padding: 0 var(--input-padding-x);
      border: var(--input-border-width) solid var(--input-border-color);
      border-radius: var(--input-radius);
      background: var(--input-bg);
      color: var(--input-ink);
      font-family: inherit;
      font-size: var(--input-font-size);
      font-weight: var(--input-font-weight);
      line-height: 1.2;
      transition:
        border-color var(--input-transition),
        box-shadow var(--input-transition),
        background var(--input-transition);
    }
    .field-control.is-sm .field-input { height: var(--input-height-sm); }
    .field-control.has-icon .field-input { padding-left: var(--input-padding-icon); }
    .field-control.has-trailing .field-input { padding-right: 46px; }

    /* Static affix (e.g. "+91") sitting inside the field, before the value. */
    .field-prefix {
      position: absolute;
      left: 0;
      top: 0;
      height: var(--input-height-md);
      display: flex;
      align-items: center;
      padding: 0 12px 0 var(--input-padding-x);
      font-size: var(--input-font-size);
      font-weight: 600;
      color: var(--input-placeholder);
      pointer-events: none;
    }
    .field-control.is-sm .field-prefix { height: var(--input-height-sm); }
    .field-control.has-prefix .field-input { padding-left: 52px; }
    .field-control.has-prefix.has-icon .field-prefix { padding-left: var(--input-padding-icon); }
    .field-control.has-prefix.has-icon .field-input { padding-left: 84px; }
    .field-control:focus-within .field-prefix { color: var(--input-ink); }

    .field-input::placeholder { color: var(--input-placeholder); font-weight: 400; }

    .field-input:hover:not(:disabled):not(:focus) { border-color: var(--input-border-hover); }

    .field-input:focus {
      outline: none;
      border-color: var(--input-accent);
      box-shadow: var(--input-ring);
    }

    /* Chrome paints autofilled fields with its own background, which breaks the
       white standard. Overpower it with an inset shadow rather than a colour,
       and keep the focus ring by re-declaring it alongside. */
    .field-input:-webkit-autofill,
    .field-input:-webkit-autofill:hover {
      -webkit-text-fill-color: var(--input-ink);
      -webkit-box-shadow: 0 0 0 1000px var(--input-bg) inset;
      caret-color: var(--input-ink);
    }
    .field-input:-webkit-autofill:focus {
      -webkit-box-shadow: var(--input-ring), 0 0 0 1000px var(--input-bg) inset;
    }

    .field-input:disabled {
      background: var(--input-bg-disabled);
      color: var(--input-placeholder);
      cursor: not-allowed;
    }
    .field-input:read-only:not(:disabled) { background: var(--input-bg-disabled); }

    /* Error / success beat focus, so the state stays visible while typing. */
    .field-control.is-error .field-input { border-color: var(--input-error); }
    .field-control.is-error .field-input:focus { box-shadow: var(--input-ring-error); }
    .field-control.is-success .field-input { border-color: var(--input-success); }
    .field-control.is-success .field-input:focus { box-shadow: var(--input-ring-success); }

    .field-textarea {
      height: auto;
      min-height: var(--input-height-md);
      padding-top: 16px;
      padding-bottom: 16px;
      resize: vertical;
      line-height: 1.5;
    }
    .field-control.has-icon .field-textarea { padding-left: var(--input-padding-icon); }

    .field-icon {
      position: absolute;
      left: var(--input-icon-inset);
      top: 0;
      height: var(--input-height-md);
      display: flex;
      align-items: center;
      color: var(--input-icon-color);
      pointer-events: none;
      transition: color var(--input-transition);
    }
    .field-control.is-sm .field-icon { height: var(--input-height-sm); }
    /* Textarea grows, so pin its icon to the first line instead of centring. */
    .field-control:has(.field-textarea) .field-icon { height: var(--input-height-md); }

    .field-icon mat-icon {
      width: var(--input-icon-size);
      height: var(--input-icon-size);
      font-size: var(--input-icon-size);
      line-height: var(--input-icon-size);
    }
    .field-icon ::ng-deep svg {
      width: var(--input-icon-size);
      height: var(--input-icon-size);
      display: block;
    }

    .field-control:focus-within .field-icon { color: var(--input-accent); }
    .field-control.is-error .field-icon { color: var(--input-error); }

    .field-trailing {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      padding: 0;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--input-icon-color);
      cursor: pointer;
      transition: color var(--input-transition), background var(--input-transition);
    }
    .field-trailing svg { width: 20px; height: 20px; }
    .field-trailing:hover { color: var(--input-ink); background: var(--input-bg-disabled); }
    .field-trailing:focus-visible { outline: 2px solid var(--input-accent); outline-offset: 1px; }

    .field-msg {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;
      padding-left: 4px;
      font-size: 12.5px;
      line-height: 1.4;
      color: var(--input-placeholder);
    }
    .field-msg-error { color: var(--input-error); }
    .field-msg-error svg { width: 14px; height: 14px; flex-shrink: 0; }

    .field.is-disabled .field-label { color: var(--input-placeholder); }

    @media (prefers-reduced-motion: reduce) {
      .field-input, .field-icon, .field-trailing { transition: none; }
    }
  `],
})
export class InputComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() type = 'text';
  @Input() placeholder = '';
  @Input() size: InputSize = 'md';
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() required = false;
  @Input() hint?: string;
  /** Material icon ligature name for the leading icon. */
  @Input() icon?: string;
  /** Static text shown inside the field before the value, e.g. "+91". */
  @Input() prefix?: string;
  /** Set when projecting a custom `<svg fieldIcon>` instead of using `icon`. */
  @Input() hasCustomIcon = false;
  @Input() rows = 3;
  @Input() inputmode?: string;
  @Input() maxlength?: number;
  @Input() autocomplete?: string;
  /** Native number-input bounds; only meaningful when `type="number"`. */
  @Input() min?: number | string;
  @Input() max?: number | string;
  @Input() step?: number | string;
  /** Green border for confirmed-valid fields. Ignored while `error` is set. */
  @Input() success = false;

  /** Boolean, or an error string that doubles as the message. */
  @Input() set error(val: boolean | string | undefined) {
    if (typeof val === 'string') {
      this._error = val.length > 0;
      if (val.length > 0 && !this._errorMessage) this._errorMessage = val;
    } else {
      this._error = !!val;
    }
  }
  get error(): boolean { return this._error; }
  private _error = false;

  @Input() set errorMessage(val: string | undefined) { this._errorMessage = val; }
  get errorMessage(): string | undefined { return this._errorMessage; }
  private _errorMessage?: string;

  inputId = `input-${Math.random().toString(36).slice(2, 11)}`;
  value: any = '';
  showPassword = false;

  get hasIcon(): boolean { return !!this.icon || this.hasCustomIcon; }
  get describedBy(): string | null {
    return (this.error && this.errorMessage) || this.hint ? `${this.inputId}-msg` : null;
  }

  private onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: any): void { this.value = value ?? ''; }
  registerOnChange(fn: (value: any) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  onValueChange(value: any): void {
    this.value = value;
    this.onChange(value);
  }

  togglePassword(): void { this.showPassword = !this.showPassword; }
}
