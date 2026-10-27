import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminBanner, Banner, BannerPayload } from '../api.types';

@Injectable({ providedIn: 'root' })
export class BannerApiService {
  constructor(private http: HttpClient) {}

  /** Public: active + published banners for the homepage carousel. */
  list(): Observable<Banner[]> {
    return this.http.get<Banner[]>('/banners');
  }

  /** Admin: every banner regardless of status. */
  listAll(): Observable<AdminBanner[]> {
    return this.http.get<AdminBanner[]>('/banners/admin');
  }

  create(data: BannerPayload): Observable<AdminBanner> {
    return this.http.post<AdminBanner>('/banners', data);
  }

  update(id: string, data: Partial<BannerPayload>): Observable<AdminBanner> {
    return this.http.put<AdminBanner>(`/banners/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/banners/${id}`);
  }

  reorder(items: { id: string; display_order: number }[]): Observable<void> {
    return this.http.put<void>('/banners/reorder', { items });
  }

  uploadImage(id: string, variant: 'desktop' | 'mobile', file: File): Observable<AdminBanner> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<AdminBanner>(`/banners/${id}/image?variant=${variant}`, form);
  }
}
