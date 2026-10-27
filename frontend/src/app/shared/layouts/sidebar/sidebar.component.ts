import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
  badge?: number;
  children?: NavItem[];
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar" [class.sidebar--collapsed]="collapsed" [class.sidebar--mobile]="isMobile">
      <!-- Logo Section -->
      <div class="sidebar__logo">
        <div class="sidebar__logo-icon">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="currentColor" class="logo-bg"/>
            <path d="M16 6L16 26M6 16L26 16" stroke="white" stroke-width="3" stroke-linecap="round"/>
            <circle cx="16" cy="16" r="4" fill="white"/>
          </svg>
        </div>
        @if (!collapsed) {
          <div class="sidebar__logo-text">
            <span class="sidebar__logo-name">Sri Health Plus</span>
            <span class="sidebar__logo-tagline">Diagnostics</span>
          </div>
        }
        @if (isMobile) {
          <button class="sidebar__close" (click)="closeMenu.emit()" aria-label="Close menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        }
      </div>

      <!-- Navigation -->
      <nav class="sidebar__nav" role="navigation" aria-label="Main navigation">
        @for (group of navigation(); track group.title) {
          <div class="sidebar__group">
            @if (group.title && !collapsed) {
              <span class="sidebar__group-title">{{ group.title }}</span>
            }
            <ul class="sidebar__list">
              @for (item of group.items; track item.route) {
                <li class="sidebar__item">
                  <a 
                    [routerLink]="item.route"
                    routerLinkActive="sidebar__link--active"
                    [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                    class="sidebar__link"
                    [class.sidebar__link--has-children]="item.children?.length"
                    [attr.title]="collapsed ? item.label : null"
                    (click)="isMobile ? closeMenu.emit() : null"
                  >
                    <span class="sidebar__icon" [innerHTML]="getIcon(item.icon)"></span>
                    @if (!collapsed) {
                      <span class="sidebar__label">{{ item.label }}</span>
                      @if (item.badge) {
                        <span class="sidebar__badge">{{ item.badge }}</span>
                      }
                    }
                  </a>
                </li>
              }
            </ul>
          </div>
        }
      </nav>

      <!-- User Section -->
      @if (!collapsed) {
        <div class="sidebar__footer">
          <div class="sidebar__user">
            <div class="sidebar__avatar">
              <span>{{ userInitials() }}</span>
            </div>
            <div class="sidebar__user-info">
              <span class="sidebar__user-name">{{ userName() }}</span>
              <span class="sidebar__user-role">{{ formatRole(userRole) }}</span>
            </div>
          </div>
        </div>
      }
    </aside>
  `,
  styles: [`
    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: var(--sidebar-width);
      background: var(--bg-primary);
      border-right: 1px solid var(--border-default);
      display: flex;
      flex-direction: column;
      z-index: var(--z-fixed);
      transition: width var(--duration-normal) var(--ease-default);
      
      &--collapsed {
        width: var(--sidebar-collapsed);
      }
      
      &--mobile {
        position: relative;
        width: 100%;
        height: 100%;
        border-right: none;
      }
    }
    
    .sidebar__logo {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-5) var(--space-4);
      border-bottom: 1px solid var(--border-subtle);
      min-height: var(--header-height);
    }
    
    .sidebar__logo-icon {
      width: 40px;
      height: 40px;
      color: var(--color-primary-600);
      flex-shrink: 0;
      
      svg {
        width: 100%;
        height: 100%;
      }
    }
    
    .sidebar__logo-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    
    .sidebar__logo-name {
      font-family: var(--font-display);
      font-size: var(--text-lg);
      font-weight: var(--font-bold);
      color: var(--text-primary);
      line-height: 1.2;
    }
    
    .sidebar__logo-tagline {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      font-weight: var(--font-medium);
    }
    
    .sidebar__close {
      margin-left: auto;
      padding: var(--space-2);
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
      
      &:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
      }
    }
    
    .sidebar__nav {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-4) var(--space-3);
    }
    
    .sidebar__group {
      &:not(:first-child) {
        margin-top: var(--space-6);
        padding-top: var(--space-4);
        border-top: 1px solid var(--border-subtle);
      }
    }
    
    .sidebar__group-title {
      display: block;
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      padding: 0 var(--space-3) var(--space-2);
    }
    
    .sidebar__list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    
    .sidebar__item {
      margin-bottom: var(--space-1);
    }
    
    .sidebar__link {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2-5) var(--space-3);
      border-radius: var(--radius-lg);
      color: var(--text-secondary);
      text-decoration: none;
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      transition: all var(--duration-fast) var(--ease-default);
      
      &:hover {
        background: var(--bg-secondary);
        color: var(--text-primary);
      }
      
      &--active {
        background: var(--color-primary-50);
        color: var(--color-primary-700);
        
        .sidebar__icon {
          color: var(--color-primary-600);
        }
      }
    }
    
    .sidebar--collapsed .sidebar__link {
      justify-content: center;
      padding: var(--space-3);
    }
    
    .sidebar__icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      
      :deep(svg) {
        width: 100%;
        height: 100%;
      }
    }
    
    .sidebar__label {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .sidebar__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 var(--space-1-5);
      background: var(--color-error-500);
      color: var(--text-inverse);
      font-size: var(--text-2xs);
      font-weight: var(--font-semibold);
      border-radius: var(--radius-full);
    }
    
    .sidebar__footer {
      padding: var(--space-4);
      border-top: 1px solid var(--border-subtle);
    }
    
    .sidebar__user {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-lg);
    }
    
    .sidebar__avatar {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-full);
      background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
      color: var(--text-inverse);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: var(--font-semibold);
      font-size: var(--text-sm);
      flex-shrink: 0;
    }
    
    .sidebar__user-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    
    .sidebar__user-name {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .sidebar__user-role {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      text-transform: capitalize;
    }
  `]
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Input() userRole: string = 'user';
  @Input() isMobile = false;
  @Output() toggleCollapse = new EventEmitter<void>();
  @Output() closeMenu = new EventEmitter<void>();
  
  userName = signal('Guest User');
  
  userInitials = computed(() => {
    const name = this.userName();
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  });
  
  navigation = computed((): NavGroup[] => {
    const role = this.userRole;
    
    if (role === 'admin') {
      return this.getAdminNavigation();
    } else if (role === 'technician') {
      return this.getTechnicianNavigation();
    } else {
      return this.getPatientNavigation();
    }
  });
  
  private getPatientNavigation(): NavGroup[] {
    return [
      {
        items: [
          { label: 'Dashboard', icon: 'home', route: '/dashboard', exact: true },
          { label: 'Book Test', icon: 'calendar-plus', route: '/booking' },
          { label: 'My Bookings', icon: 'clipboard-list', route: '/dashboard/bookings' },
          { label: 'Reports', icon: 'file-text', route: '/reports' },
        ]
      },
      {
        title: 'Browse',
        items: [
          { label: 'All Tests', icon: 'flask', route: '/tests' },
          { label: 'Health Packages', icon: 'package', route: '/packages' },
          { label: 'Lab Locations', icon: 'map-pin', route: '/lab-locations' },
        ]
      },
      {
        title: 'Account',
        items: [
          { label: 'Profile', icon: 'user', route: '/profile' },
          { label: 'Family Members', icon: 'users', route: '/profile/family' },
          { label: 'Addresses', icon: 'home', route: '/profile/addresses' },
          { label: 'Payments', icon: 'credit-card', route: '/payments' },
        ]
      }
    ];
  }
  
  private getTechnicianNavigation(): NavGroup[] {
    return [
      {
        items: [
          { label: 'Dashboard', icon: 'home', route: '/technician', exact: true },
          { label: 'My Assignments', icon: 'clipboard-list', route: '/technician/assignments' },
          { label: 'Schedule', icon: 'calendar', route: '/technician/schedule' },
        ]
      },
      {
        title: 'Quick Actions',
        items: [
          { label: 'Collect Sample', icon: 'droplet', route: '/technician/collect' },
          { label: 'Update Status', icon: 'check-circle', route: '/technician/status' },
        ]
      },
      {
        title: 'Account',
        items: [
          { label: 'Profile', icon: 'user', route: '/profile' },
        ]
      }
    ];
  }
  
  private getAdminNavigation(): NavGroup[] {
    return [
      {
        items: [
          { label: 'Dashboard', icon: 'layout-dashboard', route: '/admin', exact: true },
          { label: 'Analytics', icon: 'bar-chart-2', route: '/admin/analytics' },
        ]
      },
      {
        title: 'Management',
        items: [
          { label: 'Users', icon: 'users', route: '/admin/users' },
          { label: 'Bookings', icon: 'clipboard-list', route: '/admin/bookings' },
          { label: 'Technicians', icon: 'user-check', route: '/admin/technicians' },
        ]
      },
      {
        title: 'Catalog',
        items: [
          { label: 'Tests', icon: 'flask', route: '/admin/tests' },
          { label: 'Packages', icon: 'package', route: '/admin/packages' },
        ]
      },
      {
        title: 'Operations',
        items: [
          { label: 'Lab Branches', icon: 'building', route: '/admin/lab-branches' },
          { label: 'Service Areas', icon: 'map', route: '/admin/service-areas' },
          { label: 'Time Slots', icon: 'clock', route: '/admin/time-slots' },
        ]
      },
      {
        title: 'Settings',
        items: [
          { label: 'Configuration', icon: 'settings', route: '/admin/settings' },
          { label: 'Feature Flags', icon: 'toggle-left', route: '/admin/feature-flags' },
        ]
      }
    ];
  }
  
  formatRole(role: string): string {
    const roleMap: Record<string, string> = {
      'user': 'Patient',
      'admin': 'Administrator',
      'technician': 'Lab Technician'
    };
    return roleMap[role] || role;
  }
  
  getIcon(name: string): string {
    const icons: Record<string, string> = {
      'home': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      'calendar-plus': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h8"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="19" y1="16" x2="19" y2="22"/><line x1="16" y1="19" x2="22" y2="19"/></svg>`,
      'clipboard-list': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`,
      'file-text': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
      'flask': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v5.586a1 1 0 00.293.707l4.414 4.414a3 3 0 010 4.243l-.536.536a3 3 0 01-4.243 0L12 15.586l-2.929 2.9a3 3 0 01-4.243 0l-.535-.536a3 3 0 010-4.243L8.707 9.293A1 1 0 009 8.586V3z"/></svg>`,
      'package': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
      'map-pin': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
      'user': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      'users': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
      'credit-card': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
      'calendar': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      'droplet': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>`,
      'check-circle': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      'layout-dashboard': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>`,
      'bar-chart-2': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
      'user-check': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>`,
      'building': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`,
      'map': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`,
      'clock': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      'settings': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
      'toggle-left': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="8" cy="12" r="3"/></svg>`,
    };
    return icons[name] || icons['home'];
  }
}
