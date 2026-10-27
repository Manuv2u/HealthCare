import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CallbackRequest, LeadSource, PaginatedResponse } from '../api.types';

export interface CallbackRequestCreate {
  name?: string;
  phone: string;
  source?: LeadSource;
  email?: string;
  subject?: string;
  preferred_time?: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class CallbackRequestApiService {
  constructor(private http: HttpClient) {}

  create(data: CallbackRequestCreate): Observable<CallbackRequest> {
    return this.http.post<CallbackRequest>('/callback-requests', data);
  }

  list(params: { status?: string; source?: string; page?: number; page_size?: number } = {}): Observable<PaginatedResponse<CallbackRequest>> {
    let p = new HttpParams();
    if (params.status) p = p.set('status', params.status);
    if (params.source) p = p.set('source', params.source);
    if (params.page) p = p.set('page', params.page);
    if (params.page_size) p = p.set('page_size', params.page_size);
    return this.http.get<PaginatedResponse<CallbackRequest>>('/callback-requests', { params: p });
  }

  updateStatus(id: string, data: { status: string; notes?: string }): Observable<CallbackRequest> {
    return this.http.put<CallbackRequest>(`/callback-requests/${id}`, data);
  }
}
