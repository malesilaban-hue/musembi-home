import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Row {
  user_id: string;
  role: string;
}

export default function Team() {
  const { hasRole } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    document.title = "Team · MUSEMBI PMS";
    if (!hasRole(["super_admin", "landlord"])) return;
    (async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role");
      if (error) toast.error(error.message);
      setRows(data ?? []);
    })();
  }, [hasRole]);

  if (!hasRole(["super_admin", "landlord"])) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          You don&apos;t have access to team management.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Team &amp; Roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          User invitations and role assignment come in Phase 2. Below is the current role register
          visible to your account under Row-Level Security.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> Role assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No role assignments visible.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {rows.map((r) => (
                <li key={`${r.user_id}-${r.role}`} className="flex items-center justify-between py-2">
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {r.user_id}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {r.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
