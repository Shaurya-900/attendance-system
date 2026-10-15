import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Keeps the Supabase auth session fresh. No-op for the in-memory demo backend. */
export async function middleware(req: NextRequest) {
  if (process.env.DATA_BACKEND === "memory") return NextResponse.next();
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  // Refreshes an expiring session; verifies locally when the project uses asymmetric JWT keys.
  await supabase.auth.getClaims();
  return res;
}

export const config = {
  // Skip static assets and the projector's 2-second live poll (that route checks the session itself).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|api/admin/meetings/[^/]+/live).*)"],
};
