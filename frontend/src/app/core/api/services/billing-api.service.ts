import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BillingTotals, BookingAdjustment, InvoiceRecord } from '../api.types';

export interface BillingConfigPublic {
  gst_enabled: boolean;
  gst_percentage: number;
  refund_eta_text: string;
  company_name?: string | null;
}

export interface BillingSettings {
  invoice_enabled: boolean;
  invoice_prefix: string;
  gst_enabled: boolean;
  gst_percentage: number;
  gstin?: string | null;
  company_name?: string | null;
  company_address?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
  invoice_footer?: string | null;
  show_logo: boolean;
  refund_eta_text: string;
  show_barcode: boolean;
  show_doctor: boolean;
  show_technician: boolean;
  show_patient_address: boolean;
  show_signature: boolean;
  show_report_info: boolean;
  show_qr_code: boolean;
  currency_symbol: string;
  decimal_precision: number;
  company_website?: string | null;
  company_cin?: string | null;
  nabl_registration_number?: string | null;
  iso_certification?: string | null;
}

export interface InvoiceList {
  items: InvoiceRecord[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * All money figures come from the backend billing engine — components render
 * what these endpoints return and never compute GST/discounts/totals locally.
 */
@Injectable({ providedIn: 'root' })
export class BillingApiService {
  constructor(private http: HttpClient) {}

  /** Pre-booking checkout quote (server-side prices and GST). coupon_code is
   * only ever applied when explicitly supplied — nothing auto-applies. */
  quote(test_ids: string[], package_ids: string[], coupon_code?: string): Observable<BillingTotals> {
    return this.http.post<BillingTotals>('/billing/quote', { test_ids, package_ids, coupon_code });
  }

  /** Public display config (GST visibility, refund ETA). */
  config(): Observable<BillingConfigPublic> {
    return this.http.get<BillingConfigPublic>('/billing/config');
  }

  /** Totals for an existing booking (items + manual adjustments). */
  bookingSummary(bookingId: string): Observable<BillingTotals> {
    return this.http.get<BillingTotals>(`/bookings/${bookingId}/billing-summary`);
  }

  // ── adjustments (admin) ────────────────────────────────────────────────────

  listAdjustments(bookingId: string): Observable<BookingAdjustment[]> {
    return this.http.get<BookingAdjustment[]>(`/bookings/${bookingId}/adjustments`);
  }

  addAdjustment(
    bookingId: string,
    body: { kind: 'discount' | 'charge'; label: string; amount: number },
  ): Observable<BookingAdjustment> {
    return this.http.post<BookingAdjustment>(`/bookings/${bookingId}/adjustments`, body);
  }

  deleteAdjustment(bookingId: string, adjustmentId: string): Observable<void> {
    return this.http.delete<void>(`/bookings/${bookingId}/adjustments/${adjustmentId}`);
  }

  // ── billing settings (admin) ───────────────────────────────────────────────

  getBillingSettings(): Observable<BillingSettings> {
    return this.http.get<BillingSettings>('/admin/settings/billing');
  }

  updateBillingSettings(body: Partial<BillingSettings>): Observable<BillingSettings> {
    return this.http.put<BillingSettings>('/admin/settings/billing', body);
  }

  // ── invoices ───────────────────────────────────────────────────────────────

  searchInvoices(params: {
    q?: string; date_from?: string; date_to?: string; page?: number; page_size?: number;
  }): Observable<InvoiceList> {
    let hp = new HttpParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') hp = hp.set(k, String(v));
    }
    return this.http.get<InvoiceList>('/invoices', { params: hp });
  }

  myInvoices(page = 1, pageSize = 20): Observable<InvoiceList> {
    return this.http.get<InvoiceList>('/invoices/mine', {
      params: new HttpParams().set('page', page).set('page_size', pageSize),
    });
  }

  getInvoice(invoiceId: string): Observable<InvoiceRecord> {
    return this.http.get<InvoiceRecord>(`/invoices/${invoiceId}`);
  }

  invoicePdf(invoiceId: string, download = false): Observable<Blob> {
    return this.http.get(`/invoices/${invoiceId}/pdf`, {
      params: new HttpParams().set('download', download),
      responseType: 'blob',
    });
  }

  /** Admin: re-render the PDF from the immutable snapshot (template refresh). */
  regenerateInvoicePdf(invoiceId: string): Observable<Blob> {
    return this.http.post(`/invoices/${invoiceId}/regenerate-pdf`, null, {
      responseType: 'blob',
    });
  }

  /** Email the invoice PDF; admins may pass a recipient override. */
  emailInvoice(invoiceId: string, email?: string): Observable<{ sent: boolean; email: string }> {
    return this.http.post<{ sent: boolean; email: string }>(
      `/invoices/${invoiceId}/email`, { email: email || undefined },
    );
  }
}
