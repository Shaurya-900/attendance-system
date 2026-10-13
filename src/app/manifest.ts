import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "E-Cell Attendance", short_name: "Attendance", start_url: "/me", display: "standalone", background_color: "#f7f7f5", theme_color: "#0f766e" };
}
