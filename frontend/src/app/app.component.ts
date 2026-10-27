import { Component, computed, effect, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { filter } from 'rxjs/operators';
import { AuthStateService } from './core/auth/auth-state.service';
import { UserApiService } from './core/api/services/user-api.service';
import { HealthConcernModalComponent, HC_PROMPT_SKIPPED_SESSION_KEY } from './shared/components/health-concern-modal/health-concern-modal.component';
import { DashboardReadyService } from './core/services/dashboard-ready.service';
import { QuickHelpWidgetComponent } from './shared/components/quick-help-widget/quick-help-widget.component';
import { UploadPrescriptionModalComponent } from './shared/components/upload-prescription-modal/upload-prescription-modal.component';
import { PrescriptionModalService } from './shared/components/upload-prescription-modal/prescription-modal.service';
import { StickyCallbackBarComponent } from './shared/components/sticky-callback-bar/sticky-callback-bar.component';
import { SiteFooterComponent } from './shared/components/site-footer/site-footer.component';
import { resetScrollTop } from './core/utils/scroll-top.util';
import { SeoService } from './core/services/seo.service';
import { buildOrganizationSchema } from './core/seo/schema.util';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
    MatIconModule, MatMenuModule, MatDividerModule, HealthConcernModalComponent, QuickHelpWidgetComponent,
    UploadPrescriptionModalComponent, StickyCallbackBarComponent, SiteFooterComponent,
  ],
  template: `
    <div class="app-shell">

      <!-- ── Top Nav ── -->
      @if (!hideShell()) {
      <header class="top-nav">
        <div class="nav-inner">
          <!-- Brand -->
          <a routerLink="/" class="brand">
            <img src="assets/logo-mark.png" alt="Sri Health Plus" class="brand-logo" onerror="this.style.display='none'" />
            <div class="brand-text">
              <span class="brand-name">Sri Health Plus</span>
              <span class="brand-tagline">Diagnostic Lab</span>
            </div>
          </a>

          <!-- Center nav links -->
          <nav class="nav-links">
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">Home</a>
            <a routerLink="/tests" routerLinkActive="active">Browse Tests</a>
            <a routerLink="/packages" routerLinkActive="active">Health Packages</a>
            <a routerLink="/blog" routerLinkActive="active">Blog</a>
            @if (isAuth() && !isAdmin() && !isTechnician()) {
              <a routerLink="/dashboard" routerLinkActive="active">My Bookings</a>
            }
            <a routerLink="/about" routerLinkActive="active">About Us</a>
            <a routerLink="/contact" routerLinkActive="active">Contact Us</a>
            @if (isAdmin()) {
              <a routerLink="/admin" routerLinkActive="active" class="admin-link">
                <mat-icon class="link-icon">admin_panel_settings</mat-icon>Admin
              </a>
            }
            @if (isTechnician()) {
              <a routerLink="/technician" routerLinkActive="active" class="tech-link">
                <mat-icon class="link-icon">biotech</mat-icon>My Portal
              </a>
            }
          </nav>

          <!-- Right actions -->
          <div class="nav-actions">
            <!-- Upload Prescription CTA -->
            <button type="button" class="upload-rx-btn" (click)="prescriptionModal.open()" title="Upload Prescription" aria-label="Upload Prescription">
              <mat-icon>upload_file</mat-icon>
              <span class="upload-rx-btn__label">Upload Prescription</span>
            </button>

            @if (isAuth()) {
              <!-- Book Test CTA -->
              <a routerLink="/booking" class="book-cta">
                <mat-icon>add_circle_outline</mat-icon>
                Book Test
              </a>
            }

            @if (!isAuth()) {
              <a routerLink="/auth/login" class="nav-btn outline">Sign In</a>
              <a routerLink="/auth/register" class="nav-btn solid">Get Started</a>
            } @else {
              <!-- Avatar dropdown trigger (custom dropdown instead of mat-menu) -->
              <div class="user-dropdown-wrapper">
                <button class="avatar-btn" (click)="toggleUserMenu($event)" aria-label="User menu">
                  <span class="avatar">{{ initials() }}</span>
                  <span class="avatar-name">{{ firstName() }}</span>
                  <mat-icon class="avatar-chevron">expand_more</mat-icon>
                </button>

                @if (userMenuOpen()) {
                  <div class="user-dropdown-backdrop" (click)="userMenuOpen.set(false)"></div>
                  <div class="user-dropdown-menu">
                    <div class="menu-header">
                      <div class="menu-avatar">{{ initials() }}</div>
                      <div class="menu-user-info">
                        <strong>{{ userName() }}</strong>
                        <span class="role-tag">{{ role() }}</span>
                      </div>
                    </div>
                    <div class="menu-divider"></div>
                    <a class="menu-item" routerLink="/profile" (click)="userMenuOpen.set(false)">
                      <mat-icon>person_outline</mat-icon> My Profile
                    </a>
                    @if (isAdmin()) {
                      <a class="menu-item" routerLink="/admin" (click)="userMenuOpen.set(false)">
                        <mat-icon>admin_panel_settings</mat-icon> Admin Panel
                      </a>
                    }
                    @if (isTechnician()) {
                      <a class="menu-item" routerLink="/technician" (click)="userMenuOpen.set(false)">
                        <mat-icon>biotech</mat-icon> Technician Portal
                      </a>
                    } @else {
                      <a class="menu-item" routerLink="/dashboard" (click)="userMenuOpen.set(false)">
                        <mat-icon>receipt_long</mat-icon> My Bookings
                      </a>
                      <a class="menu-item" routerLink="/reports" (click)="userMenuOpen.set(false)">
                        <mat-icon>description</mat-icon> Reports
                      </a>
                    }
                    <a class="menu-item" routerLink="/auth/change-password" (click)="userMenuOpen.set(false)">
                      <mat-icon>lock_outline</mat-icon> Change Password
                    </a>
                    <div class="menu-divider"></div>
                    <button class="menu-item logout-item" (click)="logout()">
                      <mat-icon>logout</mat-icon> Sign Out
                    </button>
                  </div>
                }
              </div>
            }

            <!-- Hamburger -->
            <button class="hamburger" (click)="mobileOpen.set(!mobileOpen())" aria-label="Toggle menu">
              <span class="ham-bar" [class.open]="mobileOpen()"></span>
              <span class="ham-bar" [class.open]="mobileOpen()"></span>
              <span class="ham-bar" [class.open]="mobileOpen()"></span>
            </button>
          </div>
        </div>
      </header>
      } <!-- end @if (!hideShell()) for top nav -->

      <!-- ── Mobile drawer overlay ── -->
      @if (!hideShell()) {
        @if (mobileOpen()) {
        <div class="drawer-backdrop" (click)="mobileOpen.set(false)"></div>
        <nav class="mobile-drawer" [class.open]="mobileOpen()">

          <!-- Gradient header -->
          <div class="drawer-header">
            @if (isAuth()) {
              <div class="drawer-user">
                <div class="drawer-avatar">{{ initials() }}</div>
                <div>
                  <div class="drawer-name">{{ userName() }}</div>
                  <div class="drawer-role">{{ role() }}</div>
                </div>
              </div>
            } @else {
              <div class="drawer-brand-block">
                <img src="assets/logo-mark.png" alt="Sri Health Plus" class="drawer-brand-logo" onerror="this.style.display='none'" />
                <div>
                  <div class="drawer-brand-name">Sri Health Plus</div>
                  <div class="drawer-brand-sub">Diagnostic Lab</div>
                </div>
              </div>
            }
            <button class="drawer-close" (click)="mobileOpen.set(false)" aria-label="Close menu">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Links -->
          <div class="drawer-links">
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" (click)="mobileOpen.set(false)">
              <span class="dlink-icon"><mat-icon>home</mat-icon></span>
              <span class="dlink-label">Home</span>
            </a>
            <a routerLink="/tests" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <span class="dlink-icon"><mat-icon>biotech</mat-icon></span>
              <span class="dlink-label">Browse Tests</span>
            </a>
            <a routerLink="/packages" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <span class="dlink-icon"><mat-icon>inventory_2</mat-icon></span>
              <span class="dlink-label">Health Packages</span>
            </a>
            <a routerLink="/home-sample-collection" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <span class="dlink-icon"><mat-icon>home</mat-icon></span>
              <span class="dlink-label">Home Sample Collection</span>
            </a>
            <a routerLink="/blog" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <span class="dlink-icon"><mat-icon>menu_book</mat-icon></span>
              <span class="dlink-label">Blog</span>
            </a>
            <button type="button" class="drawer-upload-rx" (click)="openPrescriptionFromDrawer()">
              <span class="dlink-icon"><mat-icon>upload_file</mat-icon></span>
              <span class="dlink-label">Upload Prescription</span>
              <span class="dlink-badge">New</span>
            </button>
            @if (isAuth()) {
              <a routerLink="/booking" routerLinkActive="active" (click)="mobileOpen.set(false)" class="drawer-book-link">
                <span class="dlink-icon"><mat-icon>add_circle_outline</mat-icon></span>
                <span class="dlink-label">Book Test</span>
                <span class="dlink-badge">New</span>
              </a>
              <a routerLink="/dashboard" routerLinkActive="active" (click)="mobileOpen.set(false)">
                <span class="dlink-icon"><mat-icon>receipt_long</mat-icon></span>
                <span class="dlink-label">My Bookings</span>
              </a>
              <a routerLink="/reports" routerLinkActive="active" (click)="mobileOpen.set(false)">
                <span class="dlink-icon"><mat-icon>description</mat-icon></span>
                <span class="dlink-label">Reports</span>
              </a>
              <a routerLink="/profile" routerLinkActive="active" (click)="mobileOpen.set(false)">
                <span class="dlink-icon"><mat-icon>manage_accounts</mat-icon></span>
                <span class="dlink-label">Profile & Settings</span>
              </a>
            }
            <a routerLink="/about" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <span class="dlink-icon"><mat-icon>info_outline</mat-icon></span>
              <span class="dlink-label">About Us</span>
            </a>
            <a routerLink="/contact" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <span class="dlink-icon"><mat-icon>mail_outline</mat-icon></span>
              <span class="dlink-label">Contact Us</span>
            </a>
            @if (isAdmin()) {
              <a routerLink="/admin" class="admin-link" (click)="mobileOpen.set(false)">
                <span class="dlink-icon"><mat-icon>admin_panel_settings</mat-icon></span>
                <span class="dlink-label">Admin Panel</span>
              </a>
            }
            @if (isTechnician()) {
              <a routerLink="/technician" class="tech-link" (click)="mobileOpen.set(false)">
                <span class="dlink-icon"><mat-icon>biotech</mat-icon></span>
                <span class="dlink-label">Technician Portal</span>
              </a>
            }
          </div>

          <!-- Drawer footer -->
          <div class="drawer-footer">
            @if (!isAuth()) {
              <div class="drawer-auth">
                <a routerLink="/auth/login" (click)="mobileOpen.set(false)" class="da-btn outline">Sign In</a>
                <a routerLink="/auth/register" (click)="mobileOpen.set(false)" class="da-btn solid">Get Started</a>
              </div>
            } @else {
              <button class="drawer-logout" (click)="logout()">
                <mat-icon>logout</mat-icon> Sign Out
              </button>
            }
          </div>
        </nav>
        } <!-- end @if (mobileOpen()) -->
      } <!-- end @if (!hideShell()) for mobile drawer -->

      <!-- ── Page content ── -->
      <main class="main-content">
        <router-outlet />
      </main>

      <!-- ── Footer (every page using the global shell) ── -->
      @if (!hideShell()) {
        <app-site-footer />
      }

      <!-- ── Bottom navigation (mobile only, not on admin/tech routes) ── -->
      @if (!hideShell() && showBottomNav()) {
        <nav class="bottom-nav">
          <a routerLink="/" routerLinkActive="bnav-active" [routerLinkActiveOptions]="{exact:true}" class="bnav-item">
            <span class="bnav-pill">
              <mat-icon>home</mat-icon>
            </span>
            <span class="bnav-label">Home</span>
          </a>
          <a routerLink="/tests" routerLinkActive="bnav-active" class="bnav-item">
            <span class="bnav-pill">
              <mat-icon>biotech</mat-icon>
            </span>
            <span class="bnav-label">Tests</span>
          </a>

          <!-- Center raised FAB -->
          <a routerLink="/booking" routerLinkActive="bnav-active" class="bnav-item bnav-center">
            <div class="bnav-fab">
              <mat-icon>add</mat-icon>
            </div>
            <span class="bnav-label">Book</span>
          </a>

          @if (isAuth()) {
            <a routerLink="/dashboard" routerLinkActive="bnav-active" class="bnav-item">
              <span class="bnav-pill">
                <mat-icon>receipt_long</mat-icon>
              </span>
              <span class="bnav-label">Orders</span>
            </a>
            <a routerLink="/profile" routerLinkActive="bnav-active" class="bnav-item">
              <span class="bnav-pill">
                <mat-icon>person</mat-icon>
              </span>
              <span class="bnav-label">Profile</span>
            </a>
          } @else {
            <a routerLink="/packages" routerLinkActive="bnav-active" class="bnav-item">
              <span class="bnav-pill">
                <mat-icon>inventory_2</mat-icon>
              </span>
              <span class="bnav-label">Packages</span>
            </a>
            <a routerLink="/auth/login" routerLinkActive="bnav-active" class="bnav-item">
              <span class="bnav-pill">
                <mat-icon>login</mat-icon>
              </span>
              <span class="bnav-label">Sign In</span>
            </a>
          }
        </nav>
      }

      <!-- ── Sticky bottom CTA (home + public marketing/patient pages; hides when a dialog is open) ── -->
      @if (!hideShell() && showCallbackBar() && !mobileOpen()) {
        <app-sticky-callback-bar />
      }

      <!-- ── Upload Prescription dialog (single shared instance) ── -->
      <app-upload-prescription-modal
        [open]="prescriptionModal.isOpen()"
        (closed)="prescriptionModal.close()"
      />

      <app-health-concern-modal
        [isOpen]="showHealthConcernModal()"
        (saved)="onHealthConcernsSaved($event)"
        (closed)="onHealthConcernsClosed()"
      />

      @if (!hideShell() && !mobileOpen()) {
        <app-quick-help-widget />
      }

    </div>
  `,
  styles: [`
    /* ── Design tokens ── */
    :host {
      --indigo:       #0047CC;
      --indigo-dark:  #003399;
      --indigo-deep:  #001B57;
      --indigo-lt:    #EEF4FF;
      --indigo-mid:   #B3CAFF;
      --orange:       #0047CC;
      --orange-dark:  #003399;
      --orange-lt:    #EEF4FF;
      --green:        #003399;
      --amber:        #F59E0B;
      --red:          #EF4444;
      --bg:           #F8F9FF;
      --surface:      #FFFFFF;
      --text:         #0F172A;
      --text-2:       #475569;
      --muted:        #94A3B8;
      --border:       #E2E8F0;
      --border-lt:    #F1F5F9;
      --nav-h:        72px;
      --bnav-h:       64px;
      --r:            12px;
      --r-lg:         16px;
      --r-xl:         20px;
      --r-pill:       999px;
      --t:            0.18s ease;
    }

    /* ── Shell ── */
    .app-shell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: var(--bg);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: var(--text);
    }

    /* ── Top nav ── */
    .top-nav {
      position: sticky;
      top: 0;
      z-index: 200;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: saturate(180%) blur(16px);
      -webkit-backdrop-filter: saturate(180%) blur(16px);
      border-bottom: 1px solid var(--border);
      box-shadow: 0 1px 0 var(--border), 0 4px 24px rgba(0, 71, 204, 0.06);
    }

    .nav-inner {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 1.75rem;
      height: var(--nav-h);
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    /* Brand */
    .brand {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      text-decoration: none;
      flex-shrink: 0;
    }
    .brand-logo {
      height: 58px;
      width: 58px;
      object-fit: contain;
      display: block;
    }
    .brand-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      line-height: 1;
    }
    .brand-name {
      font-family: var(--font-display);
      font-size: 1.18rem;
      font-weight: 700;
      color: var(--indigo);
      letter-spacing: -0.015em;
      line-height: 1;
    }
    .brand-tagline {
      font-size: 0.62rem;
      font-weight: 600;
      color: #64748B;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }

    /* Nav links */
    .nav-links {
      display: flex;
      align-items: center;
      gap: 0.15rem;
      flex: 1;
    }
    .nav-links a {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.45rem 0.9rem;
      border-radius: var(--r-pill);
      font-size: 0.865rem;
      font-weight: 500;
      color: var(--text-2);
      text-decoration: none;
      transition: background var(--t), color var(--t);
      white-space: nowrap;
    }
    .nav-links a:hover {
      background: var(--indigo-lt);
      color: var(--indigo);
    }
    .nav-links a.active {
      background: var(--indigo-lt);
      color: var(--indigo);
      font-weight: 600;
    }
    .nav-links a.admin-link {
      color: var(--orange);
      font-weight: 600;
    }
    .nav-links a.admin-link:hover {
      background: var(--orange-lt);
      color: var(--orange-dark);
    }
    .nav-links a.admin-link.active {
      background: var(--orange);
      color: #fff;
    }
    .nav-links a.tech-link {
      color: var(--indigo);
      font-weight: 600;
    }
    .link-icon {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
    }

    /* Nav actions */
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-shrink: 0;
    }

    /* Book Test CTA */
    /* Upload Prescription CTA (green pill) */
    .upload-rx-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.48rem 1.05rem;
      background: #fff;
      color: var(--text-2);
      border: 1.5px solid var(--border);
      border-radius: var(--r-pill);
      font: inherit;
      font-size: 0.855rem;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: -0.01em;
      transition: border-color var(--t), color var(--t), background var(--t);
    }
    .upload-rx-btn mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; color: #009994; }
    .upload-rx-btn:hover { border-color: #00B4AE; color: #007A76; background: #E6F8F7; }
    .upload-rx-btn:focus-visible { outline: 2px solid #009994; outline-offset: 2px; }

    /* Between the drawer breakpoint and a full-width desktop the label is what
       tips the whole bar into horizontal scroll — drop to the icon rather than
       drop the button, which would leave no way to upload at these widths. */
    @media (max-width: 1279px) {
      .upload-rx-btn { padding: 0.48rem 0.62rem; }
      .upload-rx-btn__label { display: none; }
    }
    @media (max-width: 1099px) {
      .upload-rx-btn { display: none; } /* drawer entry covers mobile */
    }

    .book-cta {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 1.1rem;
      background: linear-gradient(135deg, var(--indigo) 0%, #0047CC 100%);
      color: #fff;
      border-radius: var(--r-pill);
      font-size: 0.855rem;
      font-weight: 700;
      text-decoration: none;
      letter-spacing: -0.01em;
      box-shadow: 0 4px 14px rgba(0, 71, 204, 0.35);
      transition: box-shadow var(--t), transform var(--t), opacity var(--t);
    }
    .book-cta mat-icon {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
    }
    .book-cta:hover {
      box-shadow: 0 6px 20px rgba(0, 71, 204, 0.48);
      transform: translateY(-1px);
      text-decoration: none;
    }
    .book-cta:active {
      transform: translateY(0);
    }

    /* Nav buttons */
    .nav-btn {
      padding: 0.48rem 1.05rem;
      border-radius: var(--r-pill);
      font-size: 0.855rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      transition: all var(--t);
    }
    .nav-btn.outline {
      border: none;
      color: var(--text-2);
      background: none;
    }
    .nav-btn.outline:hover {
      color: var(--indigo);
      background: var(--indigo-lt);
    }
    .nav-btn.solid {
      background: linear-gradient(135deg, var(--indigo) 0%, var(--indigo-dark) 100%);
      color: #fff;
      border: none;
      box-shadow: 0 4px 12px rgba(0, 71, 204, 0.2);
      transition: box-shadow var(--t), transform var(--t);
    }
    .nav-btn.solid:hover {
      text-decoration: none;
      transform: translateY(-1px);
      box-shadow: 0 8px 24px rgba(0, 71, 204, 0.35);
    }

    /* Avatar button */
    .avatar-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px 4px 2px 2px;
      border-radius: var(--r-pill);
      transition: background var(--t);
    }
    .avatar-btn:hover {
      background: var(--indigo-lt);
    }
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--indigo) 0%, #0047CC 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      box-shadow: 0 2px 8px rgba(0, 71, 204, 0.35);
      flex-shrink: 0;
    }
    .avatar-name {
      font-size: 0.855rem;
      font-weight: 600;
      color: var(--text);
      max-width: 110px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    @media (max-width: 900px) {
      .avatar-name { display: none; }
    }
    .avatar-chevron {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
      color: var(--muted);
    }

    /* User dropdown menu header */
    .menu-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.9rem 1rem 0.7rem;
      pointer-events: none;
    }
    .menu-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--indigo) 0%, #0047CC 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 800;
      flex-shrink: 0;
    }
    .menu-user-info strong {
      display: block;
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--text);
    }
    .role-tag {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: var(--indigo-lt);
      color: var(--indigo);
      padding: 0.1rem 0.45rem;
      border-radius: 4px;
      display: inline-block;
      margin-top: 3px;
    }
    .logout-item {
      color: var(--red) !important;
    }

    /* ── Custom User Dropdown ── */
    .user-dropdown-wrapper {
      position: relative;
    }
    .user-dropdown-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
    }
    .user-dropdown-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 220px;
      background: var(--surface);
      border-radius: var(--r);
      box-shadow: 0 10px 40px rgba(15, 23, 42, 0.15), 0 4px 12px rgba(15, 23, 42, 0.1);
      border: 1px solid var(--border);
      z-index: 1001;
      overflow: hidden;
      animation: dropdown-in 0.15s ease;
    }
    @keyframes dropdown-in {
      from { opacity: 0; transform: translateY(-8px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .menu-divider {
      height: 1px;
      background: var(--border);
      margin: 0.25rem 0;
    }
    .menu-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      width: 100%;
      padding: 0.65rem 1rem;
      background: none;
      border: none;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-2);
      text-decoration: none;
      cursor: pointer;
      transition: background var(--t), color var(--t);
    }
    .menu-item:hover {
      background: var(--indigo-lt);
      color: var(--indigo);
    }
    .menu-item mat-icon {
      font-size: 1.1rem;
      width: 1.1rem;
      height: 1.1rem;
    }
    .menu-item.logout-item:hover {
      background: rgba(239, 68, 68, 0.1);
      color: var(--red);
    }

    /* Hamburger */
    .hamburger {
      display: none;
      flex-direction: column;
      justify-content: center;
      gap: 5px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px;
      border-radius: var(--r);
      width: 40px;
      height: 40px;
      transition: background var(--t);
    }
    .hamburger:hover {
      background: var(--indigo-lt);
    }
    .ham-bar {
      display: block;
      width: 20px;
      height: 2px;
      background: var(--text-2);
      border-radius: 2px;
      transition: transform 0.22s ease, opacity 0.22s ease, width 0.22s ease;
      transform-origin: center;
    }
    .ham-bar.open:nth-child(1) {
      transform: translateY(7px) rotate(45deg);
    }
    .ham-bar.open:nth-child(2) {
      opacity: 0;
      width: 0;
    }
    .ham-bar.open:nth-child(3) {
      transform: translateY(-7px) rotate(-45deg);
    }

    /* ── Mobile drawer ── */
    .drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      z-index: 300;
      backdrop-filter: blur(3px);
      animation: fade-in 0.18s ease;
    }
    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes slide-in-right {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }

    .mobile-drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(360px, 90vw);
      background: var(--surface);
      z-index: 301;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      overscroll-behavior: contain;
      box-shadow: -8px 0 40px rgba(15, 23, 42, 0.18);
      border-radius: var(--r-xl) 0 0 var(--r-xl);
      animation: slide-in-right 0.22s ease;
    }

    /* Drawer gradient header */
    .drawer-header {
      padding: 1.25rem 1.25rem 1rem;
      background: linear-gradient(135deg, var(--indigo-dark) 0%, #003399 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      border-radius: var(--r-xl) 0 0 0;
    }
    .drawer-user {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .drawer-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(255,255,255,0.25);
      border: 2px solid rgba(255,255,255,0.5);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      font-weight: 800;
      flex-shrink: 0;
    }
    .drawer-name {
      font-size: 1rem;
      font-weight: 700;
      color: #fff;
    }
    .drawer-role {
      font-size: 0.72rem;
      font-weight: 600;
      color: rgba(255,255,255,0.7);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .drawer-brand-block {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .drawer-brand-logo {
      height: 44px;
      width: 44px;
      object-fit: contain;
      border-radius: 50%;
      background: #fff;
      flex-shrink: 0;
    }
    .drawer-brand-block .drawer-brand-name {
      font-size: 1.15rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: -0.02em;
    }
    .drawer-brand-block .drawer-brand-sub {
      font-size: 0.72rem;
      font-weight: 600;
      color: rgba(255,255,255,0.65);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-top: 2px;
    }
    .drawer-close {
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #fff;
      flex-shrink: 0;
      transition: background var(--t);
    }
    .drawer-close:hover {
      background: rgba(255,255,255,0.25);
    }
    .drawer-close mat-icon {
      font-size: 1.1rem;
      width: 1.1rem;
      height: 1.1rem;
    }

    /* Drawer links */
    .drawer-links {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      padding: 0.75rem 0.75rem;
      flex: 1 1 auto;
      /* Let the links scroll internally so the footer (Sign In / Sign Out) is
         always pinned inside the drawer instead of being pushed off-screen. */
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .drawer-links a {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.8rem 1rem;
      border-radius: var(--r);
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--text-2);
      text-decoration: none;
      transition: background var(--t), color var(--t);
    }
    .drawer-upload-rx {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.8rem 1rem;
      border: none;
      background: none;
      border-radius: var(--r);
      font: inherit;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--text-2);
      cursor: pointer;
      text-align: left;
      transition: background var(--t), color var(--t);
    }
    .drawer-upload-rx:hover { background: #E6F8F7; color: #007A76; }
    .drawer-upload-rx .dlink-badge { background: linear-gradient(135deg, #00B4AE 0%, #009994 100%); }
    .drawer-links a:hover {
      background: var(--indigo-lt);
      color: var(--indigo);
    }
    .drawer-links a.active {
      background: var(--indigo-lt);
      color: var(--indigo);
      font-weight: 600;
    }
    .drawer-links a.admin-link {
      color: var(--orange);
    }
    .drawer-links a.admin-link:hover,
    .drawer-links a.admin-link.active {
      background: var(--orange-lt);
      color: var(--orange-dark);
    }
    .dlink-icon {
      width: 36px;
      height: 36px;
      border-radius: var(--r);
      background: var(--bg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background var(--t);
    }
    .dlink-icon mat-icon {
      font-size: 1.15rem;
      width: 1.15rem;
      height: 1.15rem;
      color: var(--muted);
      transition: color var(--t);
    }
    .drawer-links a:hover .dlink-icon,
    .drawer-links a.active .dlink-icon {
      background: var(--indigo);
    }
    .drawer-links a:hover .dlink-icon mat-icon,
    .drawer-links a.active .dlink-icon mat-icon {
      color: #fff;
    }
    .drawer-links a.admin-link:hover .dlink-icon,
    .drawer-links a.admin-link.active .dlink-icon {
      background: var(--orange);
    }
    .dlink-label {
      flex: 1;
    }
    .dlink-badge {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: linear-gradient(135deg, var(--indigo) 0%, #0047CC 100%);
      color: #fff;
      padding: 0.15rem 0.5rem;
      border-radius: var(--r-pill);
    }
    .drawer-book-link {
      background: var(--indigo-lt) !important;
      color: var(--indigo) !important;
    }
    .drawer-book-link .dlink-icon {
      background: var(--indigo) !important;
    }
    .drawer-book-link .dlink-icon mat-icon {
      color: #fff !important;
    }

    /* Drawer footer */
    .drawer-footer {
      padding: 0.75rem 1rem;
      border-top: 1px solid var(--border-lt);
      flex-shrink: 0;
      padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
    }
    .drawer-auth {
      display: flex;
      gap: 0.75rem;
    }
    .da-btn {
      flex: 1;
      text-align: center;
      padding: 0.85rem;
      border-radius: var(--r);
      font-size: 0.95rem;
      font-weight: 700;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--t);
    }
    .da-btn.outline {
      border: 1.5px solid var(--border);
      color: var(--text-2);
    }
    .da-btn.outline:hover {
      border-color: var(--indigo);
      color: var(--indigo);
      background: var(--indigo-lt);
    }
    .da-btn.solid {
      background: linear-gradient(135deg, var(--indigo) 0%, #0047CC 100%);
      color: #fff;
      border: none;
      box-shadow: 0 4px 12px rgba(0, 71, 204, 0.35);
    }
    .da-btn.solid:hover {
      box-shadow: 0 6px 16px rgba(0, 71, 204, 0.48);
      transform: translateY(-1px);
    }
    .drawer-logout {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      background: #FEF2F2;
      border: 1.5px solid #FECACA;
      border-radius: var(--r);
      padding: 0.85rem;
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--red);
      cursor: pointer;
      transition: all var(--t);
    }
    .drawer-logout mat-icon {
      font-size: 1.1rem;
      width: 1.1rem;
      height: 1.1rem;
    }
    .drawer-logout:hover {
      background: #FECACA;
    }

    /* ── Main content ── */
    .main-content {
      flex: 1;
    }

    /* ── Bottom navigation ── */
    .bottom-nav {
      display: none;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 199;
      background: rgba(255, 255, 255, 0.97);
      backdrop-filter: saturate(180%) blur(16px);
      -webkit-backdrop-filter: saturate(180%) blur(16px);
      border-top: 1px solid var(--border);
      box-shadow: 0 -4px 24px rgba(0, 71, 204, 0.08);
      padding-bottom: env(safe-area-inset-bottom);
      height: calc(var(--bnav-h) + env(safe-area-inset-bottom));
      align-items: center;
    }

    .bnav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      padding: 6px 4px 4px;
      color: var(--muted);
      text-decoration: none;
      min-height: var(--bnav-h);
      transition: color var(--t);
    }
    .bnav-item:hover {
      color: var(--indigo);
      text-decoration: none;
    }
    .bnav-pill {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 28px;
      border-radius: var(--r-pill);
      transition: background var(--t);
    }
    .bnav-pill mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }
    .bnav-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .bnav-item.bnav-active {
      color: var(--indigo);
    }
    .bnav-item.bnav-active .bnav-pill {
      background: var(--indigo-lt);
    }

    /* Center FAB */
    .bnav-center {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      color: var(--muted);
      text-decoration: none;
      min-height: var(--bnav-h);
      padding-bottom: 4px;
      transition: color var(--t);
    }
    .bnav-center:hover {
      color: var(--indigo);
      text-decoration: none;
    }
    .bnav-center.bnav-active {
      color: var(--indigo);
    }
    .bnav-fab {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--indigo) 0%, #0047CC 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0, 71, 204, 0.45);
      margin-top: -16px;
      transition: box-shadow var(--t), transform var(--t);
    }
    .bnav-center:hover .bnav-fab {
      box-shadow: 0 6px 20px rgba(0, 71, 204, 0.6);
      transform: translateY(-2px);
    }
    .bnav-center.bnav-active .bnav-fab {
      background: linear-gradient(135deg, var(--indigo-dark) 0%, #003399 100%);
    }
    .bnav-fab mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      color: #fff;
    }

    /* ── Responsive ── */
    /* Signed in, the bar carries an extra "My Bookings" link and the Book Test
       CTA and needs ~1075px. Collapsing to the drawer at 768px left everything
       between 769px and ~1210px — iPads, and any laptop under ~1200px —
       scrolling sideways. Switch at the width the bar actually stops fitting. */
    @media (max-width: 1099px) {
      .nav-links         { display: none; }
      .hamburger         { display: flex; }
      .nav-btn.outline,
      .nav-btn.solid     { display: none; }
      .book-cta          { display: none; }
      .bottom-nav        { display: flex; }
      /* nav-links (flex:1) is hidden on mobile, so push the avatar + hamburger
         to the right edge instead of letting them cluster near the centre. */
      .nav-actions       { margin-left: auto; }
      .main-content {
        padding-bottom: calc(var(--bnav-h) + env(safe-area-inset-bottom));
      }
    }

    @media (max-width: 480px) {
      .nav-inner  { padding: 0 1rem; }
      .brand-name { font-size: 1rem; }
    }

    /* Smallest phones: signed in, the avatar leaves the brand too little room and
       it would otherwise push the bar wider than the screen — brand-name is the
       one piece here that can give way, so let it shrink and ellipsis. */
    @media (max-width: 380px) {
      .brand      { flex-shrink: 1; min-width: 0; }
      .brand-logo { height: 46px; width: 46px; }
      .brand-text { min-width: 0; }
      .brand-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .brand-tagline { display: none; }
    }

    /* ── Reduced motion ── */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `],
})
export class AppComponent implements OnInit {
  private auth          = inject(AuthStateService);
  private router        = inject(Router);
  private userApi       = inject(UserApiService);
  private dashboardReady = inject(DashboardReadyService);
  private seo           = inject(SeoService);
  prescriptionModal = inject(PrescriptionModalService);

