import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck, UserCog, Building2, X } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
}
interface RoleRow {
  user_id: string;
  role: AppRole;
}
interface Property {
  id: string;
  name: string;
}
interface Assignment {
  user_id: string;
  property_id: string;
}

const ROLE_OPTIONS: AppRole[] = [
  "super_admin",
  "landlord",
  "caretaker",
  "accountant",
  "technician",
  "security",
  "tenant",
];

export default function Team() {
  const { hasRole } = useAuth();
  const canManage = hasRole(["super_admin", "landlord"]);
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    try {
      const [p, r, pr, a] = await Promise.all([
        supabase.from("profiles").select("id,full_name,phone"),
        supabase.from("user_roles").select("user_id,role"),
        supabase.from("properties").select("id,name").order("name"),
        supabase.from("caretaker_properties").select("user_id,property_id"),
      ]);
      
      if (p.error) {
        console.error("Profiles error:", p.error);
        toast.error("Failed to load profiles: " + p.error.message);
      }
      if (r.error) {
        console.error("Roles error:", r.error);
        toast.error("Failed to load roles: " + r.error.message);
      }
      if (pr.error) {
        console.error("Properties error:", pr.error);
        toast.error("Failed to load properties: " + pr.error.message);
      }
      if (a.error) {
        console.error("Assignments error:", a.error);
        toast.error("Failed to load assignments: " + a.error.message);
      }
      
      console.log("Profiles data:", p.data);
      setProfiles(p.data ?? []);
      setRoles((r.data ?? []) as RoleRow[]);
      setProperties(pr.data ?? []);
      setAssignments(a.data ?? []);
    } catch (err) {
      console.error("Reload error:", err);
      toast.error("Error loading team data");
    }
  };

  useEffect(() => {
    document.title = "Team · MUSEMBI PMS";
    console.log("Team page loaded, canManage:", canManage);
    // Always try to load, we'll show permission message if not authorized
    void reload();
  }, []);

  const rolesByUser = useMemo(() => {
    const m = new Map<string, AppRole[]>();
    roles.forEach((r) => m.set(r.user_id, [...(m.get(r.user_id) ?? []), r.role]));
    return m;
  }, [roles]);

  const assignsByUser = useMemo(() => {
    const m = new Map<string, string[]>();
    assignments.forEach((a) =>
      m.set(a.user_id, [...(m.get(a.user_id) ?? []), a.property_id]),
    );
    return m;
  }, [assignments]);

  const filtered = (profiles ?? []).filter((p) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (p.full_name ?? "").toLowerCase().includes(s) ||
      (p.phone ?? "").toLowerCase().includes(s) ||
      p.id.toLowerCase().includes(s)
    );
  });

  const setUserRole = async (userId: string, role: AppRole) => {
    setBusyId(userId);
    // Replace all roles with the single chosen role (simple model)
    const { error: delErr } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
    if (delErr) {
      toast.error(delErr.message);
      setBusyId(null);
      return;
    }
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role } as never);
    if (error) toast.error(error.message);
    else toast.success(`Role set to ${role}`);
    await reload();
    setBusyId(null);
  };

  const toggleAssignment = async (userId: string, propertyId: string, on: boolean) => {
    if (on) {
      const { error } = await supabase
        .from("caretaker_properties")
        .insert({ user_id: userId, property_id: propertyId } as never);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("caretaker_properties")
        .delete()
        .eq("user_id", userId)
        .eq("property_id", propertyId);
      if (error) return toast.error(error.message);
    }
    await reload();
  };

  if (!canManage) {
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
          Manage user roles and assign caretakers to specific properties.
        </p>
      </header>

      <Input
        placeholder="Search by name or phone…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-md"
      />

      {profiles === null ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No users yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const userRoles = rolesByUser.get(p.id) ?? [];
            const primary = userRoles[0] ?? "tenant";
            const isCaretaker = userRoles.includes("caretaker");
            const assigned = new Set(assignsByUser.get(p.id) ?? []);
            return (
              <Card key={p.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
                    <span className="flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-primary" />
                      {p.full_name || <span className="text-muted-foreground">(no name)</span>}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {p.phone ?? ""}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {userRoles.map((r) => (
                        <span
                          key={r}
                          className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary"
                        >
                          {r}
                        </span>
                      ))}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[180px] flex-1">
                      <Label className="text-xs">Assign role</Label>
                      <Select
                        value={primary}
                        onValueChange={(v) => setUserRole(p.id, v as AppRole)}
                        disabled={busyId === p.id}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Role changes take effect on the user&apos;s next request.
                    </div>
                  </div>

                  {isCaretaker && (
                    <div>
                      <Label className="text-xs flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" /> Assigned properties
                      </Label>
                      {properties.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No properties available.</p>
                      ) : (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {properties.map((pr) => {
                            const on = assigned.has(pr.id);
                            return (
                              <label
                                key={pr.id}
                                className="flex items-center gap-2 rounded-md border border-border p-2 text-sm"
                              >
                                <Checkbox
                                  checked={on}
                                  onCheckedChange={(v) =>
                                    void toggleAssignment(p.id, pr.id, !!v)
                                  }
                                />
                                <span className="truncate">{pr.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 py-4 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
          <p>
            To invite a new user, share the sign-up link. New sign-ups appear here automatically.
            Then assign their role and (for caretakers) which properties they manage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
