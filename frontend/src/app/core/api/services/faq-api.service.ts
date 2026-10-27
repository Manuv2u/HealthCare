import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminFaq, Faq, FaqPayload } from '../api.types';

@Injectable({ providedIn: 'root' })
export class FaqApiService {
  constructor(private http: HttpClient) {}

  /** Public: active FAQs for the /faq page and Contact section. */
  list(): Observable<Faq[]> {
    return this.http.get<Faq[]>('/faqs');
  }

  /** Admin: every FAQ regardless of active status. */
  listAll(): Observable<AdminFaq[]> {
    return this.http.get<AdminFaq[]>('/faqs/admin');
  }

  create(data: FaqPayload): Observable<AdminFaq> {
    return this.http.post<AdminFaq>('/faqs', data);
  }

  update(id: string, data: Partial<FaqPayload>): Observable<AdminFaq> {
    return this.http.put<AdminFaq>(`/faqs/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/faqs/${id}`);
  }

  reorder(items: { id: string; display_order: number }[]): Observable<void> {
    return this.http.put<void>('/faqs/reorder', { items });
  }
}
