/** Shared TypeScript interfaces matching backend Pydantic schemas. */

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface User {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
  role: string;
  is_active: boolean;
  health_concerns?: string[] | null;
  health_concern_prompt_dismissed?: boolean;
  created_at: string;
}

export interface HealthConcern {
  id: string;
  key: string;
  name: string;
  icon: string;
  display_order: number;
}

/** Which form a lead came from: the callback widget or the contact page. */
export type LeadSource = 'callback' | 'contact';

export interface CallbackRequest {
  id: string;
  source: LeadSource;
  name?: string | null;
  phone: string;
  email?: string | null;
  subject?: string | null;
  preferred_time?: string | null;
  /** What the visitor wrote — distinct from `notes`, which admins own. */
  message?: string | null;
  status: 'new' | 'contacted' | 'closed';
  notes?: string | null;
  created_at: string;
}

export type PrescriptionStatus = 'new' | 'called' | 'booked' | 'cancelled';

export interface PrescriptionFile {
  id: string;
  file_name: string;
  content_type: string;
  file_size: number;
  uploaded_at: string;
  download_url?: string | null;
}

export interface PrescriptionRequest {
  id: string;
  request_number: string;
  patient_name: string;
  mobile: string;
  email?: string | null;
  city: string;
  callback_time?: string | null;
  remarks?: string | null;
  status: PrescriptionStatus;
  otp_verified: boolean;
  source: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
  files: PrescriptionFile[];
}

export interface PrescriptionStats {
  today_requests: number;
  pending_calls: number;
  booked_from_prescription: number;
  conversion_rate: number;
}

export interface FamilyMember {
  id: string;
  user_id: string;
  name: string;
  relationship: string;
  date_of_birth?: string;
  gender?: string;
  is_active: boolean;
  deleted_at?: string;
}

export type RecommendedFor = 'male' | 'female' | 'other';

export interface FeatureCardItem {
  title: string;
  icon: string;
  enabled: boolean;
  order: number;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** General, application-wide FAQ entry (managed in the admin panel). */
export interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
  display_order: number;
}

export interface AdminFaq extends Faq {
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaqPayload {
  category: string;
  question: string;
  answer: string;
  display_order?: number;
  is_active?: boolean;
}

export interface Test {
  id: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  discount_percentage: number;   // backend field name
  effective_price: number;
  turnaround_hours: number;
  is_active: boolean;
  is_popular: boolean;
  sample_type?: string | null;
  recommended_for?: RecommendedFor[] | null;
  feature_cards?: FeatureCardItem[];
  faqs?: FaqItem[];
}

export interface ContactSettings {
  phone_number: string;
  whatsapp_number: string;
  callback_enabled: boolean;
  working_hours?: string | null;
  call_enabled: boolean;
  whatsapp_enabled: boolean;
}

export interface Package {
  id: string;
  name: string;
  description?: string;
  original_price: number;        // backend field name
  discounted_price: number;      // backend field name
  is_active: boolean;
  is_popular: boolean;
  tests: Test[];
  /** Best live coupon covering this package, if any — suggest it, never auto-apply. */
  eligible_coupon?: CouponSummary | null;
}

export interface TimeSlot {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  collection_type: string;
  max_capacity: number;
  remaining_capacity: number;
  is_enabled: boolean;
}

export interface ServiceArea {
  id: string;
  state?: string | null;
  district: string;
  taluk?: string | null;
  city: string;
  area?: string | null;          // locality / pincode area
  pincode: string;
  is_active: boolean;
  created_at: string;
}

/**
 * What cancelling a booking will cost and refund. Computed by the backend from
 * the same code path that performs the cancellation, so the figures shown before
 * confirming are exactly what gets applied.
 */
export interface CancellationQuote {
  amount_paid: number;
  cancellation_charge: number;
  refund_amount: number;
  fee_type?: 'percentage' | 'fixed' | null;
  charge_value?: number | null;
  has_charge: boolean;
  collection_type: string;
  /** How the booking was paid — tells the user where their refund lands. */
  payment_method?: string | null;
  /** Admin-configurable estimate, e.g. "5–7 working days". */
  refund_eta_text?: string | null;
}

/**
 * A home-collection serviceability verdict from the backend rules engine.
 * `message` is finished user-facing copy — render it, don't rebuild it, so new
 * backend rules (holidays, technician availability) need no UI change.
 */
export interface Serviceability {
  pincode: string;
  serviceable: boolean;
  reason_code: string;
  message: string;
  area_label?: string | null;
}

export interface LabBranch {
  id: string;
  name: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  operating_hours?: string;
  is_active: boolean;
}

export interface BookingItem {
  id: string;
  booking_id: string;
  item_type: string;
  item_name: string;
  test_id?: string;
  package_id?: string;
  unit_price: number;
}

export interface Booking {
  id: string;
  reference_number: string;
  user_id: string;
  patient_id?: string;
  collection_type: string;
  time_slot_id?: string;
  booking_date: string;
  lab_branch_id?: string;
  address_id?: string;
  pincode?: string;
  status: string;
  payment_status: string;
  total_amount: number;
  technician_notes?: string;
  cancellation_reason?: string;
  cancellation_fee?: number;
  collected_at?: string;
  processing_started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at?: string;
  items?: BookingItem[];

