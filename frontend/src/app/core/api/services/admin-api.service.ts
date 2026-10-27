import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AdminNote,
  AdminUserDetail,
  AdminUserFilters,
  AdminUserStats,
  AdminUserRow,
  FeatureFlag,
  LoginActivity,
  PaginatedResponse,
  Technician,
} from '../api.types';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  constructor(private http: HttpClient) {}

  // ── Dashboard ──────────────────────────────────────────────────────────────
  getDashboard(): Observable<any> {
    return this.http.get<any>('/admin/dashboard');
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  private toParams(filters: AdminUserFilters): HttpParams {
    let p = new HttpParams();
    const set = (k: string, v: unknown) => {
      if (v === undefined || v === null || v === '') return;
      if (Array.isArray(v)) {
        v.forEach((item) => { if (item !== undefined && item !== null && item !== '') p = p.append(k, String(item)); });
      } else {
        p = p.set(k, String(v));
      }
    };
    Object.entries(filters).forEach(([k, v]) => set(k, v));
    return p;
  }

  getUsers(filters: AdminUserFilters = {}): Observable<PaginatedResponse<AdminUserRow>> {
    return this.http.get<PaginatedResponse<AdminUserRow>>('/admin/users', { params: this.toParams(filters) });
  }

  getUserStats(): Observable<AdminUserStats> {
    return this.http.get<AdminUserStats>('/admin/users/stats');
  }

  exportUsers(filters: AdminUserFilters, format: 'csv' | 'xlsx'): Observable<Blob> {
    const params = this.toParams({ ...filters, page: undefined, page_size: undefined, sort: undefined, order: undefined }).set('format', format);
    return this.http.get('/admin/users/export', { params, responseType: 'blob' });
  }

  getUser(id: string): Observable<AdminUserDetail> {
    return this.http.get<AdminUserDetail>(`/admin/users/${id}`);
  }

  getUserBookings(id: string, page = 1, pageSize = 20): Observable<PaginatedResponse<any>> {
    return this.http.get<PaginatedResponse<any>>(`/admin/users/${id}/bookings`, { params: new HttpParams().set('page', page).set('page_size', pageSize) });
  }

  getUserPayments(id: string, page = 1, pageSize = 50): Observable<PaginatedResponse<any>> {
    return this.http.get<PaginatedResponse<any>>(`/admin/users/${id}/payments`, { params: new HttpParams().set('page', page).set('page_size', pageSize) });
  }

  getUserReports(id: string, page = 1, pageSize = 50): Observable<PaginatedResponse<any>> {
    return this.http.get<PaginatedResponse<any>>(`/admin/users/${id}/reports`, { params: new HttpParams().set('page', page).set('page_size', pageSize) });
  }

  getUserAddresses(id: string): Observable<any[]> {
    return this.http.get<any[]>(`/admin/users/${id}/addresses`);
  }

  getUserFamily(id: string): Observable<any[]> {
    return this.http.get<any[]>(`/admin/users/${id}/family`);
  }

  getUserLoginActivity(id: string): Observable<LoginActivity> {
    return this.http.get<LoginActivity>(`/admin/users/${id}/login-events`);
  }

  getUserAuditLogs(id: string, limit = 50, offset = 0): Observable<any> {
    return this.http.get<any>(`/admin/users/${id}/audit-logs`, { params: new HttpParams().set('limit', limit).set('offset', offset) });
  }

  getUserNotes(id: string): Observable<AdminNote[]> {
    return this.http.get<AdminNote[]>(`/admin/users/${id}/notes`);
  }

  addUserNote(id: string, note: string, isInternal = true): Observable<AdminNote> {
    return this.http.post<AdminNote>(`/admin/users/${id}/notes`, { note, is_internal: isInternal });
  }

  updateUser(id: string, data: Partial<{ name: string; email: string; phone: string; alternate_phone: string; gender: string; date_of_birth: string }>): Observable<any> {
    return this.http.patch<any>(`/admin/users/${id}`, data);
  }

  uploadUserAvatar(id: string, file: File): Observable<{ message: string; avatar_url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ message: string; avatar_url: string }>(`/admin/users/${id}/avatar`, form);
  }

  resetUserPassword(id: string): Observable<any> {
    return this.http.post<any>(`/admin/users/${id}/reset-password`, {});
  }

  verifyUserEmail(id: string): Observable<any> {
    return this.http.post<any>(`/admin/users/${id}/verify-email`, {});
  }

  verifyUserMobile(id: string): Observable<any> {
    return this.http.post<any>(`/admin/users/${id}/verify-mobile`, {});
  }

  setUserTags(id: string, tags: string[]): Observable<any> {
    return this.http.patch<any>(`/admin/users/${id}/tags`, { tags });
  }

  blockUser(id: string, reason?: string): Observable<any> {
    return this.http.patch<any>(`/admin/users/${id}/block`, { reason });
  }

  unblockUser(id: string): Observable<any> {
    return this.http.patch<any>(`/admin/users/${id}/unblock`, {});
  }

  notifyUser(id: string, eventType: string, channels: string[]): Observable<any> {
    return this.http.post<any>(`/admin/users/${id}/notify`, { event_type: eventType, channels });
  }

  exportUserData(id: string): Observable<Blob> {
    return this.http.get(`/admin/users/${id}/export`, { responseType: 'blob' });
  }

  deleteUser(id: string): Observable<any> {
    return this.http.delete<any>(`/admin/users/${id}`);
  }

  activateUser(id: string): Observable<any> {
    return this.http.patch<any>(`/admin/users/${id}/activate`, {});
  }

  deactivateUser(id: string): Observable<any> {
    return this.http.patch<any>(`/admin/users/${id}/deactivate`, {});
  }

  changeUserRole(id: string, newRole: 'user' | 'technician'): Observable<any> {
    return this.http.patch<any>(`/admin/users/${id}/change-role`, { new_role: newRole });
  }

  // ── Analytics ──────────────────────────────────────────────────────────────
  getAnalytics(params: { date_from?: string; date_to?: string } = {}): Observable<any> {
    let p = new HttpParams();
    if (params.date_from) p = p.set('date_from', params.date_from);
    if (params.date_to)   p = p.set('date_to', params.date_to);
    return this.http.get<any>('/admin/analytics', { params: p });
  }

  exportCsv(params: { date_from?: string; date_to?: string } = {}): Observable<Blob> {
    let p = new HttpParams();
    if (params.date_from) p = p.set('date_from', params.date_from);
    if (params.date_to)   p = p.set('date_to', params.date_to);
    return this.http.get('/admin/analytics/export', { params: p, responseType: 'blob' });
  }

  getAuditLogs(params: Record<string, any> = {}): Observable<any> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) p = p.set(k, v); });
    return this.http.get<any>('/admin/audit-logs', { params: p });
  }

  // ── Feature flags ──────────────────────────────────────────────────────────
  getFeatureFlags(): Observable<FeatureFlag[]> {
    return this.http.get<FeatureFlag[]>('/feature-flags');
  }

  updateFeatureFlag(id: string, data: Partial<FeatureFlag>): Observable<FeatureFlag> {
    return this.http.put<FeatureFlag>(`/feature-flags/${id}`, data);
  }

  // ── Technicians ────────────────────────────────────────────────────────────
  getTechnicians(): Observable<any> {
    return this.http.get<any>('/technicians');
  }

  createTechnician(data: Partial<Technician>): Observable<Technician> {
    return this.http.post<Technician>('/technicians', data);
  }

  createTechnicianAccount(data: { name: string; phone: string; email: string; password: string }): Observable<any> {
    return this.http.post<any>('/technicians/create-account', data);
  }

  updateTechnician(id: string, data: Partial<Technician>): Observable<Technician> {
    return this.http.put<Technician>(`/technicians/${id}`, data);
  }

  deleteTechnician(id: string): Observable<void> {
    return this.http.delete<void>(`/technicians/${id}`);
  }

  getWorkload(date: string): Observable<any[]> {
    return this.http.get<any[]>(`/technicians/workload?date=${date}`);
  }

  // ── Booking assignment ───────────────────────────────────────────────────────
  assignTechnician(technicianId: string, bookingId: string): Observable<any> {
    return this.http.post<any>(`/technicians/${technicianId}/assign`, { booking_id: bookingId });
  }

  autoAssignTechnician(bookingId: string): Observable<any> {
    return this.http.post<any>(`/bookings/${bookingId}/auto-assign`, {});
  }
}
