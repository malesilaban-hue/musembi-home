import { useEffect } from "react";

/**
 * Apply a per-property color theme by setting data-theme on <html>.
 * CSS in styles.css handles the actual variable overrides.
 */
export function usePropertyTheme(theme: string | null | undefined) {
  useEffect(() => {
    const t = theme && theme !== "default" ? theme : null;
    const root = document.documentElement;
    const prev = root.getAttribute("data-property-theme");
    if (t) root.setAttribute("data-property-theme", t);
    else root.removeAttribute("data-property-theme");
    return () => {
      if (prev) root.setAttribute("data-property-theme", prev);
      else root.removeAttribute("data-property-theme");
    };
  }, [theme]);
}
