import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, DoorOpen, DoorClosed, Wallet } from "lucide-react";

interface Stats {
  properties: number;
  units: number;
  vacant: number;
  expected_rent: number;
}

export default function Dashboard() {
  const { user, roles } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    document.title = "Dashboard · MUSEMBI PMS";
    let cancelled = false;
    (async () => {
      const [{ count: pCount }, { data: units }] = await Promise.all([
        supabase.from("properties").select("*", { count: "exact", head: true }),
        supabase.from("units").select("status,rent"),
      ]);
      if (cancelled) return;
      const uList = units ?? [];
      setStats({
        properties: pCount ?? 0,
        units: uList.length,
        vacant: uList.filter((u) => u.status === "vacant").length,
        expected_rent: uList
          .filter((u) => u.status === "occupied")
          .reduce((sum, u) => sum + Number(u.rent || 0), 0),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { label: "Properties", value: stats?.properties ?? "—", icon: Building2 },
    { label: "Total units", value: stats?.units ?? "—", icon: DoorClosed },
    { label: "Vacant units", value: stats?.vacant ?? "—", icon: DoorOpen },
    {
      label: "Expected monthly rent",
      value:
        stats === null
          ? "—"
          : `KES ${stats.expected_rent.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`,
      icon: Wallet,
    },
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Getting started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Phase 1 is live: authentication, roles, properties, blocks and units.</p>
          <p>
            Upcoming phases will add tenants &amp; leases, M-Pesa STK Push billing, receipts,
            maintenance workflow, visitor management and full reporting.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
