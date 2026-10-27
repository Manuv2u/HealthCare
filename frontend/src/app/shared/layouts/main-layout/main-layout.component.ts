import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { AuthStore } from '../../../core/store/auth.store';

/**
 * MainLayout Component
 * 
 * The primary application shell for authenticated users.
 * Features a collapsible sidebar, top header, and main content area.
 * Adapts to different user roles (patient, technician, admin).
 */
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    SidebarComponent,
    HeaderComponent
  ],
  template: `
    <div class="layout" [class.layout--sidebar-collapsed]="sidebarCollapsed()">
      <!-- Skip to main content link for accessibility -->
      <a href="#main-content" class="skip-link">Skip to main content</a>
      
      <!-- Sidebar Navigation -->
      <app-sidebar 
        [collapsed]="sidebarCollapsed()"
        [userRole]="userRole()"
        (toggleCollapse)="toggleSidebar()"
      />
      
      <!-- Main Content Area -->
      <div class="layout__main">
        <!-- Top Header -->
        <app-header
          [sidebarCollapsed]="sidebarCollapsed()"
          (toggleSidebar)="toggleSidebar()"
          (toggleMobileMenu)="toggleMobileMenu()"
        />
        
        <!-- Page Content -->
        <main id="main-content" class="layout__content" role="main">
          <router-outlet />
        </main>
      </div>
      
      <!-- Mobile Sidebar Overlay -->
      @if (mobileMenuOpen()) {
        <div 
          class="layout__overlay"
          (click)="closeMobileMenu()"
          role="button"
          aria-label="Close menu"
          tabindex="0"
          (keydown.enter)="closeMobileMenu()"
          (keydown.escape)="closeMobileMenu()"
        ></div>
      }
      
      <!-- Mobile Sidebar -->
      <div class="layout__mobile-sidebar" [class.layout__mobile-sidebar--open]="mobileMenuOpen()">
        <app-sidebar
          [collapsed]="false"
          [userRole]="userRole()"
          [isMobile]="true"
          (closeMenu)="closeMobileMenu()"
        />
      </div>
    </div>
  `,
  styles: [`
    .layout {
      display: flex;
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--bg-secondary);
    }
    
    .layout__main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      margin-left: var(--sidebar-width);
      transition: margin-left var(--duration-normal) var(--ease-default);
      
      @media (max-width: 1024px) {
        margin-left: 0;
      }
    }
    
    .layout--sidebar-collapsed .layout__main {
      margin-left: var(--sidebar-collapsed);
      
      @media (max-width: 1024px) {
        margin-left: 0;
      }
    }
    
    .layout__content {
      flex: 1;
      padding: var(--space-6);
      overflow-y: auto;
      
      @media (max-width: 768px) {
        padding: var(--space-4);
      }
    }
    
    /* Mobile overlay */
    .layout__overlay {
      display: none;
      
      @media (max-width: 1024px) {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        z-index: calc(var(--z-fixed) + 5);
        animation: fadeIn var(--duration-fast) var(--ease-out);
      }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    /* Mobile sidebar */
    .layout__mobile-sidebar {
      display: none;
      
      @media (max-width: 1024px) {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        width: var(--sidebar-width);
        max-width: 85vw;
        z-index: calc(var(--z-fixed) + 10);
        transform: translateX(-100%);
        transition: transform var(--duration-normal) var(--ease-default);
        
        &--open {
          transform: translateX(0);
        }
      }
    }
    
    /* Skip link */
    .skip-link {
      position: absolute;
      top: -100px;
      left: var(--space-4);
      background: var(--color-primary-600);
      color: var(--text-inverse);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      z-index: 9999;
      font-weight: var(--font-semibold);
      text-decoration: none;
      transition: top var(--duration-fast) var(--ease-default);
      
      &:focus {
        top: var(--space-4);
      }
    }
  `]
})
export class MainLayoutComponent {
  private authStore = inject(AuthStore);
  
  /* UI State */
  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);
  
  /* User role from auth store */
  userRole = computed(() => this.authStore.role() || 'user');
  
  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }
  
  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
  }
  
  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
