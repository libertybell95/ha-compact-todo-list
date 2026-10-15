import type { HomeAssistant } from "../types/home-assistant";

/**
 * Applies a named Home Assistant theme to a single element by setting its CSS
 * custom properties, mirroring how dashboards apply themes. "auto" (or an
 * unknown theme) removes previously applied variables so the card inherits.
 * Returns the variable names that are now set.
 */
export function applyTheme(
  element: HTMLElement,
  hass: Pick<HomeAssistant, "themes"> | undefined,
  themeName: string,
  previous: readonly string[],
): string[] {
  for (const name of previous) element.style.removeProperty(name);
  if (themeName === "auto") return [];
  const theme = hass?.themes?.themes?.[themeName];
  if (!theme) return [];

  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme)) {
    if (key !== "modes" && typeof value === "string") vars[key] = value;
  }
  const mode = hass?.themes?.darkMode ? "dark" : "light";
  Object.assign(vars, theme.modes?.[mode] ?? {});

  const applied: string[] = [];
  for (const [key, value] of Object.entries(vars)) {
    const prop = `--${key}`;
    element.style.setProperty(prop, value);
    applied.push(prop);
  }
  return applied;
}
