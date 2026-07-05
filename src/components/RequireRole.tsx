import { Navigate } from "react-router-dom";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function RequireRole({ roles, children }: { roles: AppRole[]; children: ReactNode }) {
  const { hasRole, loading, user } = useAuth();
  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!hasRole(roles)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
