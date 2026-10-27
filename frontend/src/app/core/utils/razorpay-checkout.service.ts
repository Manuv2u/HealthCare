import { Injectable } from '@angular/core';
import { CheckoutConfig } from '../api/api.types';

export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void };
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * Loads Razorpay's Checkout script on demand and opens the payment modal.
 * The caller gets a promise that resolves with the gateway's success payload
 * (to be verified server-side) or rejects on dismissal/failure.
 */
@Injectable({ providedIn: 'root' })
export class RazorpayCheckoutService {
  private scriptPromise: Promise<void> | null = null;

  private loadScript(): Promise<void> {
    if (window.Razorpay) return Promise.resolve();
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

  async open(
    checkout: CheckoutConfig,
    opts: {
      name: string;
      description?: string;
      prefill?: { name?: string; contact?: string; email?: string };
      method?: { card?: 0 | 1; netbanking?: 0 | 1; wallet?: 0 | 1; upi?: 0 | 1 };
    },
  ): Promise<RazorpaySuccess> {
    await this.loadScript();
    if (!window.Razorpay) throw new Error('Payment window unavailable.');
    return new Promise<RazorpaySuccess>((resolve, reject) => {
      const rzp = new window.Razorpay!({
        key: checkout.key_id,
        order_id: checkout.order_id,
        amount: checkout.amount_paise,
        currency: checkout.currency || 'INR',
        name: opts.name,
        description: opts.description,
        prefill: opts.prefill ?? {},
        method: opts.method,
        // Puts UPI first as its own highlighted block, everything else grouped below —
        // without this Razorpay defaults to an alphabetical/internal method order.
        config: {
          display: {
            blocks: {
              upi: { name: 'Pay via UPI', instruments: [{ method: 'upi' }] },
              other: {
                name: 'Other payment modes',
                instruments: [{ method: 'card' }, { method: 'netbanking' }, { method: 'wallet' }],
              },
            },
            sequence: ['block.upi', 'block.other'],
            preferences: { show_default_blocks: false },
          },
        },
        theme: { color: '#0F766E' },
        handler: (response: RazorpaySuccess) => resolve(response),
        modal: {
          ondismiss: () => reject(new Error('Payment was cancelled before completion.')),
        },
      });
      rzp.open();
    });
  }
}
