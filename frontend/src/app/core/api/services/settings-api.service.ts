import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CancellationSetting {
  id: string;
  charge_type: 'percentage' | 'fixed';
  charge_value: number;
  is_active: boolean;
}

@Injectable({ providedIn: 'root' })
export class SettingsApiService {
  constructor(private http: HttpClient) {}

  getCancellationSetting(): Observable<CancellationSetting | null> {
    return this.http.get<CancellationSetting | null>('/admin/settings/cancellation');
  }
}