  // Enriched detail fields (from GET /bookings/{id})
  patient_name?: string;
  patient_gender?: string;
  patient_relationship?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  address?: BookingAddress;
  time_slot?: BookingTimeSlot;
  lab_branch?: BookingLabBranch;
  payment?: BookingPayment;
  assigned_technician?: AssignedTechnician;
  status_history?: BookingStatusHistoryEntry[];
  reports?: Report[];
  refund?: Refund;
}

export interface BookingAddress {
  label: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface BookingTimeSlot {
  start_time: string;
  end_time: string;
  collection_type: string;
}

export interface BookingLabBranch {
  name: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
}

export interface BookingPayment {
  id?: string;
  method: string;
  status: string;
  amount: number;
  gst_amount: number;
  invoice_number?: string;
  paid_at?: string;
  notes?: string;
}

export interface Refund {
  id: string;
  amount: number;
  reason: string;
  status: 'initiated' | 'approved' | 'completed' | 'failed';
  /** Set once the refund reached the gateway — absence means it can be retried. */
  gateway_refund_id?: string | null;
  transaction_reference?: string;
  remarks?: string;
  initiated_at?: string;
  completed_at?: string;
}

export interface AssignedTechnician {
  id: string;
  name?: string;
  phone?: string;
  assignment_status: string;
  assigned_at?: string;
}

export interface BookingStatusHistoryEntry {
  from_status?: string;
  to_status: string;
  reason?: string;
  changed_at?: string;
}

export interface Report {
  id: string;
  booking_id: string;
  file_name: string;
  file_size_bytes: number;
  uploaded_by: string;
  uploader_role: string;
  uploaded_at: string;
  retention_until: string;
}

export interface CheckoutConfig {
  gateway: string;                // 'razorpay' | 'cashfree'
  key_id?: string | null;
  /** 'test' = sandbox (no real money) | 'live' | 'unknown'. */
  mode?: string;
  currency: string;
  order_id?: string | null;
  amount_paise?: number | null;
  /** Cashfree Drop-in Checkout only — per-order token needed to open its modal. */
  payment_session_id?: string | null;
}

export interface Payment {
  payment_id: string;
  order_id: string;
  payment_url: string | null;
  amount: number;
  gst_amount: number;
  totals?: BillingTotals | null;
  checkout?: CheckoutConfig | null;
}

/** Server-computed money summary — the frontend renders it, never recomputes it. */
export interface BillingAdjustment {
  kind: 'discount' | 'charge';
  label: string;
  amount: number;
}

export interface BillingTotals {
  subtotal: number;
  discount_total: number;
  charge_total: number;
  taxable_amount: number;
  gst_enabled: boolean;
  gst_percentage: number;
  gst_amount: number;
  total: number;
  adjustments: BillingAdjustment[];
  refund_eta_text: string;
}

export interface BookingAdjustment extends BillingAdjustment {
  id: string;
  booking_id: string;
  created_at: string;
}

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  payment_id: string;
  booking_id: string;
  user_id: string;
  subtotal: number;
  discount_total: number;
  charge_total: number;
  gst_rate: number;
  gst_amount: number;
  total: number;
  amount_paid: number;
  payment_method: string;
  company?: Record<string, unknown> | null;
  customer?: {
    name?: string; phone?: string; email?: string; patient_name?: string;
    patient_id?: string; age?: number | null; gender?: string | null;
    address?: string | null; referred_by?: string | null; report_status?: string;
    booking_reference?: string; booking_date?: string; collection_type?: string;
  } | null;
  line_items?: {
    label: string; amount: number; qty?: number; item_type?: string;
    sample_type?: string | null; package_tests?: string[];
  }[] | null;
  adjustments?: BillingAdjustment[] | null;
  payment_details?: {
    gateway?: string | null; method?: string; status?: string;
    transaction_id?: string | null; reference?: string | null; paid_at?: string | null;
  } | null;
  technician?: {
    name?: string; phone?: string; employee_id?: string;
    assigned_at?: string | null; collected_at?: string | null;
  } | null;
  issued_at: string;
  has_pdf: boolean;
}

export interface Technician {
  id: string;
  user_id?: string;              // optional — technicians can exist without a linked user account
  name: string;
  phone: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface FeatureFlag {
  id: string;
  key: string;
  is_enabled: boolean;
  description?: string;
  updated_at: string;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  is_temp_password?: boolean;
}

export interface UserAddress {
  id: string;
  user_id: string;
  label: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  created_at: string;
}

export interface UserAddressListResponse {
  items: UserAddress[];
  total: number;
  page: number;
  page_size: number;
}

// ── Admin customer management ──────────────────────────────────────────────────

export type AccountStatus = 'active' | 'inactive' | 'blocked';

export interface AdminUserRow {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  avatar_url?: string | null;
  is_active: boolean;
  account_status: AccountStatus;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  last_login_at?: string | null;
  last_active_at?: string | null;
  is_online: boolean;
  total_bookings: number;
  total_tests: number;
  total_packages: number;
  total_spent: number;
  pending_reports: number;
  completed_reports: number;
  preferred_collection_type?: 'home' | 'lab' | null;
  city?: string | null;
  state?: string | null;
  tags: string[];
}

export interface AdminUserStats {
  total: number;
  active: number;
  inactive: number;
  blocked: number;
  online: number;
  new_today: number;
  new_this_week: number;
  total_bookings: number;
  total_revenue: number;
  home_collection_users: number;
  lab_visit_users: number;
  pending_reports: number;
  completed_reports: number;
  by_role: Record<string, number>;
}

export interface UserAggregates {
  total_bookings: number;
  pending_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  home_collections: number;
  lab_visits: number;
  total_tests: number;
  total_packages: number;
  total_amount_paid: number;
  refund_amount: number;
}

export interface AdminUserDetail {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  role: string;
  gender?: string | null;
  date_of_birth?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  account_status: AccountStatus;
  email_verified: boolean;
  email_verified_at?: string | null;
  phone_verified: boolean;
  phone_verified_at?: string | null;
  health_concerns: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
  first_login_at?: string | null;
  last_login_at?: string | null;
  last_logout_at?: string | null;
  last_active_at?: string | null;
  is_online: boolean;
  login_count: number;
  login_attempt_count: number;
  login_window_expires_at?: string | null;
  preferred_collection_type?: 'home' | 'lab' | null;
  aggregates: UserAggregates;
}

export interface LoginEvent {
  id: string;
  event_type: 'login_success' | 'login_failed' | 'logout';
  ip_address?: string | null;
  browser?: string | null;
  os?: string | null;
  device_type?: string | null;
  created_at: string;
}

export interface IpHistoryEntry {
  ip_address: string;
  last_seen: string;
  count: number;
}

export interface LoginActivity {
  events: LoginEvent[];
  total: number;
  ip_history: IpHistoryEntry[];
}

export interface AdminNote {
  id: string;
  note: string;
  is_internal: boolean;
  author_id: string;
  author_name?: string | null;
  created_at: string;
}

export interface AdminUserFilters {
  q?: string;
  role?: string;
  account_status?: string[];
  is_online?: boolean;
  email_verified?: boolean;
  phone_verified?: boolean;
  city?: string[];
  state?: string[];
  pincode?: string;
  collection_type?: 'home' | 'lab';
  has_bookings?: boolean;
  report_status?: 'pending' | 'completed';
  registered_from?: string;
  registered_to?: string;
  last_login_from?: string;
  last_login_to?: string;
  last_active_from?: string;
  last_active_to?: string;
  min_spent?: number;
  max_spent?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

// ── Banners (homepage hero carousel + admin management) ──────────────────────
export type BannerCategory =
  | 'packages'
  | 'home_collection'
  | 'corporate'
  | 'health_awareness'
  | 'offers'
  | 'diagnostics';

export type BannerStatus = 'draft' | 'published';

/** advertisement: image/marketing only. promotional_offer: marketing only too —
 * may link to a Coupon (coupon_id) purely to display its code as a badge. */
export type BannerType = 'advertisement' | 'promotional_offer';
export type DiscountType = 'percentage' | 'fixed';

/** Fixed picklist for the Highlights field — no free text. Keep in sync with
 * backend/app/schemas/banners.py::BANNER_HIGHLIGHTS. */
export const BANNER_HIGHLIGHTS: readonly string[] = [
  'Home Collection',
  'NABL Certified',
  'Digital Reports',
  'Same-Day Results',
  'Certified Technicians',
  'No Prior Appointment Needed',
  '100% Safe & Hygienic',
  'Doorstep Service',
  '24x7 Support',
];

export interface Banner {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  cta_text?: string | null;
  cta_link?: string | null;
  cta2_text?: string | null;
  cta2_link?: string | null;
  highlights: string[];
  category: BannerCategory;
  banner_type: BannerType;
  coupon?: CouponSummary | null;
  display_order: number;
  desktop_image_url?: string | null;
  mobile_image_url?: string | null;
}

/** Admin banner shape returned by GET /banners/admin. */
export interface AdminBanner extends Banner {
  coupon_id?: string | null;
  status: BannerStatus;
  created_at: string;
  updated_at: string;
}

export interface BannerPayload {
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  cta_text?: string | null;
  cta_link?: string | null;
  cta2_text?: string | null;
  cta2_link?: string | null;
  highlights?: string[];
  category?: BannerCategory;
  banner_type?: BannerType;
  coupon_id?: string | null;
  display_order?: number;
  status?: BannerStatus;
}

// ── Coupons ────────────────────────────────────────────────────────────────────
export interface CouponSummary {
  code: string;
  discount_type: DiscountType;
  discount_value: number;
}

export interface Coupon extends CouponSummary {
  id: string;
  package_ids: string[];
  valid_from?: string | null;
  valid_until?: string | null;
  usage_limit?: number | null;
  per_user_limit?: number | null;
  times_used: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CouponPayload {
  code?: string;
  discount_type?: DiscountType;
  discount_value?: number;
  package_ids?: string[];
  valid_from?: string | null;
  valid_until?: string | null;
  usage_limit?: number | null;
  per_user_limit?: number | null;
  is_active?: boolean;
}

export interface CouponValidateResult {
  valid: boolean;
  error_code?: string | null;
  message?: string | null;
  coupon?: CouponSummary | null;
  discount_amount?: number | null;
}
