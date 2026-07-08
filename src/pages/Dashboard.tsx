import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, DoorOpen, DoorClosed, Wallet, Users, FileSignature, ReceiptText, AlertTriangle, TrendingUp, Loader2 } from "lucide-react";
import { KES } from "@/lib/format";
import { generateMonthlyInvoices } from "@/lib/invoice-generator";
import { toast } from "sonner";

interface Stats {
  properties: number;
  units: number;
  vacant: number;
  expected_rent: number;
  monthly_expected_rent: number;
  collected_month: number;
  collected_today: number;
  tenants: number;
  active_leases: number;
  outstanding: number;
  overdue: number;
}

export default function Dashboard() {
  const { user, roles } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingInvoices, setGeneratingInvoices] = useState(false);
  const isTenant = roles.includes("tenant");
  const isCaretaker = roles.includes("caretaker");
  const isAdmin = roles.includes("landlord") || roles.includes("super_admin");

  useEffect(() => {
    document.title = "Dashboard · MUSEMBI PMS";
    setLoading(true);
    const load = async () => {
      setLoading(true);
      if (isTenant) await loadTenantDashboard();
      else await loadStaffDashboard();
      setLoading(false);
    };
    void load();
    
    const ch = supabase
      .channel("dash-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "leases" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "units" }, load)
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTenant, isCaretaker]);

  const handleGenerateInvoices = async () => {
    setGeneratingInvoices(true);
    try {
      const result = await generateMonthlyInvoices();
      if (result.created > 0) {
        toast.success(`Generated ${result.created} invoice${result.created === 1 ? "" : "s"}`);
      } else {
        toast.info("All tenants already have this month's invoice");
      }
      if (result.duplicatesRemoved > 0) {
        toast.success(`Removed ${result.duplicatesRemoved} duplicate invoice${result.duplicatesRemoved === 1 ? "" : "s"}`);
      }
      // Reload stats
      if (isTenant) await loadTenantDashboard();
      else await loadStaffDashboard();
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || "Failed to generate invoices";
      if (errorMsg.includes("function")) {
        toast.error("Function not set up yet. Run SETUP_DATABASE.md steps first.");
      } else {
        toast.error(errorMsg);
      }
      console.error(err);
    } finally {
      setGeneratingInvoices(false);
    }
  };

  const loadTenantDashboard = async () => {
    const [leaseRes, payRes] = await Promise.all([
      supabase
        .from("leases")
        .select("id,start_date,monthly_rent,units(house_number,unit_type,floor_level,properties(name))")
        .eq("status", "active")
        .maybeSingle(),
      supabase.from("payments").select("amount,paid_at").eq("tenant_id", user?.id || ""),
    ]);

    if (leaseRes.data) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const pays = payRes.data ?? [];
      const totalPaid = pays.reduce((s, p) => s + Number(p.amount || 0), 0);
      const collectedMonth = pays
        .filter((p) => new Date(p.paid_at) >= monthStart)
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const collectedToday = pays
        .filter((p) => new Date(p.paid_at) >= todayStart)
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      setStats({
        properties: 0,
        units: 0,
        vacant: 0,
        expected_rent: Number(leaseRes.data.monthly_rent || 0),
        monthly_expected_rent: Number(leaseRes.data.monthly_rent || 0),
        collected_month: collectedMonth,
        collected_today: collectedToday,
        tenants: 0,
        active_leases: 1,
        outstanding: Math.max(0, Number(leaseRes.data.monthly_rent || 0) - totalPaid),
        overdue: 0,
      });
    }
  };

  const loadStaffDashboard = async () => {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      
      // For caretakers, get assigned properties first
      let assignedPropertyIds: string[] = [];
      if (isCaretaker && user) {
        const { data: cpData } = await supabase
          .from("caretaker_properties")
          .select("property_id")
          .eq("user_id", user.id);
        assignedPropertyIds = (cpData ?? []).map((cp) => cp.property_id);
      }

      // If caretaker has no properties, show empty state
      if (isCaretaker && assignedPropertyIds.length === 0) {
        setStats({
          properties: 0,
          units: 0,
          vacant: 0,
          expected_rent: 0,
          monthly_expected_rent: 0,
          collected_month: 0,
          collected_today: 0,
          tenants: 0,
          active_leases: 0,
          outstanding: 0,
          overdue: 0,
        });
        return;
      }

      // For caretakers, get unit IDs from assigned properties
      let assignedUnitIds: string[] = [];
      if (isCaretaker && assignedPropertyIds.length > 0) {
        const { data: unitsData } = await supabase
          .from("units")
          .select("id")
          .in("property_id", assignedPropertyIds);
        assignedUnitIds = (unitsData ?? []).map((u) => u.id);
      }

      // For caretakers, get tenant IDs from leases on assigned units
      let assignedTenantIds: string[] = [];
      if (isCaretaker && assignedUnitIds.length > 0) {
        const { data: leasesData } = await supabase
          .from("leases")
          .select("tenant_id")
          .in("unit_id", assignedUnitIds);
        assignedTenantIds = (leasesData ?? []).map((l) => l.tenant_id);
      }

      // Execute all queries in parallel
      const results = await Promise.allSettled([
        supabase.from("properties").select("*", { count: "exact", head: true }),
        isCaretaker && assignedPropertyIds.length > 0
          ? supabase.from("units").select("status,rent").in("property_id", assignedPropertyIds)
          : supabase.from("units").select("status,rent"),
        isCaretaker && assignedUnitIds.length > 0
          ? supabase.from("leases").select("*", { count: "exact", head: true }).eq("status", "active").in("unit_id", assignedUnitIds)
          : supabase.from("leases").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("tenants").select("*", { count: "exact", head: true }),
        supabase.from("invoices").select("balance,status"),
        isCaretaker && assignedTenantIds.length > 0
          ? supabase.from("payments").select("amount").gte("paid_at", monthStart).in("tenant_id", assignedTenantIds)
          : supabase.from("payments").select("amount").gte("paid_at", monthStart),
        isCaretaker && assignedTenantIds.length > 0
          ? supabase.from("payments").select("amount").gte("paid_at", todayStart).in("tenant_id", assignedTenantIds)
          : supabase.from("payments").select("amount").gte("paid_at", todayStart),
      ]);

      // Extract results safely
      const pCount = results[0].status === "fulfilled" ? results[0].value.count ?? 0 : 0;
      const uRes = results[1].status === "fulfilled" ? results[1].value.data ?? [] : [];
      const lCount = results[2].status === "fulfilled" ? results[2].value.count ?? 0 : 0;
      const tCount = results[3].status === "fulfilled" ? results[3].value.count ?? 0 : 0;
      const invRes = results[4].status === "fulfilled" ? results[4].value.data ?? [] : [];
      const monthPayRes = results[5].status === "fulfilled" ? results[5].value.data ?? [] : [];
      const todayPayRes = results[6].status === "fulfilled" ? results[6].value.data ?? [] : [];

      setStats({
        properties: isCaretaker ? assignedPropertyIds.length : pCount,
        units: uRes.length,
        vacant: uRes.filter((u: any) => u.status === "vacant").length,
        expected_rent: uRes
          .filter((u: any) => u.status === "occupied")
          .reduce((sum: number, u: any) => sum + Number(u.rent || 0), 0),
        monthly_expected_rent: uRes
          .filter((u: any) => u.status === "occupied")
          .reduce((sum: number, u: any) => sum + Number(u.rent || 0), 0),
        collected_month: monthPayRes.reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
        collected_today: todayPayRes.reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
        tenants: tCount,
        active_leases: lCount,
        outstanding: invRes.reduce((s: number, i: any) => s + Number(i.balance || 0), 0),
        overdue: invRes.filter((i: any) => i.status === "overdue").length,
      });
    } catch (err) {
      console.error("Error loading staff dashboard:", err);
      // Set default stats on error
      setStats({
        properties: 0,
        units: 0,
        vacant: 0,
        expected_rent: 0,
        monthly_expected_rent: 0,
        collected_month: 0,
        collected_today: 0,
        tenants: 0,
        active_leases: 0,
        outstanding: 0,
        overdue: 0,
      });
    }
  };

  const staffCards = [
    { label: "Properties", value: stats?.properties ?? "—", icon: Building2 },
    { label: "Total units", value: stats?.units ?? "—", icon: DoorClosed },
    { label: "Vacant units", value: stats?.vacant ?? "—", icon: DoorOpen },
    { label: "Tenants", value: stats?.tenants ?? "—", icon: Users },
    { label: "Active leases", value: stats?.active_leases ?? "—", icon: FileSignature },
    { label: "Expected rent", value: stats ? KES(stats.expected_rent) : "—", icon: Wallet },
    { label: "Collected today", value: stats ? KES(stats.collected_today) : "—", icon: TrendingUp },
    { label: "Collected this month", value: stats ? KES(stats.collected_month) : "—", icon: TrendingUp },
    { label: "Outstanding balance", value: stats ? KES(stats.outstanding) : "—", icon: ReceiptText },
    { label: "Overdue invoices", value: stats?.overdue ?? "—", icon: AlertTriangle },
  ];

  const caretakerCards = [
    { label: "Properties", value: stats?.properties ?? "—", icon: Building2 },
    { label: "Total units", value: stats?.units ?? "—", icon: DoorClosed },
    { label: "Vacant units", value: stats?.vacant ?? "—", icon: DoorOpen },
    { label: "Occupied units", value: stats ? (stats.units - stats.vacant) : "—", icon: Users },
    { label: "Expected rent", value: stats ? KES(stats.expected_rent) : "—", icon: Wallet },
    { label: "Collected this month", value: stats ? KES(stats.collected_month) : "—", icon: TrendingUp },
    { label: "Active leases", value: stats?.active_leases ?? "—", icon: FileSignature },
    { label: "Outstanding", value: stats ? KES(stats.outstanding) : "—", icon: ReceiptText },
  ];

  const tenantCards = [
    { label: "Your rent", value: stats ? KES(stats.expected_rent) : "—", icon: Wallet },
    { label: "Paid this month", value: stats ? KES(stats.collected_month) : "—", icon: TrendingUp },
    { label: "Outstanding", value: stats ? KES(stats.outstanding) : "—", icon: ReceiptText },
  ];

  const cards = isTenant ? tenantCards : isCaretaker ? caretakerCards : staffCards;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome{user?.email ? `, ${user.email}` : ""} — role{roles.length > 1 ? "s" : ""}:{" "}
            <span className="font-medium text-foreground">{roles.join(", ") || "unassigned"}</span>
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={handleGenerateInvoices}
            disabled={generatingInvoices}
            size="sm"
            variant="outline"
          >
            {generatingInvoices && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Invoices
          </Button>
        )}
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
                  {loading ? <span className="animate-pulse">—</span> : value}
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
