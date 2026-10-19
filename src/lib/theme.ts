/** "system" follows the device; light and dark are saved choices. */
export type Theme = "system" | "light" | "dark";
export const THEME_COOKIE = "theme";
/** Page background per theme, used for the browser bar (theme-color). Matches --bg in globals.css. */
export const PAPER = { light: "#f4f6fb", dark: "#0d1224" } as const;
