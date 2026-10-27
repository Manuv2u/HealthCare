import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthStateService } from '../../core/auth/auth-state.service';

interface NavItem { label: string; icon: string; path: string; }

const NAV_ITEMS: NavItem[] = [
  { label: 'My Assignments', icon: 'calendar_month', path: '/technician/bookings' },
  { label: 'Back to Main Site', icon: 'home', path: '/' },
];

@Component({
  selector: 'app-technician-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatButtonModule],
  template: `
    <div class="tech-shell">
      <!-- Sidebar -->
      <aside class="sidebar" [class.open]="sidebarOpen()">
        <div class="sidebar-header">
          <a routerLink="/technician/bookings" class="portal-brand" (click)="sidebarOpen.set(false)">
            <div class="brand-icon-wrap">
              <img src="assets/logo-mark.png" alt="Sri Health Plus" class="brand-logo-img" />
            </div>
            <div class="brand-text">
              <span class="brand-title">Sri Health Plus</span>
              <span class="brand-sub">Field Technician</span>
            </div>
          </a>
          <button class="close-btn" (click)="sidebarOpen.set(false)" aria-label="Close menu">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="tech-info">
          <div class="tech-avatar">{{ initials() }}</div>
          <div class="tech-meta">
            <div class="tech-name">{{ name() }}</div>
            <div class="tech-role">Technician</div>
          </div>
        </div>

        <nav class="nav-items">
          @for (item of navItems; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item" (click)="sidebarOpen.set(false)">
              <span class="nav-icon-wrap">
                <mat-icon>{{ item.icon }}</mat-icon>
              </span>
              <span class="nav-label">{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <div class="footer-divider"></div>
          <button class="logout-btn" (click)="logout()">
            <mat-icon>logout</mat-icon>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      @if (sidebarOpen()) {
        <div class="backdrop" (click)="sidebarOpen.set(false)"></div>
      }

      <!-- Main content -->
      <div class="main">
        <header class="topbar">
          <button class="menu-btn" (click)="sidebarOpen.set(true)" aria-label="Open menu">
            <mat-icon>menu</mat-icon>
          </button>
          <a routerLink="/technician/bookings" class="topbar-brand">
            <div class="topbar-icon-wrap">
              <img src="assets/logo-mark.png" alt="Sri Health Plus" class="topbar-logo-img" />
            </div>
            <span class="topbar-title">Sri Health Plus</span>
          </a>
          <div class="topbar-spacer"></div>
          <div class="topbar-user">
            <div class="topbar-avatar">{{ initials() }}</div>
          </div>
        </header>
        <div class="content">
          <router-outlet />
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --emerald-900: #064E3B;
      --emerald-800: #065F46;
      --emerald-700: #047857;
      --emerald-600: #059669;
      --emerald-400: #34D399;
      --emerald-200: #A7F3D0;
      --emerald-100: #D1FAE5;
      --emerald-50: #ECFDF5;
      --saffron: #003399;
      --text-dark: #0F172A;
      --text-muted: #94A3B8;
      --border: #E2E8F0;
      --surface: #FFFFFF;
      --bg: #EEF4FF;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    .tech-shell {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background: var(--bg);
    }

    /* ── Sidebar ── */
    .sidebar {
      width: 264px;
      background: linear-gradient(180deg, var(--emerald-900) 0%, var(--emerald-800) 100%);
      color: #fff;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      position: relative;
      z-index: 50;
      height: 100vh;
      overflow-y: auto;
    }

    .sidebar-header {
      padding: 1.25rem 1.25rem 1rem;
      display: flex;
      align-items: center;
      gap: .75rem;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }

    .portal-brand {
      display: flex;
      align-items: center;
      gap: .75rem;
      flex: 1;
      text-decoration: none;
      color: inherit;
      border-radius: 8px;
      transition: opacity .15s;
      &:hover { opacity: .85; }
    }

    .brand-icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #fff;
      border: 1px solid rgba(52,211,153,.3);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      padding: 5px;
    }

    .brand-logo-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .brand-text { display: flex; flex-direction: column; gap: 1px; }
    .brand-title {
      font-size: .9rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -.01em;
    }
    .brand-sub {
      font-size: .68rem;
      color: rgba(255,255,255,.45);
      text-transform: uppercase;
      letter-spacing: .07em;
    }

    .close-btn {
      display: none;
      background: none;
      border: none;
      color: rgba(255,255,255,.6);
      cursor: pointer;
      border-radius: 6px;
      padding: .3rem;
      line-height: 0;
      transition: all .15s;
    }
    .close-btn mat-icon { font-size: 1.2rem; width: 1.2rem; height: 1.2rem; }
    .close-btn:hover { color: #fff; background: rgba(255,255,255,.1); }

    .tech-info {
      display: flex;
      align-items: center;
      gap: .875rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid rgba(255,255,255,.07);
    }

    .tech-avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--emerald-600) 0%, var(--emerald-700) 100%);
      border: 2px solid rgba(52,211,153,.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: .9rem;
      letter-spacing: .02em;
      flex-shrink: 0;
      color: #fff;
    }

    .tech-meta { display: flex; flex-direction: column; gap: 2px; }
    .tech-name { font-size: .875rem; font-weight: 600; color: #fff; }
    .tech-role {
      font-size: .68rem;
      color: rgba(255,255,255,.45);
      text-transform: uppercase;
      letter-spacing: .07em;
    }

    .nav-items {
      flex: 1;
      padding: 1rem .875rem 0;
      display: flex;
      flex-direction: column;
      gap: .25rem;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: .75rem;
      padding: .75rem .875rem;
      border-radius: 10px;
      text-decoration: none;
      color: rgba(255,255,255,.65);
      font-size: .875rem;
      font-weight: 500;
      transition: all .2s ease;
    }
    .nav-item:hover {
      background: rgba(255,255,255,.08);
      color: rgba(255,255,255,.9);
    }
    .nav-item.active {
      background: rgba(52,211,153,.15);
      border: 1px solid rgba(52,211,153,.25);
      color: var(--emerald-400);
      font-weight: 600;
    }
    .nav-item.active .nav-icon-wrap mat-icon { color: var(--emerald-400); }

    .nav-icon-wrap {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: rgba(255,255,255,.06);
    }
    .nav-item.active .nav-icon-wrap {
      background: rgba(52,211,153,.15);
    }
    .nav-icon-wrap mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; color: rgba(255,255,255,.6); }

    .nav-label { line-height: 1; }

    .sidebar-footer {
      padding: .875rem;
      margin-top: auto;
    }

    .footer-divider {
      height: 1px;
      background: rgba(255,255,255,.07);
      margin-bottom: .875rem;
    }

    .logout-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: .75rem;
      padding: .7rem .875rem;
      border: none;
      background: none;
      cursor: pointer;
      color: rgba(255,255,255,.5);
      font-size: .875rem;
      font-family: inherit;
      border-radius: 10px;
      transition: all .15s;
    }
    .logout-btn mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; }
    .logout-btn:hover {
      background: rgba(239,68,68,.12);
      color: #FCA5A5;
    }

    .backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(6,78,59,.55);
      backdrop-filter: blur(2px);
      z-index: 49;
    }

    /* ── Main ── */
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; height: 100vh; overflow: hidden; }

    .topbar {
      background: var(--surface);
      padding: 0 1.5rem;
      height: 64px;
      display: flex;
      align-items: center;
      gap: 1rem;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 10;
      box-shadow: 0 1px 3px rgba(6,78,59,.06);
    }

    .menu-btn {
      display: none;
      background: none;
      border: none;
      cursor: pointer;
      padding: .4rem;
      border-radius: 8px;
      color: var(--emerald-800);
      line-height: 0;
      transition: background .15s;
    }
    .menu-btn mat-icon { font-size: 1.35rem; width: 1.35rem; height: 1.35rem; }
    .menu-btn:hover { background: var(--emerald-50); }

    .topbar-brand {
      display: flex;
      align-items: center;
      gap: .6rem;
      text-decoration: none;
      color: inherit;
      cursor: pointer;
      transition: opacity .15s;
      &:hover { opacity: .8; }
    }

    .topbar-icon-wrap {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #fff;
      border: 1px solid var(--emerald-100);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
    }
    .topbar-logo-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .topbar-title {
      font-weight: 700;
      font-size: .95rem;
      color: var(--emerald-900);
      letter-spacing: -.01em;
    }

    .topbar-spacer { flex: 1; }

    .topbar-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--emerald-600) 0%, var(--emerald-700) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: .78rem;
      color: #fff;
      border: 2px solid var(--emerald-100);
    }

    .content {
      flex: 1;
      padding: 1.5rem;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
    }

    @media (max-width: 768px) {
      .sidebar {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        transform: translateX(-100%);
        transition: transform .28s cubic-bezier(.4,0,.2,1);
        z-index: 100;
      }
      .sidebar.open { transform: translateX(0); }
      .close-btn { display: flex; align-items: center; }
      .backdrop { display: block; }
      .menu-btn { display: flex; align-items: center; }
      .topbar-brand { display: flex; }
      .content { padding: 1rem; }
    }
  `],
})
export class TechnicianShellComponent {
  private auth = inject(AuthStateService);
  private router = inject(Router);

  sidebarOpen = signal(false);
  navItems = NAV_ITEMS;

  name = computed(() => this.auth.currentUser()?.name ?? 'Technician');
  initials = computed(() => {
    const n = this.name();
    return n ? n.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) : 'T';
  });

  logout(): void {
    this.auth.clearSession();
    this.router.navigate(['/auth/login']);
  }
}
