import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpParams, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PaginatedResponse, PrescriptionRequest, PrescriptionStats } from '../api.types';

export interface PrescriptionSubmitPayload {
  patient_name: string;
  mobile: string;
  city: string;
  verification_token: string;
  email?: string;
  callback_time?: string;
  remarks?: string;
  files: File[];
}

@Injectable({ providedIn: 'root' })
export class PrescriptionApiService {
  constructor(private http: HttpClient) {}

  // ── Public ──────────────────────────────────────────────────────────────

  sendOtp(mobile: string): Observable<{ message: string; expires_in_seconds: number }> {
    return this.http.post<{ message: string; expires_in_seconds: number }>(
      '/prescriptions/send-otp', { mobile },
    );
  }

  verifyOtp(mobile: string, otp: string): Observable<{ verified: boolean; verification_token: string }> {
    return this.http.post<{ verified: boolean; verification_token: string }>(
      '/prescriptions/verify-otp', { mobile, otp },
    );
  }

  /** Multipart submit with upload-progress events. */
  submit(payload: PrescriptionSubmitPayload): Observable<HttpEvent<{ id: string; request_number: string; message: string }>> {
    const form = new FormData();
    form.set('patient_name', payload.patient_name);
    form.set('mobile', payload.mobile);
    form.set('city', payload.city);
    form.set('verification_token', payload.verification_token);
    if (payload.email) form.set('email', payload.email);
    if (payload.callback_time) form.set('callback_time', payload.callback_time);
    if (payload.remarks) form.set('remarks', payload.remarks);
    for (const f of payload.files) form.append('files', f, f.name);

    const req = new HttpRequest('POST', '/prescriptions', form, { reportProgress: true });
    return this.http.request<{ id: string; request_number: string; message: string }>(req);
  }

  // ── Admin ───────────────────────────────────────────────────────────────

  list(params: {
    status?: string; q?: string; page?: number; page_size?: number;
    sort?: string; order?: 'asc' | 'desc';
  } = {}): Observable<PaginatedResponse<PrescriptionRequest>> {
    let p = new HttpParams();
    if (params.status) p = p.set('status', params.status);
    if (params.q) p = p.set('q', params.q);
    if (params.page) p = p.set('page', params.page);
    if (params.page_size) p = p.set('page_size', params.page_size);
    if (params.sort) p = p.set('sort', params.sort);
    if (params.order) p = p.set('order', params.order);
    return this.http.get<PaginatedResponse<PrescriptionRequest>>('/prescriptions', { params: p });
  }

  get(id: string): Observable<PrescriptionRequest> {
    return this.http.get<PrescriptionRequest>(`/prescriptions/${id}`);
  }

  update(id: string, data: { status?: string; assigned_to?: string; remarks?: string }): Observable<PrescriptionRequest> {
    return this.http.put<PrescriptionRequest>(`/prescriptions/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/prescriptions/${id}`);
  }

  stats(): Observable<PrescriptionStats> {
    return this.http.get<PrescriptionStats>('/prescriptions/stats');
  }

  export(format: 'xlsx' | 'pdf', params: { status?: string; q?: string } = {}): Observable<Blob> {
    let p = new HttpParams().set('format', format);
    if (params.status) p = p.set('status', params.status);
    if (params.q) p = p.set('q', params.q);
    return this.http.get('/prescriptions/export', { params: p, responseType: 'blob' });
  }
}
