import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TimeSlot } from '../api.types';

@Injectable({ providedIn: 'root' })
export class TimeSlotApiService {
  constructor(private http: HttpClient) {}

  getAvailable(date: string, collection_type: string): Observable<TimeSlot[]> {
    const p = new HttpParams().set('date', date).set('collection_type', collection_type);
    return this.http.get<TimeSlot[]>('/time-slots/available', { params: p });
  }
}
