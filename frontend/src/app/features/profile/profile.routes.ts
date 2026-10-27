import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./profile-new/profile-new.component').then(m => m.ProfileNewComponent),
    canActivate: [authGuard],
  },
  {
    path: 'family',
    loadComponent: () => import('./family-members-new/family-members-new.component').then(m => m.FamilyMembersNewComponent),
    canActivate: [authGuard],
  },
  {
    path: 'addresses',
    loadComponent: () => import('./address-book-new/address-book-new.component').then(m => m.AddressBookNewComponent),
    canActivate: [authGuard],
  },
];
