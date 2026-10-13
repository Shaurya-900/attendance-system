import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Keep visited pages in the browser's router cache so switching back is instant.
    // Server actions call revalidatePath, which clears it, so edits still show right away.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
