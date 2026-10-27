import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  template: `
    <div class="auth-layout">
      <!-- Left Panel - Branding -->
      <aside class="auth-layout__brand">
        <div class="auth-layout__brand-content">
          <a routerLink="/" class="auth-layout__logo">
            <div class="auth-layout__logo-icon">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" rx="8" fill="currentColor"/>
                <path d="M16 6L16 26M6 16L26 16" stroke="white" stroke-width="3" stroke-linecap="round"/>
                <circle cx="16" cy="16" r="4" fill="white"/>
              </svg>
            </div>
            <div class="auth-layout__logo-text">
              <span class="auth-layout__logo-name">Sri Health Plus</span>
              <span class="auth-layout__logo-tagline">Diagnostics</span>
            </div>
          </a>
          
          <div class="auth-layout__hero">
            <h1 class="auth-layout__title">Quality Healthcare<br/>At Your Doorstep</h1>
            <p class="auth-layout__description">
              Book lab tests from the comfort of your home. Our certified technicians 
              will collect samples at your preferred time.
            </p>
          </div>
          
          <div class="auth-layout__features">
            <div class="auth-layout__feature">
              <span class="auth-layout__feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </span>
              <span>Home Sample Collection</span>
            </div>
            <div class="auth-layout__feature">
              <span class="auth-layout__feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </span>
              <span>NABL Certified Labs</span>
            </div>
            <div class="auth-layout__feature">
              <span class="auth-layout__feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </span>
              <span>Reports in 24-48 Hours</span>
            </div>
          </div>
          
          <div class="auth-layout__testimonial">
            <p class="auth-layout__quote">
              "Excellent service! The technician was punctual and professional. 
              Got my reports within a day."
            </p>
            <div class="auth-layout__author">
              <div class="auth-layout__author-avatar">RK</div>
              <div class="auth-layout__author-info">
                <span class="auth-layout__author-name">Rajesh Kumar</span>
                <span class="auth-layout__author-role">Verified Patient</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="auth-layout__brand-footer">
          <p>&copy; {{ currentYear }} Sri Health Plus — Diagnostic Laboratory & Health Care. All rights reserved.</p>
        </div>
      </aside>
      
      <!-- Right Panel - Auth Content -->
      <main class="auth-layout__content">
        <div class="auth-layout__content-inner">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: [`
    .auth-layout {
      display: flex;
      min-height: 100vh;
      min-height: 100dvh;
    }
    
    .auth-layout__brand {
      display: none;
      width: 50%;
      max-width: 640px;
      background: linear-gradient(135deg, var(--color-primary-700) 0%, var(--color-primary-900) 100%);
      color: var(--text-inverse);
      padding: var(--space-8);
      flex-direction: column;
      
      @media (min-width: 1024px) {
        display: flex;
      }
    }
    
    .auth-layout__brand-content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    
    .auth-layout__logo {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      text-decoration: none;
      color: inherit;
      margin-bottom: var(--space-12);
    }
    
    .auth-layout__logo-icon {
      width: 48px;
      height: 48px;
      color: var(--color-primary-300);
    }
    
    .auth-layout__logo-text {
      display: flex;
      flex-direction: column;
    }
    
    .auth-layout__logo-name {
      font-family: var(--font-display);
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      line-height: 1.2;
    }
    
    .auth-layout__logo-tagline {
      font-size: var(--text-sm);
      opacity: 0.8;
    }
    
    .auth-layout__hero {
      margin-bottom: var(--space-10);
    }
    
    .auth-layout__title {
      font-family: var(--font-display);
      font-size: var(--text-4xl);
      font-weight: var(--font-bold);
      line-height: 1.2;
      margin: 0 0 var(--space-4) 0;
    }
    
    .auth-layout__description {
      font-size: var(--text-lg);
      line-height: var(--leading-relaxed);
      opacity: 0.9;
      margin: 0;
    }
    
    .auth-layout__features {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      margin-bottom: auto;
    }
    
    .auth-layout__feature {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      font-size: var(--text-base);
      font-weight: var(--font-medium);
    }
    
    .auth-layout__feature-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.15);
      border-radius: var(--radius-lg);
      
      svg { width: 20px; height: 20px; }
    }
    
    .auth-layout__testimonial {
      background: rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-xl);
      padding: var(--space-6);
      margin-top: var(--space-8);
    }
    
    .auth-layout__quote {
      font-size: var(--text-base);
      font-style: italic;
      line-height: var(--leading-relaxed);
      margin: 0 0 var(--space-4) 0;
      opacity: 0.95;
    }
    
    .auth-layout__author {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    
    .auth-layout__author-avatar {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-full);
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: var(--font-semibold);
      font-size: var(--text-sm);
    }
    
    .auth-layout__author-info {
      display: flex;
      flex-direction: column;
    }
    
    .auth-layout__author-name {
      font-weight: var(--font-semibold);
      font-size: var(--text-sm);
    }
    
    .auth-layout__author-role {
      font-size: var(--text-xs);
      opacity: 0.8;
    }
    
    .auth-layout__brand-footer {
      font-size: var(--text-sm);
      opacity: 0.7;
      
      p { margin: 0; }
    }
    
    .auth-layout__content {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-6);
      background: var(--bg-secondary);
      
      @media (min-width: 1024px) {
        padding: var(--space-12);
      }
    }
    
    .auth-layout__content-inner {
      width: 100%;
      max-width: 440px;
    }
  `]
})
export class AuthLayoutComponent {
  currentYear = new Date().getFullYear();
}
