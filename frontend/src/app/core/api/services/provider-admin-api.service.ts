import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface OtpUsageWindow {
  total: number;
  sent: number;
  failed: number;
  success_rate: number | null;
  failure_rate: number | null;
}

export interface OtpOverview {
  active_provider: string;
  provider_status: 'ok' | 'error' | 'unconfigured';
  provider_health_detail: string;
  capabilities: string[];
  sms_balance: number | null;
  balance_supported: boolean;
  delivery_reports_supported: boolean;
  usage: { today: OtpUsageWindow; week: OtpUsageWindow; month: OtpUsageWindow };
  last_otp_sent_at: string | null;
  last_synced_at: string;
  links: { dashboard?: string; recharge?: string; billing?: string };
  available_providers: string[];
}

export interface PaymentPeriodStats {
  transactions: number;
  successful: number;
  revenue: number;
  failed: number;
  pending: number;
}

export interface PaymentOverview {
  active_gateway: string;
  gateway_mode: 'test' | 'live' | 'unknown';
  gateway_status: 'ok' | 'error' | 'unconfigured';
  gateway_health_detail: string;
  capabilities: string[];
  analytics: {
    today: PaymentPeriodStats; week: PaymentPeriodStats;
    month: PaymentPeriodStats; all_time: PaymentPeriodStats;
  };
  refunds: Record<string, { count: number; amount: number } | number>;
  settlements: { id: string; amount: number; status: string; created_at: number }[] | null;
  settlements_supported: boolean;
  webhooks: {
    last_successful_at: string | null;
    last_successful_event: string | null;
    last_failed_at: string | null;
    last_failed_error: string | null;
  };
  links: { dashboard?: string; settlements?: string; reports?: string };
  available_gateways: string[];
  last_synced_at: string;
}

/** Admin dashboards for the OTP provider and payment gateway. */
@Injectable({ providedIn: 'root' })
export class ProviderAdminApiService {
  constructor(private http: HttpClient) {}

  otpOverview(): Observable<OtpOverview> {
    return this.http.get<OtpOverview>('/admin/otp/overview');
  }

  setOtpProvider(provider: string): Observable<OtpOverview> {
    return this.http.put<OtpOverview>('/admin/otp/provider', { provider });
  }

  paymentOverview(): Observable<PaymentOverview> {
    return this.http.get<PaymentOverview>('/admin/payments/overview');
  }

  setPaymentGateway(gateway: string): Observable<PaymentOverview> {
    return this.http.put<PaymentOverview>('/admin/payments/gateway', { gateway });
  }
}
