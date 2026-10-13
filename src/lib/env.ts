function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const env = {
  get backend(): "memory" | "supabase" {
    return process.env.DATA_BACKEND === "memory" ? "memory" : "supabase";
  },
  get appSecret() {
    return required("APP_SECRET");
  },
  get rpID() {
    return required("WEBAUTHN_RP_ID");
  },
  get origin() {
    return required("WEBAUTHN_ORIGIN");
  },
  get allowedEmailDomain() {
    return process.env.ALLOWED_EMAIL_DOMAIN?.toLowerCase() || null;
  },
  get timezone() {
    return process.env.APP_TIMEZONE || "Asia/Kolkata";
  },
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get secureCookies() {
    return process.env.WEBAUTHN_ORIGIN?.startsWith("https://") ?? false;
  },
};
