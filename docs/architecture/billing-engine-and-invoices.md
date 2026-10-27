# Billing Engine, GST & Immutable Invoices

## The one rule

**Every rupee figure a user sees is computed server-side by `BillingService`**
(`backend/app/services/billing_service.py`). The frontend renders what the API
returns and never hardcodes GST, discounts, cancellation charges or
totals. (Before this module, checkout hardcoded 18% GST client-side.)

## Money math

```
subtotal        = Σ item unit prices (catalog effective prices)
discount_total  = Σ admin 'discount' adjustments
charge_total    = Σ admin 'charge' adjustments
taxable_amount  = max(subtotal − discount_total + charge_total, 0)
gst_amount      = taxable_amount × gst% / 100     (0 when GST disabled)
total           = taxable_amount + gst_amount
```

Consumers of the engine (all always agree, by construction):

| Consumer | Endpoint |
|---|---|
| Checkout summary | `POST /api/v1/billing/quote` (pre-booking, catalog-priced) |
| Booking summary | `GET /api/v1/bookings/{id}/billing-summary` |
| Payment initiation | `POST /api/v1/payments/initiate` (order amount = total) |
| Booking creation | pending payment row carries the same gross total |
| Invoice issuance | snapshot of the same totals |
| Public display config | `GET /api/v1/billing/config` (gst on/off, %, refund ETA) |

## Settings

`billing_settings` (versioned single-active rows, seeded by migration 0028 with
the historical defaults — 18% GST on, invoices on):

invoice_enabled · invoice_prefix · gst_enabled · gst_percentage · gstin ·
company_name/address/phone/email · invoice_footer · show_logo · refund_eta_text

Managed at **Admin → Billing & GST Settings**
(`GET/PUT /api/v1/admin/settings/billing`, partial updates supported). When GST
is disabled, GST rows disappear from quotes, checkout, new payments and new
invoices; issued invoices never change.

## Manual adjustments

`booking_adjustments` — admin-added discounts/extra charges per booking
(Admin → Bookings drawer). API: `GET/POST/DELETE
/api/v1/bookings/{id}/adjustments`. Locked once the booking is paid, because
the invoice is already issued. They flow automatically into every consumer
above.

## Immutable invoices

An `invoices` row is created **exactly once**, when a payment succeeds
(`InvoiceService.issue_for_payment`, idempotent). Everything is snapshotted at
issue time: amounts, GST rate, company block (name/address/GSTIN/footer),
customer block, line items, adjustments, amount paid / balance due. The PDF is
rendered from the snapshot and stored via the storage backend
(`invoices/<number>.pdf`, local or S3); re-downloads serve the stored bytes and
re-render byte-equivalent output from the snapshot if storage lost them.
Nothing on an issued invoice is ever updated except `pdf_storage_key`.

Invoice numbers come from a real PostgreSQL sequence:
`{prefix}-{year}-{seq:06d}` — settings changes can never collide or reset
numbering.

Endpoints: admin search `GET /api/v1/invoices` (invoice number / payment id /
booking id / date range), patient `GET /api/v1/invoices/mine`,
metadata `GET /api/v1/invoices/{id}`, PDF `GET /api/v1/invoices/{id}/pdf`
(inline for view/print, `?download=true` for download), plus the legacy
`GET /api/v1/payments/{payment_id}/invoice` which now serves the stored
invoice (with an on-the-fly fallback for pre-module payments).

## A note on the amount-semantics fix

`payments.amount` was written inconsistently before this module (subtotal at
booking creation, GST-inclusive total after initiation), and refund math added
`gst_amount` on top — inflating cancellation quotes and refund caps by the GST
amount for online-paid bookings. `amount` is now canonically the **gross
amount collected** everywhere, and quotes/refunds/caps read it directly.
