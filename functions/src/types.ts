export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'MANAGER' | 'SUPER_MANAGER';
export type AccountStatus = 'active' | 'suspended' | 'deactivated';
export type BusinessStatus = 'active' | 'suspended' | 'archived';
export type BranchStatus = 'active' | 'inactive' | 'archived';
export type FormStatus = 'draft' | 'published';
export type QuestionType = 'star' | 'good_okay_poor' | 'mcq' | 'yes_no' | 'text';
export type SentimentClassification = 'GOOD' | 'OKAY' | 'POOR' | 'NONE';
export type LicenseStatus = 'trial' | 'active' | 'expired';
export type PaymentStatus = 'pending' | 'verified' | 'failed';
export type NotificationStatus = 'UNREAD' | 'READ' | 'RESOLVED';
export type NotificationType = 'POOR_REVIEW_ALERT' | 'EXPIRY_REMINDER' | 'LICENSE_ACTIVATED';

export type UserPermission =
  | 'VIEW_DASHBOARD'
  | 'VIEW_REVIEWS'
  | 'VIEW_CUSTOMERS'
  | 'VIEW_REPORTS'
  | 'RECEIVE_ALERTS'
  | 'MANAGE_BUSINESS'
  | 'MANAGE_BRANCH'
  | 'MANAGE_FORMS'
  | 'MANAGE_QR'
  | 'MANAGE_TEAM'
  | 'MANAGE_LICENSE'
  | 'MANAGE_PAYMENTS'
  | 'EXPORT_DATA';

export interface UserProfile {
  id: string;
  auth_uid: string;
  role: UserRole;
  owner_id: string;
  name: string;
  email: string;
  mobile: string;
  status: AccountStatus;
  force_password_change?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  logo_url?: string;
  description?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country: string;
  status: BusinessStatus;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  is_demo?: boolean;
}

export interface Branch {
  id: string;
  owner_id: string;
  business_id: string;
  name: string;
  address?: string;
  phone?: string;
  description?: string;
  logo_url?: string;
  theme_color?: string;
  status: BranchStatus;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  is_demo?: boolean;
}

export interface UserAccess {
  id: string;
  user_id: string;
  owner_id: string;
  business_id: string;
  branch_id?: string;
  permissions: UserPermission[];
  status: 'active' | 'revoked';
  created_at: string;
}

export interface ReviewForm {
  id: string;
  owner_id: string;
  business_id: string;
  branch_id: string;
  name: string;
  description?: string;
  status: FormStatus;
  published_version: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
  is_demo?: boolean;
}

export interface ReviewFormPage {
  id: string;
  owner_id: string;
  form_id: string;
  page_number: number;
  title: string;
  description?: string;
  display_order: number;
}

export interface ReviewQuestion {
  id: string;
  owner_id: string;
  form_id: string;
  page_id?: string;
  text: string;
  type: QuestionType;
  required: boolean;
  display_order: number;
  active: boolean;
  classification_config?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  text: string;
  display_order: number;
  classification: SentimentClassification;
  active: boolean;
}

export interface Customer {
  id: string;
  owner_id: string;
  name: string;
  mobile: string;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  owner_id: string;
  business_id: string;
  branch_id: string;
  form_id: string;
  form_version: number;
  qr_id: string;
  customer_id: string;
  classification: 'GOOD' | 'OKAY' | 'POOR';
  average_score: number;
  submitted_at: string;
  created_at: string;
  is_demo?: boolean;
}

export interface ReviewAnswer {
  id: string;
  review_id: string;
  question_id: string;
  question_text_snapshot: string;
  question_type: QuestionType;
  answer_value: string | number | boolean;
  classification: SentimentClassification;
  score?: number;
}

export interface QrCodeRecord {
  id: string;
  owner_id: string;
  business_id: string;
  branch_id: string;
  secure_token: string;
  status: 'active' | 'inactive';
  created_at: string;
  deactivated_at?: string;
  is_demo?: boolean;
}

export interface LicensePlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  duration_days: number;
  maximum_branches: number;
  is_trial: boolean;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface License {
  id: string;
  owner_id: string;
  plan_id: string;
  status: LicenseStatus;
  start_date: string;
  expiry_date: string;
  maximum_branches: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentRecord {
  id: string;
  owner_id: string;
  license_id: string;
  plan_id: string;
  gateway: 'razorpay';
  payment_id: string;
  transaction_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  invoice_number: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationRecord {
  id: string;
  owner_id: string;
  business_id: string;
  branch_id: string;
  review_id?: string;
  title: string;
  message: string;
  type: NotificationType;
  created_at: string;
}

export interface NotificationRecipientRecord {
  id: string;
  notification_id: string;
  user_id: string;
  owner_id: string;
  business_id: string;
  branch_id: string;
  status: NotificationStatus;
  created_at: string;
  updated_at: string;
}

export interface PushDeviceRecord {
  id: string;
  user_id: string;
  owner_id: string;
  device_token: string;
  platform: 'android' | 'ios';
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  last_seen_at: string;
}

export interface AuditLogRecord {
  id: string;
  owner_id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface PlatformSettings {
  id: string;
  trial_duration_days: number;
  support_email: string;
  maintenance_mode: boolean;
  updated_at: string;
}
