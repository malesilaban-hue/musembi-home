import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "super_admin"
  | "landlord"
  | "caretaker"
  | "accountant"
  | "technician"
  | "security"
  | "tenant";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (r: AppRole | AppRole[]) => boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);

      if (error) {
        console.warn("Error loading roles:", error.message);
        setRoles([]);
        return;
      }

      const roleList = (data ?? [])
        .map((row) => row.role)
        .filter((role): role is AppRole => Boolean(role));
      setRoles([...new Set(roleList)]);
    } catch (err: any) {
      console.warn("Exception loading roles:", err?.message);
      setRoles([]);
    }
  };

  useEffect(() => {
    setLoading(true);
    
    // Register listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      
      // Load roles in background (don't block UI)
      if (s?.user) {
        loadRoles(s.user.id).catch(err => console.error("Error loading roles:", err));
      } else {
        setRoles([]);
      }
    });
    
    // Fetch existing session and mark loading done IMMEDIATELY
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false); // Mark done immediately - don't wait for roles
      
      // Load roles in background after UI is responsive
      if (s?.user) {
        loadRoles(s.user.id).catch(err => console.error("Error loading roles:", err));
      }
    });
    
    return () => sub.subscription.unsubscribe();
  }, []);

  const hasRole = (r: AppRole | AppRole[]) => {
    const list = Array.isArray(r) ? r : [r];
    return list.some((x) => roles.includes(x));
  };

  const signOut = async () => {
    console.log("Starting sign out...");
    // Clear state immediately for faster UI update
    setUser(null);
    setSession(null);
    setRoles([]);
    
    try {
      // Try to sign out from Supabase, but don't wait too long
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("timeout")), 2000)
      );
      
      await Promise.race([supabase.auth.signOut(), timeoutPromise]);
      console.log("Sign out completed successfully");
    } catch (err: any) {
      // Log the error but don't throw - UI is already cleared
      console.warn("Sign out API call failed (UI already cleared):", err?.message);
    }
  };

  const refreshRoles = async () => {
    if (user) await loadRoles(user.id);
  };

  return (
    <Ctx.Provider value={{ user, session, roles, loading, hasRole, signOut, refreshRoles }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
