import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HealthConcern } from '../api.types';

export interface HealthConcernMapping {
  test_ids: string[];
  package_ids: string[];
}

@Injectable({ providedIn: 'root' })
export class HealthConcernApiService {
  constructor(private http: HttpClient) {}

  list(): Observable<HealthConcern[]> {
    return this.http.get<HealthConcern[]>('/health-concerns');
  }

  getMappings(id: string): Observable<HealthConcernMapping> {
    return this.http.get<HealthConcernMapping>(`/health-concerns/${id}/mappings`);
  }

  setTests(id: string, ids: string[]): Observable<void> {
    return this.http.put<void>(`/health-concerns/${id}/tests`, { ids });
  }

  setPackages(id: string, ids: string[]): Observable<void> {
    return this.http.put<void>(`/health-concerns/${id}/packages`, { ids });
  }
}