  openPrescriptionFromDrawer(): void {
    this.mobileOpen.set(false);
    this.prescriptionModal.open();
  }

  mobileOpen   = signal(false);
  userMenuOpen = signal(false);
  currentUrl   = signal(this.router.url);   // reactive URL signal

  showHealthConcernModal = signal(false);
  private healthConcernTriggered = false;

  /** How long after the dashboard finishes loading before the health-concern prompt may appear. */
  private static readonly HEALTH_CONCERN_DELAY_MS = 10_000;

  constructor() {
    // Health-concern onboarding popup, patients (role 'user') only. The
    // dashboard must load and render first — this only starts a 10s timer
    // once the dashboard has reported itself ready, so nothing here blocks
    // or delays the dashboard itself. Shown only once per session, and only
    // if the user hasn't already answered/dismissed it (checked server-side
    // right before display, in maybeShowHealthConcernModal).
    effect(() => {
      const authed = this.auth.isAuthenticated();
      const currentRole = this.auth.role();
      const userId = this.auth.currentUser()?.id;
      if (!authed) {
        this.healthConcernTriggered = false;
        return;
      }
      if (currentRole !== 'user' || !userId || !this.dashboardReady.ready() || this.healthConcernTriggered) return;
      this.healthConcernTriggered = true;
      setTimeout(() => this.maybeShowHealthConcernModal(), AppComponent.HEALTH_CONCERN_DELAY_MS);
    }, { allowSignalWrites: true });
  }

