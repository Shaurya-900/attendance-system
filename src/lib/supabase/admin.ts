import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

/**
 * Reads are retried once on a dropped connection, so a brief network blip doesn't fail the page.
 * Writes are never retried automatically, so nothing can be saved twice.
 */
export const retryingFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  try {
    return await fetch(input, init);
  } catch (e) {
    if (method !== "GET" && method !== "HEAD") throw e;
    await new Promise((r) => setTimeout(r, 150));
    return fetch(input, init);
  }
};

/** Service-role client. Server only; bypasses RLS. */
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: retryingFetch },
  });
}
