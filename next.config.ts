import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Keep visited and prefetched pages in the browser's router cache so switching is instant.
    // Server actions call revalidatePath, which clears it, so your own edits show right away;
    // changes made by someone else appear within a minute (or on reload).
    staleTimes: { dynamic: 30, static: 60 },
  },
};

export default nextConfig;
