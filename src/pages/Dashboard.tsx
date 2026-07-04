import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, DoorOpen, DoorClosed, Wallet, Users, FileSignature, ReceiptText, AlertTriangle } from "lucide-react";
import { KES } from "@/lib/format";

interface Stats {
  properties: number;
  units: number;
  vacant: number;
  expected_rent: number;
  tenants: number;
  active_leases: number;
  outstanding: number;
  overdue: number;
}

export default function Dashboard() {
  const { user, roles } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    document.title = "Dashboard · MUSEMBI PMS";
    let cancelled = false;
    (async () => {
      const [pCount, uRes, tCount, lCount, invRes] = await Promise.all([
        supabase.from("properties").select("*", { count: "exact", head: true }),
        supabase.from("units").select("status,rent"),
        supabase.from("tenants").select("*", { count: "exact", head: true }),
        supabase.from("leases").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("invoices").select("balance,status"),
      ]);
      if (cancelled) return;
      const uList = uRes.data ?? [];
      const inv = invRes.data ?? [];
      setStats({
        properties: pCount.count ?? 0,
        units: uList.length,
        vacant: uList.filter((u) => u.status === "vacant").length,
        expected_rent: uList
          .filter((u) => u.status === "occupied")
          .reduce((sum, u) => sum + Number(u.rent || 0), 0),
        tenants: tCount.count ?? 0,
        active_leases: lCount.count ?? 0,
        outstanding: inv.reduce((s, i) => s + Number(i.balance || 0), 0),
        overdue: inv.filter((i) => i.status === "overdue").length,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  const cards = [
    { label: "Properties", value: stats?.properties ?? "—", icon: Building2 },
    { label: "Total units", value: stats?.units ?? "—", icon: DoorClosed },
    { label: "Vacant units", value: stats?.vacant ?? "—", icon: DoorOpen },
    { label: "Tenants", value: stats?.tenants ?? "—", icon: Users },
    { label: "Active leases", value: stats?.active_leases ?? "—", icon: FileSignature },
    { label: "Expected rent", value: stats ? KES(stats.expected_rent) : "—", icon: Wallet },
    { label: "Outstanding balance", value: stats ? KES(stats.outstanding) : "—", icon: ReceiptText },
    { label: "Overdue invoices", value: stats?.overdue ?? "—", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome{user?.email ? `, ${user.email}` : ""} — role{roles.length > 1 ? "s" : ""}:{" "}
          <span className="font-medium text-foreground">{roles.join(", ") || "unassigned"}</span>
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold md:text-2xl">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
