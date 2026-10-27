import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CheckoutConfig, Payment, Refund } from '../api.types';

export interface RefundStatusUpdateRequest {
  status: 'approved' | 'completed' | 'failed';
  remarks?: string;
  transaction_reference?: string;
}

export interface PaymentVerifyRequest {
  booking_id: string;
  gateway_order_id: string;
  gateway_payment_id: string;
  gateway_signature: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentApiService {
  constructor(private http: HttpClient) {}

  initiate(booking_id: string, method: string): Observable<Payment> {
    return this.http.post<Payment>('/payments/initiate', { booking_id, method });
  }

  /** Which gateway is active + the public key the checkout UI needs. */
  checkoutConfig(): Observable<CheckoutConfig> {
    return this.http.get<CheckoutConfig>('/payments/checkout-config');
  }

  /** Confirm a checkout-completed payment (signature-verified server-side). */
  verify(body: PaymentVerifyRequest): Observable<{ status: string; payment_id: string }> {
    return this.http.post<{ status: string; payment_id: string }>('/payments/verify', body);
  }

  getInvoice(paymentId: string): Observable<Blob> {
    return this.http.get(`/payments/${paymentId}/invoice`, { responseType: 'blob' });
  }

  updateRefundStatus(refundId: string, body: RefundStatusUpdateRequest): Observable<Refund> {
    return this.http.put<Refund>(`/payments/refunds/${refundId}/status`, body);
  }

  /** Retry the gateway call for a refund whose automatic initiation failed. */
  retryRefund(refundId: string): Observable<Refund> {
    return this.http.post<Refund>(`/payments/refunds/${refundId}/retry`, {});
  }
}
