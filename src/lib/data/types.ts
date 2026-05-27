export type ProfileRow = {
  id: string;
  full_name: string | null;
  business_name: string | null;
  business_type: string | null;
  goal: string | null;
  country: string | null;
  city: string | null;
  /** Téléphone ou ligne de contact (synchronisé avec la table `profiles`) */
  contact_phone: string | null;
  offer: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionPlan = "free" | "pro";

export type SubscriptionRow = {
  user_id: string;
  plan: SubscriptionPlan;
  quota_limit: number;
  quota_used: number;
  expires_at: string | null;
  subscription_status?: string | null;
  pro_since?: string | null;
  payment_provider?: string | null;
  payment_reference?: string | null;
  created_at: string;
  updated_at: string;
};

export type GenerationRow = {
  id: string;
  user_id: string;
  mode: string;
  input: string;
  output: unknown;
  created_at: string;
};