  private maybeShowHealthConcernModal(): void {
    if (sessionStorage.getItem(HC_PROMPT_SKIPPED_SESSION_KEY)) return;
    if (!this.auth.isAuthenticated() || this.auth.role() !== 'user') return;

    this.userApi.getProfile().subscribe({
      next: (profile) => {
        if (profile.health_concerns?.length) return;
        if (profile.health_concern_prompt_dismissed) return;
        this.showHealthConcernModal.set(true);
      },
      // If the profile can't be loaded, err on the side of not interrupting.
      error: () => {},
    });
  }

  ngOnInit(): void {
    this.seo.setJsonLd('organization', buildOrganizationSchema());

    // Keep currentUrl signal in sync with every navigation, and reset the page
    // scroll to the top so each route opens at the beginning (the app scrolls
    // inside <body>, so window/ViewportScroller resets alone don't work).
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.currentUrl.set(e.urlAfterRedirects);
        resetScrollTop();
      });
  }

  onHealthConcernsSaved(keys: string[]): void {
    this.showHealthConcernModal.set(false);
    this.router.navigateByUrl('/tests?health_concern=' + keys.join(','));
  }

  onHealthConcernsClosed(): void {
    this.showHealthConcernModal.set(false);
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.userMenuOpen.set(!this.userMenuOpen());
  }

  isAuth       = this.auth.isAuthenticated;
  role         = computed(() => this.auth.currentUser()?.role ?? '');
  isAdmin      = computed(() => this.role() === 'admin');
  isTechnician = computed(() => this.role() === 'technician');
  userName     = computed(() => this.auth.currentUser()?.name ?? '');
  firstName    = computed(() => this.userName().trim().split(/\s+/)[0] ?? '');
  initials     = computed(() => {
    const name = this.userName();
    return name ? name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) : 'U';
  });
  isHome = computed(() => {
    const url = this.currentUrl();
    return url === '/' || url === '';
  });
  /** Public marketing/patient pages that show the sticky "Request a Call Back" bar. */
  showCallbackBar = computed(() => {
    const url = this.currentUrl().split('?')[0];
    return this.isHome() ||
           url.startsWith('/tests') ||
           url.startsWith('/packages') ||
           url.startsWith('/contact') ||
           url.startsWith('/about') ||
           url.startsWith('/reports');
  });
  /** Routes with their own complete layout — hide global shell for these */
  hideShell = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/admin') ||
           url.startsWith('/technician') ||
           url.startsWith('/auth');
  });
  showBottomNav = computed(() => {
    const url = this.currentUrl();
    return !url.startsWith('/admin') && !url.startsWith('/technician');
  });

  logout(): void {
    this.mobileOpen.set(false);
    this.auth.clearSession();
    this.router.navigate(['/tests']);
  }
}
