import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ServiceArea, Serviceability } from '../api.types';

@Injectable({ providedIn: 'root' })
export class ServiceAreaApiService {
  constructor(private http: HttpClient) {}

  list(): Observable<ServiceArea[]> {
    const params = new HttpParams().set('active_only', 'true').set('page_size', '500');
    return this.http
      .get<{ items: ServiceArea[] }>('/service-areas', { params })
      .pipe(map(r => r.items));
  }

  /**
   * Ask the backend whether each pincode can be served by home collection.
   * Batched so a whole address list costs one round trip.
   */
  checkServiceability(pincodes: string[]): Observable<Serviceability[]> {
    return this.http
      .post<{ results: Serviceability[] }>('/service-areas/serviceability', { pincodes })
      .pipe(map(r => r.results));
  }

  notifyMe(pincode: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/service-areas/notify-me', { pincode });
  }
}
