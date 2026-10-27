import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ContactSettings } from '../api.types';

@Injectable({ providedIn: 'root' })
export class ContactSettingsApiService {
  constructor(private http: HttpClient) {}

  get(): Observable<ContactSettings> {
    return this.http.get<ContactSettings>('/contact-settings');
  }

  update(data: ContactSettings): Observable<ContactSettings> {
    return this.http.put<ContactSettings>('/admin/settings/contact', data);
  }
}
