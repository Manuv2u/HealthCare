import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PaginatedResponse, Test } from '../api.types';

@Injectable({ providedIn: 'root' })
export class TestApiService {
  constructor(private http: HttpClient) {}

  list(params: { q?: string; category?: string; health_concern?: string; page?: number; page_size?: number; include_inactive?: boolean } = {}): Observable<PaginatedResponse<Test>> {
    let p = new HttpParams();
    if (params.q) p = p.set('q', params.q);
    if (params.category) p = p.set('category', params.category);
    if (params.health_concern) p = p.set('health_concern', params.health_concern);
    if (params.page) p = p.set('page', params.page);
    if (params.page_size) p = p.set('page_size', params.page_size);
    if (params.include_inactive) p = p.set('include_inactive', 'true');
    return this.http.get<PaginatedResponse<Test>>('/tests', { params: p });
  }

  get(id: string): Observable<Test> {
    return this.http.get<Test>(`/tests/${id}`);
  }

  create(data: Partial<Test>): Observable<Test> {
    return this.http.post<Test>('/tests', data);
  }

  update(id: string, data: Partial<Test>): Observable<Test> {
    return this.http.put<Test>(`/tests/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/tests/${id}`);
  }
}
