import type { NextConfig } from "next";

// Applied to every response. No script-src here: Next's inline bootstrap scripts would need a
// per-request nonce; these directives still block framing, plugins, <base> hijacking and
// forms posting to other sites.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Check-in URLs carry the QR token; never send them to other sites.
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), publickey-credentials-get=(self), publickey-credentials-create=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Keep visited and prefetched pages in the browser's router cache so switching is instant.
    // Server actions call revalidatePath, which clears it, so your own edits show right away;
    // changes made by someone else appear within a minute (or on reload).
    staleTimes: { dynamic: 30, static: 60 },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
