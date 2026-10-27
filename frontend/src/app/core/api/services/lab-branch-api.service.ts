import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { LabBranch } from '../api.types';

interface LabBranchListResponse { items: LabBranch[]; total: number; page: number; page_size: number; }

export interface LabBranchDeleteResult { action: 'deleted' | 'deactivated'; message: string; }

@Injectable({ providedIn: 'root' })
export class LabBranchApiService {
  constructor(private http: HttpClient) {}

  list(): Observable<LabBranch[]> {
    return this.http.get<LabBranchListResponse>('/lab-branches').pipe(
      map((r: LabBranchListResponse) => r.items)
    );
  }

  listAdmin(includeInactive = false, page = 1, pageSize = 50): Observable<LabBranch[]> {
    return this.http.get<LabBranchListResponse>(`/lab-branches?page=${page}&page_size=${pageSize}&include_inactive=${includeInactive}`).pipe(
      map((r: LabBranchListResponse) => r.items)
    );
  }

  create(data: Partial<LabBranch>): Observable<LabBranch> {
    return this.http.post<LabBranch>('/lab-branches', data);
  }

  update(id: string, data: Partial<LabBranch>): Observable<LabBranch> {
    return this.http.put<LabBranch>(`/lab-branches/${id}`, data);
  }

  /** Deletes outright, or deactivates instead when the branch has bookings. */
  delete(id: string): Observable<LabBranchDeleteResult> {
    return this.http.delete<LabBranchDeleteResult>(`/lab-branches/${id}`);
  }
}
