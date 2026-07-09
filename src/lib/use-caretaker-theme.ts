import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/**
 * For caretakers: apply the theme of their assigned property automatically.
 * - If assigned to ONE property (or many all sharing the same theme), that theme is applied.
 * - If assigned to properties with different themes, no theme is forced — the user can pick via the theme switcher.
 */
export function useCaretakerTheme() {
  const { user, roles } = useAuth();
  const isCaretaker = roles.includes("caretaker");

  useEffect(() => {
    if (!isCaretaker || !user) return;
    let cancelled = false;

    const apply = async () => {
      const { data: cp } = await supabase
        .from("caretaker_properties")
        .select("property_id")
        .eq("user_id", user.id);
      const ids = (cp ?? []).map((c: any) => c.property_id);
      if (!ids.length) return;
      const { data: props } = await supabase
        .from("properties")
        .select("theme")
        .in("id", ids);
      const themes = Array.from(
        new Set((props ?? []).map((p: any) => p.theme).filter((t: string) => t && t !== "default")),
      );
      const root = document.documentElement;
      if (cancelled) return;
      if (themes.length === 1) {
        root.setAttribute("data-property-theme", themes[0]);
      } else {
        root.removeAttribute("data-property-theme");
      }
    };

    void apply();
    return () => {
      cancelled = true;
      document.documentElement.removeAttribute("data-property-theme");
    };
  }, [isCaretaker, user?.id]);
}
