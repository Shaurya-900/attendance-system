"use client";

import { createBrowserSupabase } from "@/lib/supabase/client";

export function GoogleButton({ next, domain }: { next: string; domain: string | null }) {
  async function signIn() {
    await createBrowserSupabase().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: domain ? { hd: domain, prompt: "select_account" } : { prompt: "select_account" },
      },
    });
  }
  return <button onClick={signIn} className="btn w-full">Continue with Google</button>;
}
