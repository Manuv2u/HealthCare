import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Coupon, CouponPayload, CouponValidateResult } from '../api.types';

@Injectable({ providedIn: 'root' })
export class CouponApiService {
  constructor(private http: HttpClient) {}

  /** Admin: every coupon. */
  listAll(): Observable<Coupon[]> {
    return this.http.get<Coupon[]>('/coupons/admin');
  }

  create(data: CouponPayload): Observable<Coupon> {
    return this.http.post<Coupon>('/coupons', data);
  }

  update(id: string, data: Partial<CouponPayload>): Observable<Coupon> {
    return this.http.put<Coupon>(`/coupons/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/coupons/${id}`);
  }

  /** Checkout-time code lookup — validates without applying anything. */
  validate(code: string, package_ids: string[]): Observable<CouponValidateResult> {
    return this.http.post<CouponValidateResult>('/coupons/validate', { code, package_ids });
  }
}
