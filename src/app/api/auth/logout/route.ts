import { NextResponse, type NextRequest } from "next/server";
import { DEV_USER_COOKIE } from "@/lib/auth";
import { env } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  if (env.backend === "memory") res.cookies.set(DEV_USER_COOKIE, "", { path: "/", maxAge: 0 });
  else await (await createSessionClient()).auth.signOut();
  return res;
}
