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
  monthly_expected_rent: number;
  tenants: number;
  active_leases: number;
  outstanding: number;
  overdue: number;
}

export default function Dashboard() {
  const { user, roles } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const isTenant = roles.includes("tenant");
  const isCaretaker = roles.includes("caretaker");

  useEffect(() => {
    document.title = "Dashboard · MUSEMBI PMS";
    if (isTenant) {
      loadTenantDashboard();
    } else {
      loadStaffDashboard();
    }
  }, [isTenant, isCaretaker]);

  const loadTenantDashboard = async () => {
    // For tenants, show their lease, unit, and payment info
    const [leaseRes, payRes] = await Promise.all([
      supabase
        .from("leases")
        .select("id,start_date,monthly_rent,units(house_number,unit_type,floor_level,properties(name))")
        .eq("status", "active")
        .maybeSingle(),
      supabase.from("payments").select("amount").eq("tenant_id", user?.id || ""),
    ]);

    if (leaseRes.data) {
      const totalPaid = (payRes.data ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
      setStats({
        properties: 0,
        units: 0,
        vacant: 0,
        expected_rent: Number(leaseRes.data.monthly_rent || 0),
        tenants: 0,
        active_leases: 1,
        outstanding: 0,
        overdue: 0,
      });
    }
  };

  const loadStaffDashboard = async () => {
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
      
      // Current month expected rent
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      setStats({
        properties: pCount.count ?? 0,
        units: uList.length,
        vacant: uList.filter((u) => u.status === "vacant").length,
        expected_rent: uList
          .filter((u) => u.status === "occupied")
          .reduce((sum, u) => sum + Number(u.rent || 0), 0),
        monthly_expected_rent: uList
          .filter((u) => u.status === "occupied")
          .reduce((sum, u) => sum + Number(u.rent || 0), 0),
        tenants: tCount.count ?? 0,
        active_leases: lCount.count ?? 0,
        outstanding: inv.reduce((s, i) => s + Number(i.balance || 0), 0),
        overdue: inv.filter((i) => i.status === "overdue").length,
      });
    })();
    return () => { cancelled = true; };
  };

  const staffCards = [
    { label: "Properties", value: stats?.properties ?? "—", icon: Building2 },
    { label: "Total units", value: stats?.units ?? "—", icon: DoorClosed },
    { label: "Vacant units", value: stats?.vacant ?? "—", icon: DoorOpen },
    { label: "Tenants", value: stats?.tenants ?? "—", icon: Users },
    { label: "Active leases", value: stats?.active_leases ?? "—", icon: FileSignature },
    { label: "Expected rent", value: stats ? KES(stats.expected_rent) : "—", icon: Wallet },
    { label: "This month", value: stats ? KES(stats.monthly_expected_rent) : "—", icon: ReceiptText },
    { label: "Outstanding balance", value: stats ? KES(stats.outstanding) : "—", icon: ReceiptText },
    { label: "Overdue invoices", value: stats?.overdue ?? "—", icon: AlertTriangle },
  ];

  const caretakerCards = [
    { label: "Properties", value: stats?.properties ?? "—", icon: Building2 },
    { label: "Total units", value: stats?.units ?? "—", icon: DoorClosed },
    { label: "Occupied units", value: stats ? (stats.units - stats.vacant) : "—", icon: Users },
    { label: "Expected rent", value: stats ? KES(stats.expected_rent) : "—", icon: Wallet },
    { label: "This month", value: stats ? KES(stats.monthly_expected_rent) : "—", icon: ReceiptText },
  ];

  const tenantCards = [
    { label: "Your rent", value: stats ? KES(stats.expected_rent) : "—", icon: Wallet },
    { label: "Active leases", value: stats?.active_leases ?? "—", icon: FileSignature },
    { label: "Total paid", value: "—", icon: ReceiptText },
  ];

  const cards = isTenant ? tenantCards : isCaretaker ? caretakerCards : staffCards;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome{user?.email ? `, ${user.email}` : ""} — role{roles.length > 1 ? "s" : ""}:{" "}
          <span className="font-medium text-foreground">{roles.join(", ") || "unassigned"}</span>
        </p>
      </header>

      <div
        className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4"
        style={{ perspective: "1200px" }}
      >
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="group [transform-style:preserve-3d]">
            <Card className="card-3d relative overflow-hidden border-0 p-0 transition-all duration-500 ease-out will-change-transform hover:-translate-y-1.5 hover:[transform:rotateX(6deg)_rotateY(-6deg)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/25" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/60 via-white/0 to-black/5 opacity-70 mix-blend-overlay dark:from-white/10 dark:to-black/40" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 p-4 pb-2 md:p-5 md:pb-2">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:text-xs">
                  {label}
                </CardTitle>
                <span className="icon-3d relative flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground md:h-10 md:w-10">
                  <Icon className="h-4 w-4 md:h-[18px] md:w-[18px]" />
                </span>
              </CardHeader>
              <CardContent className="relative p-4 pt-1 md:p-5 md:pt-1">
                <div className="text-xl font-extrabold tracking-tight text-foreground md:text-2xl">
                  {value}
                </div>
              </CardContent>
              <div className="pointer-events-none absolute inset-x-3 -bottom-3 h-4 rounded-full bg-black/25 blur-lg dark:bg-black/60" />
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
