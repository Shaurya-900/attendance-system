"use client";

import { useState } from "react";
import { PAPER, THEME_COOKIE, type Theme } from "@/lib/theme";

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Theme, string> = { system: "Auto", light: "Light", dark: "Dark" };

/** Cycles Auto (follow the device), Light, Dark. Saved in a cookie so the server renders the right theme with no flash. */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState(initial);
  function cycle() {
    const next = NEXT[theme];
    setTheme(next);
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    // Keep the browser bar in step without a reload.
    const deviceDark = matchMedia("(prefers-color-scheme: dark)").matches;
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
      const dark = next === "system" ? (m.media ? m.media.includes("dark") : deviceDark) : next === "dark";
      m.content = dark ? PAPER.dark : PAPER.light;
    });
  }
  return (
    <button type="button" onClick={cycle} className="btn-ghost" aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[NEXT[theme]]}`} title="Switch theme">
      Theme: {LABEL[theme]}
    </button>
  );
}
