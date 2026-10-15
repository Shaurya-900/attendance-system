import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "E-Cell Attendance", short_name: "Attendance", start_url: "/me", display: "standalone", background_color: "#f4f6fb", theme_color: "#2341b5", icons: [{ src: "/icon.png", sizes: "256x256", type: "image/png" }] };
}
