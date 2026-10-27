import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FamilyMember, User, UserAddress, UserAddressListResponse } from '../api.types';

@Injectable({ providedIn: 'root' })
export class UserApiService {
  constructor(private http: HttpClient) {}

  getProfile(): Observable<User> {
    return this.http.get<User>('/users/me');
  }

  updateProfile(data: Partial<User>): Observable<User> {
    return this.http.put<User>('/users/me', data);
  }

  getFamilyMembers(): Observable<FamilyMember[]> {
    return this.http.get<FamilyMember[]>('/users/me/family-members');
  }

  addFamilyMember(data: Partial<FamilyMember>): Observable<FamilyMember> {
    return this.http.post<FamilyMember>('/users/me/family-members', data);
  }

  updateFamilyMember(id: string, data: Partial<FamilyMember>): Observable<FamilyMember> {
    return this.http.put<FamilyMember>(`/users/me/family-members/${id}`, data);
  }

  deleteFamilyMember(id: string): Observable<void> {
    return this.http.delete<void>(`/users/me/family-members/${id}`);
  }

  getAddresses(): Observable<UserAddressListResponse> {
    return this.http.get<UserAddressListResponse>('/users/me/addresses');
  }

  addAddress(data: Partial<UserAddress>): Observable<UserAddress> {
    return this.http.post<UserAddress>('/users/me/addresses', data);
  }

  updateAddress(id: string, data: Partial<UserAddress>): Observable<UserAddress> {
    return this.http.put<UserAddress>(`/users/me/addresses/${id}`, data);
  }

  deleteAddress(id: string): Observable<void> {
    return this.http.delete<void>(`/users/me/addresses/${id}`);
  }

  requestAccountDeletion(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>('/users/me');
  }
}
