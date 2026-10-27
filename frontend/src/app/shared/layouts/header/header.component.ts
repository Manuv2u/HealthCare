import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/store/auth.store';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <header class="header">
      <!-- Left Section -->
      <div class="header__left">
        <!-- Mobile Menu Toggle -->
        <button 
          class="header__menu-btn lg:hidden"
          (click)="toggleMobileMenu.emit()"
          aria-label="Open menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        
        <!-- Desktop Sidebar Toggle -->
        <button 
          class="header__collapse-btn hidden lg:flex"
          (click)="toggleSidebar.emit()"
          [attr.aria-label]="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               [class.rotated]="sidebarCollapsed">
            <polyline points="11 17 6 12 11 7"></polyline>
            <polyline points="18 17 13 12 18 7"></polyline>
          </svg>
        </button>
        
        <!-- Global Search -->
        <div class="header__search">
          <span class="header__search-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input 
            type="search"
            class="header__search-input"
            placeholder="Search tests, packages, bookings..."
            [(ngModel)]="searchQuery"
            (keydown.enter)="onSearch()"
            aria-label="Search"
          />
          <kbd class="header__search-kbd">
            <span>&#8984;</span>K
          </kbd>
        </div>
      </div>
      
      <!-- Right Section -->
      <div class="header__right">
        <!-- Quick Actions -->
        @if (userRole() === 'user') {
          <a routerLink="/booking" class="header__action-btn header__action-btn--primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span class="hidden md:inline">Book Test</span>
          </a>
        }
        
        <!-- Notifications -->
        <button class="header__icon-btn" aria-label="Notifications" (click)="toggleNotifications()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 01-3.46 0"></path>
          </svg>
          @if (notificationCount() > 0) {
            <span class="header__badge">{{ notificationCount() }}</span>
          }
        </button>
        
        <!-- User Menu -->
        <div class="header__user-menu">
          <button 
            class="header__user-btn"
            (click)="toggleUserMenu()"
            [attr.aria-expanded]="userMenuOpen()"
            aria-haspopup="true"
          >
            <div class="header__avatar">
              <span>{{ userInitials() }}</span>
            </div>
            <span class="header__user-name hidden md:block">{{ userName() }}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                 class="header__chevron" [class.rotated]="userMenuOpen()">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          
          @if (userMenuOpen()) {
            <div class="header__dropdown" role="menu">
              <div class="header__dropdown-header">
                <span class="header__dropdown-name">{{ userName() }}</span>
                <span class="header__dropdown-role">{{ formatRole(userRole()) }}</span>
              </div>
              <div class="header__dropdown-divider"></div>
              <a routerLink="/profile" class="header__dropdown-item" role="menuitem" (click)="closeUserMenu()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Profile
              </a>
              @if (userRole() === 'user') {
                <a routerLink="/profile/family" class="header__dropdown-item" role="menuitem" (click)="closeUserMenu()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                    <path d="M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                  Family Members
                </a>
              }
              <a routerLink="/profile" fragment="settings" class="header__dropdown-item" role="menuitem" (click)="closeUserMenu()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
                Settings
              </a>
              <div class="header__dropdown-divider"></div>
              <button class="header__dropdown-item header__dropdown-item--danger" role="menuitem" (click)="logout()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign Out
              </button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
  styles: [`
    .header {
      position: sticky;
      top: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      height: var(--header-height);
      padding: 0 var(--space-6);
      background: var(--bg-primary);
      border-bottom: 1px solid var(--border-default);
      z-index: var(--z-sticky);
      
      @media (max-width: 768px) {
        padding: 0 var(--space-4);
      }
    }
    
    .header__left {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex: 1;
      min-width: 0;
    }
    
    .header__menu-btn,
    .header__collapse-btn {
      padding: var(--space-2);
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
      
      &:hover {
        background: var(--bg-secondary);
        color: var(--text-primary);
      }
      
      svg.rotated {
        transform: rotate(180deg);
      }
    }
    
    .header__search {
      position: relative;
      display: flex;
      align-items: center;
      max-width: 400px;
      flex: 1;
      
      @media (max-width: 768px) {
        display: none;
      }
    }
    
    .header__search-icon {
      position: absolute;
      left: var(--space-3);
      color: var(--text-muted);
      pointer-events: none;
      display: flex;
    }
    
    .header__search-input {
      width: 100%;
      height: 40px;
      padding: 0 var(--space-10) 0 var(--space-10);
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      font-size: var(--text-sm);
      color: var(--text-primary);
      transition: all var(--duration-fast) var(--ease-default);
      
      &::placeholder {
        color: var(--text-muted);
      }
      
      &:focus {
        outline: none;
        background: var(--bg-primary);
        border-color: var(--color-primary-500);
        box-shadow: 0 0 0 3px var(--color-primary-100);
      }
    }
    
    .header__search-kbd {
      position: absolute;
      right: var(--space-3);
      display: flex;
      align-items: center;
      gap: 2px;
      padding: var(--space-1) var(--space-2);
      background: var(--bg-tertiary);
      border-radius: var(--radius-sm);
      font-family: var(--font-mono);
      font-size: var(--text-2xs);
      color: var(--text-tertiary);
      pointer-events: none;
    }
    
    .header__right {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    
    .header__action-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      background: var(--color-primary-600);
      color: var(--text-inverse);
      border: none;
      border-radius: var(--radius-lg);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      text-decoration: none;
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
      
      &:hover {
        background: var(--color-primary-700);
      }
      
      &--primary {
        box-shadow: var(--shadow-primary);
      }
    }
    
    .header__icon-btn {
      position: relative;
      padding: var(--space-2-5);
      background: transparent;
      border: none;
      border-radius: var(--radius-lg);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
      
      &:hover {
        background: var(--bg-secondary);
        color: var(--text-primary);
      }
    }
    
    .header__badge {
      position: absolute;
      top: 2px;
      right: 2px;
      min-width: 18px;
      height: 18px;
      padding: 0 var(--space-1);
      background: var(--color-error-500);
      color: var(--text-inverse);
      font-size: var(--text-2xs);
      font-weight: var(--font-semibold);
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .header__user-menu {
      position: relative;
    }
    
    .header__user-btn {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1-5) var(--space-2) var(--space-1-5) var(--space-1-5);
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
      
      &:hover {
        background: var(--bg-secondary);
        border-color: var(--border-default);
      }
    }
    
    .header__avatar {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-full);
      background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
      color: var(--text-inverse);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: var(--font-semibold);
      font-size: var(--text-xs);
    }
    
    .header__user-name {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--text-primary);
    }
    
    .header__chevron {
      color: var(--text-muted);
      transition: transform var(--duration-fast) var(--ease-default);
      
      &.rotated {
        transform: rotate(180deg);
      }
    }
    
    .header__dropdown {
      position: absolute;
      top: calc(100% + var(--space-2));
      right: 0;
      min-width: 220px;
      background: var(--bg-primary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-lg);
      padding: var(--space-2);
      z-index: var(--z-dropdown);
      animation: slideDown var(--duration-fast) var(--ease-out);
    }
    
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .header__dropdown-header {
      padding: var(--space-3);
      display: flex;
      flex-direction: column;
      gap: var(--space-0-5);
    }
    
    .header__dropdown-name {
      font-weight: var(--font-semibold);
      color: var(--text-primary);
    }
    
    .header__dropdown-role {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
    }
    
    .header__dropdown-divider {
      height: 1px;
      background: var(--border-subtle);
      margin: var(--space-1) 0;
    }
    
    .header__dropdown-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      padding: var(--space-2-5) var(--space-3);
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      color: var(--text-secondary);
      text-decoration: none;
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
      
      &:hover {
        background: var(--bg-secondary);
        color: var(--text-primary);
      }
      
      &--danger {
        color: var(--color-error-600);
        
        &:hover {
          background: var(--color-error-50);
          color: var(--color-error-700);
        }
      }
    }
    
    /* Utility classes */
    .hidden { display: none; }
    .lg\\:hidden { @media (min-width: 1024px) { display: none; } }
    .lg\\:flex { @media (min-width: 1024px) { display: flex; } }
    .md\\:inline { @media (min-width: 768px) { display: inline; } }
    .md\\:block { @media (min-width: 768px) { display: block; } }
  `]
})
export class HeaderComponent {
  @Input() sidebarCollapsed = false;
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() toggleMobileMenu = new EventEmitter<void>();
  
  private authStore = inject(AuthStore);
  private router = inject(Router);
  
  searchQuery = '';
  userMenuOpen = signal(false);
  notificationCount = signal(3);
  
  userRole = this.authStore.role;
  userName = signal('Guest User');
  
  userInitials = () => {
    const name = this.userName();
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  toggleUserMenu(): void {
    this.userMenuOpen.update(v => !v);
  }
  
  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }
  
  toggleNotifications(): void {
    /* TODO: Implement notifications panel */
  }
  
  onSearch(): void {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/tests'], { queryParams: { q: this.searchQuery } });
    }
  }
  
  formatRole(role: string | null): string {
    if (!role) return 'Guest';
    const roleMap: Record<string, string> = {
      'user': 'Patient',
      'admin': 'Administrator',
      'technician': 'Lab Technician'
    };
    return roleMap[role] || role;
  }
  
  logout(): void {
    this.authStore.clearUser();
    this.closeUserMenu();
    this.router.navigate(['/auth/login']);
  }
}
