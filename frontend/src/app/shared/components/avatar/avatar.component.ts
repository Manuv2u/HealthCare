import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="avatarClasses" [style.background]="backgroundColor()">
      @if (src && !imageError()) {
        <img [src]="src" [alt]="alt" (error)="onImageError()" />
      } @else {
        <span class="avatar__initials">{{ initials() }}</span>
      }
      @if (status) {
        <span class="avatar__status" [class]="'avatar__status--' + status"></span>
      }
    </div>
  `,
  styles: [`
    :host { display: inline-flex; }
    
    .avatar {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-full);
      overflow: hidden;
      flex-shrink: 0;
      
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
    
    .avatar--xs { width: var(--avatar-xs); height: var(--avatar-xs); }
    .avatar--sm { width: var(--avatar-sm); height: var(--avatar-sm); }
    .avatar--md { width: var(--avatar-md); height: var(--avatar-md); }
    .avatar--lg { width: var(--avatar-lg); height: var(--avatar-lg); }
    .avatar--xl { width: var(--avatar-xl); height: var(--avatar-xl); }
    .avatar--2xl { width: var(--avatar-2xl); height: var(--avatar-2xl); }
    
    .avatar__initials {
      color: var(--text-inverse);
      font-weight: var(--font-semibold);
      text-transform: uppercase;
    }
    
    .avatar--xs .avatar__initials { font-size: var(--text-2xs); }
    .avatar--sm .avatar__initials { font-size: var(--text-xs); }
    .avatar--md .avatar__initials { font-size: var(--text-sm); }
    .avatar--lg .avatar__initials { font-size: var(--text-base); }
    .avatar--xl .avatar__initials { font-size: var(--text-lg); }
    .avatar--2xl .avatar__initials { font-size: var(--text-2xl); }
    
    .avatar__status {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 25%;
      height: 25%;
      min-width: 8px;
      min-height: 8px;
      border-radius: var(--radius-full);
      border: 2px solid var(--bg-primary);
      
      &.avatar__status--online { background: var(--color-success-500); }
      &.avatar__status--offline { background: var(--color-neutral-400); }
      &.avatar__status--busy { background: var(--color-error-500); }
      &.avatar__status--away { background: var(--color-warning-500); }
    }
  `]
})
export class AvatarComponent {
  @Input() src?: string;
  @Input() alt = '';
  @Input() name = '';
  @Input() size: AvatarSize = 'md';
  @Input() status?: 'online' | 'offline' | 'busy' | 'away';
  
  imageError = signal(false);
  
  initials = computed(() => {
    if (!this.name) return '?';
    const parts = this.name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return this.name.substring(0, 2).toUpperCase();
  });
  
  backgroundColor = computed(() => {
    const colors = [
      'var(--color-primary-500)', 'var(--color-secondary-500)', 
      'var(--color-accent-500)', 'var(--color-success-500)',
      'var(--color-info-500)'
    ];
    const hash = this.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  });
  
  get avatarClasses(): string {
    return `avatar avatar--${this.size}`;
  }
  
  onImageError(): void {
    this.imageError.set(true);
  }
}
