import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Booking, CancellationQuote, PaginatedResponse } from '../api.types';

@Injectable({ providedIn: 'root' })
export class BookingApiService {
  constructor(private http: HttpClient) {}

  create(data: object): Observable<Booking> {
    return this.http.post<Booking>('/bookings', data);
  }

  /** Read-only: what cancelling would charge and refund. Cancels nothing. */
  cancellationQuote(id: string): Observable<CancellationQuote> {
    return this.http.get<CancellationQuote>(`/bookings/${id}/cancellation-quote`);
  }

  list(params: {
    page?: number;
    page_size?: number;
    date_from?: string;
    date_to?: string;
    status?: string;
    collection_type?: string;
    technician_id?: string;
    lab_branch_id?: string;
    search?: string;
  } = {}): Observable<PaginatedResponse<Booking>> {
    let p = new HttpParams();
    if (params.page) p = p.set('page', params.page);
    if (params.page_size) p = p.set('page_size', params.page_size);
    if (params.date_from) p = p.set('date_from', params.date_from);
    if (params.date_to) p = p.set('date_to', params.date_to);
    if (params.status) p = p.set('status', params.status);
    if (params.collection_type) p = p.set('collection_type', params.collection_type);
    if (params.technician_id) p = p.set('technician_id', params.technician_id);
    if (params.lab_branch_id) p = p.set('lab_branch_id', params.lab_branch_id);
    if (params.search) p = p.set('search', params.search);
    return this.http.get<PaginatedResponse<Booking>>('/bookings', { params: p });
  }

  get(id: string): Observable<Booking> {
    return this.http.get<Booking>(`/bookings/${id}`);
  }

  cancel(id: string, reason: string): Observable<Booking> {
    return this.http.post<Booking>(`/bookings/${id}/cancel`, { reason });
  }

  reschedule(id: string, data: { slot_id: string; booking_date: string }): Observable<Booking> {
    return this.http.post<Booking>(`/bookings/${id}/reschedule`, data);
  }

  getMyAssigned(params: { page?: number; page_size?: number; status?: string } = {}): Observable<PaginatedResponse<Booking>> {
    let p = new HttpParams();
    if (params.page) p = p.set('page', params.page);
    if (params.page_size) p = p.set('page_size', params.page_size);
    if (params.status) p = p.set('status', params.status);
    return this.http.get<PaginatedResponse<Booking>>('/bookings/my-assigned', { params: p });
  }

  updateStatus(id: string, bookingStatus: string, reason?: string): Observable<Booking> {
    const body: { status: string; reason?: string } = { status: bookingStatus };
    if (reason && reason.trim()) body.reason = reason.trim();
    return this.http.put<Booking>(`/bookings/${id}/status`, body);
  }

  addRemarks(id: string, notes: string): Observable<Booking> {
    return this.http.post<Booking>(`/bookings/${id}/remarks`, { notes });
  }
}
