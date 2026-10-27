import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Package, PaginatedResponse } from '../api.types';

@Injectable({ providedIn: 'root' })
export class PackageApiService {
  constructor(private http: HttpClient) {}

  list(params: { include_inactive?: boolean; health_concern?: string; page?: number; page_size?: number } = {}): Observable<PaginatedResponse<Package>> {
    let p = new HttpParams();
    if (params.include_inactive) p = p.set('include_inactive', 'true');
    if (params.health_concern) p = p.set('health_concern', params.health_concern);
    if (params.page) p = p.set('page', params.page);
    if (params.page_size) p = p.set('page_size', params.page_size);
    return this.http.get<PaginatedResponse<Package>>('/packages', { params: p });
  }

  get(id: string): Observable<Package> {
    return this.http.get<Package>(`/packages/${id}`);
  }

  create(data: Partial<Package>): Observable<Package> {
    return this.http.post<Package>('/packages', data);
  }

  update(id: string, data: Partial<Package>): Observable<Package> {
    return this.http.put<Package>(`/packages/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/packages/${id}`);
  }
}
