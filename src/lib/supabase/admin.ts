import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

/** Service-role client. Server only; bypasses RLS. */
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
