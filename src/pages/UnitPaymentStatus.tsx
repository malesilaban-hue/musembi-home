import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Building2, House, UserRound, CircleDollarSign, ReceiptText } from "lucide-react";
import { fmtDateTime, KES } from "@/lib/format";
import { toast } from "sonner";

interface PropertyOption {
  id: string;
  name: string;
}

interface UnitRecord {
  id: string;
  house_number: string;
  property_id: string | null;
  status: string | null;
  rent: number | null;
  properties: { name: string } | null;
}

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  paid_at: string;
  tenant_id: string | null;
  unit_id: string | null;
}

interface UnitSummary {
  id: string;
  house_number: string;
  property_id: string | null;
  property_name: string | null;
  status: string | null;
  rent: number | null;
  tenant_name: string | null;
  payment: PaymentRecord | null;
}

const modeMeta = {
  paid: {
    title: "Paid units",
    description: "Units with recorded payments, grouped by property.",
    accent: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
    badge: "bg-emerald-600 text-white",
    emptyTitle: "No paid units yet",
    emptyText: "Payments will appear here once a unit has a recorded payment.",
  },
  unpaid: {
    title: "Unpaid units",
    description: "Units that still do not have a recorded payment.",
    accent: "border-amber-200 bg-amber-50/80 text-amber-700",
    badge: "bg-amber-600 text-white",
    emptyTitle: "All units are paid",
    emptyText: "Every unit in the current scope has a recorded payment.",
  },
} as const;

export default function UnitPaymentStatus({ mode }: { mode: "paid" | "unpaid" }) {
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [units, setUnits] = useState<UnitSummary[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = `${modeMeta[mode].title} · MUSEMBI PMS`;

    const load = async () => {
      try {
        setLoading(true);

        const [propertiesRes, unitsRes, paymentsRes] = await Promise.all([
          supabase.from("properties").select("id,name").order("name"),
          supabase.from("units").select("id,house_number,property_id,status,rent,properties(name)").order("house_number"),
          supabase
            .from("payments")
            .select("id,amount,method,paid_at,tenant_id,unit_id")
            .not("unit_id", "is", null)
            .order("paid_at", { ascending: false }),
        ]);

        if (propertiesRes.error) throw propertiesRes.error;
        if (unitsRes.error) throw unitsRes.error;
        if (paymentsRes.error) throw paymentsRes.error;

        const propertyData = (propertiesRes.data ?? []) as PropertyOption[];
        const unitData = (unitsRes.data ?? []) as UnitRecord[];
        const paymentsData = (paymentsRes.data ?? []) as PaymentRecord[];

        const latestPaymentByUnit = new Map<string, PaymentRecord>();
        paymentsData.forEach((payment) => {
          if (payment.unit_id && !latestPaymentByUnit.has(payment.unit_id)) {
            latestPaymentByUnit.set(payment.unit_id, payment);
          }
        });

        const tenantIds = Array.from(
          new Set(
            paymentsData
              .map((payment) => payment.tenant_id)
              .filter((tenantId): tenantId is string => Boolean(tenantId)),
          ),
        );

        const tenantsRes = tenantIds.length
          ? await supabase.from("tenants").select("id,full_name").in("id", tenantIds)
          : { data: [] as Array<{ id: string; full_name: string }> };

        const tenantMap = new Map((tenantsRes.data ?? []).map((tenant) => [tenant.id, tenant.full_name]));

        const leaseRes = await supabase
          .from("leases")
          .select("unit_id,tenant_id,tenants(full_name)")
          .order("start_date", { ascending: false });

        if (leaseRes.error) throw leaseRes.error;

        const tenantByUnit = new Map<string, string | null>();
        (leaseRes.data ?? []).forEach((lease: any) => {
          if (lease.unit_id && !tenantByUnit.has(lease.unit_id)) {
            tenantByUnit.set(lease.unit_id, lease.tenants?.full_name ?? null);
          }
        });

        const summaries = unitData
          .map((unit) => {
            const payment = unit.id ? latestPaymentByUnit.get(unit.id) ?? null : null;
            const tenantName = payment?.tenant_id
              ? tenantMap.get(payment.tenant_id) ?? tenantByUnit.get(unit.id) ?? null
              : tenantByUnit.get(unit.id) ?? null;

            return {
              id: unit.id,
              house_number: unit.house_number,
              property_id: unit.property_id,
              property_name: unit.properties?.name ?? null,
              status: unit.status,
              rent: unit.rent,
              tenant_name: tenantName,
              payment,
            } satisfies UnitSummary;
          })
          .filter((unit) => (mode === "paid" ? Boolean(unit.payment) : !unit.payment));

        setProperties(propertyData);
        setUnits(summaries);
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Failed to load units");
        setUnits([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [mode]);

  const grouped = useMemo(() => {
    const groups = properties
      .map((property) => ({
        property,
        units: units.filter((unit) => unit.property_id === property.id),
      }))
      .filter((group) => group.units.length > 0);

    if (selectedProperty === "all") return groups;
    return groups.filter((group) => group.property.id === selectedProperty);
  }, [properties, selectedProperty, units]);

  const meta = modeMeta[mode];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{meta.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={meta.badge}>{mode === "paid" ? "Paid" : "Unpaid"}</Badge>
          <div className="w-52">
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All properties</SelectItem>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : grouped.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-semibold">{meta.emptyTitle}</p>
              <p className="text-sm text-muted-foreground">{meta.emptyText}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ property, units: propertyUnits }) => (
            <Card key={property.id} className={`border ${meta.accent}`}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{property.name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {propertyUnits.length} {propertyUnits.length === 1 ? "unit" : "units"}
                    </p>
                  </div>
                  <Badge className={meta.badge}>{mode === "paid" ? "Paid" : "Unpaid"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {propertyUnits.map((unit) => (
                  <div key={unit.id} className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/80 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <House className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">Unit {unit.house_number}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {unit.tenant_name ? (
                          <span className="flex items-center gap-1">
                            <UserRound className="h-3.5 w-3.5" />
                            {unit.tenant_name}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <UserRound className="h-3.5 w-3.5" />
                            No tenant linked
                          </span>
                        )}
                        {unit.rent ? <span>· Rent {KES(unit.rent)}</span> : null}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      {mode === "paid" && unit.payment ? (
                        <>
                          <div className="flex items-center gap-1 font-semibold text-emerald-700">
                            <CircleDollarSign className="h-4 w-4" />
                            {KES(unit.payment.amount)}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <ReceiptText className="h-3.5 w-3.5" />
                            {unit.payment.method.replace(/_/g, " ")}
                          </div>
                          <div className="text-xs text-muted-foreground">{fmtDateTime(unit.payment.paid_at)}</div>
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">No payment recorded</div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
