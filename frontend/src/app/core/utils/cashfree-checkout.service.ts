import { Injectable } from '@angular/core';
import { CheckoutConfig } from '../api/api.types';

export interface CashfreeSuccess {
  order_id: string;
}

interface CashfreeCheckoutResult {
  error?: { message?: string };
  redirect?: boolean;
  paymentDetails?: unknown;
}

interface CashfreeInstance {
  checkout(opts: { paymentSessionId: string; redirectTarget?: string }): Promise<CashfreeCheckoutResult>;
}

declare global {
  interface Window {
    Cashfree?: (opts: { mode: 'sandbox' | 'production' }) => CashfreeInstance;
  }
}

const CHECKOUT_SRC = 'https://sdk.cashfree.com/js/v3/cashfree.js';

/**
 * Loads Cashfree's Drop-in Checkout SDK on demand and opens the payment modal.
 * Unlike Razorpay, Cashfree hands back no signature on completion — the
 * caller must call the server's /payments/verify endpoint, which resolves
 * the real outcome via an authenticated API call rather than a client signature.
 */
@Injectable({ providedIn: 'root' })
export class CashfreeCheckoutService {
  private scriptPromise: Promise<void> | null = null;

  private loadScript(): Promise<void> {
    if (window.Cashfree) return Promise.resolve();
    if (this.scriptPromise) return this.scriptPromise;
    this.scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CHECKOUT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        this.scriptPromise = null;
        reject(new Error('Failed to load the payment window. Check your connection and try again.'));
      };
      document.body.appendChild(script);
    });
    return this.scriptPromise;
  }

  async open(checkout: CheckoutConfig): Promise<CashfreeSuccess> {
    await this.loadScript();
    if (!window.Cashfree) throw new Error('Payment window unavailable.');
    if (!checkout.payment_session_id) throw new Error('Payment session missing — please retry.');

    const cashfree = window.Cashfree({ mode: checkout.mode === 'live' ? 'production' : 'sandbox' });
    const result = await cashfree.checkout({
      paymentSessionId: checkout.payment_session_id,
      redirectTarget: '_modal',
    });
    if (result.error) {
      throw new Error(result.error.message || 'Payment was cancelled before completion.');
    }
    return { order_id: checkout.order_id! };
  }
}
