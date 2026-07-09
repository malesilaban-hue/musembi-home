import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Wallet, Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime, KES } from "@/lib/format";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface Row {
  id: string;
  receipt_number: string;
  amount: number;
  method: string;
  reference: string | null;
  reason: string | null;
  paid_at: string;
  tenant_id: string;
  lease_id: string | null;
  tenants: { id: string; full_name: string } | null;
  unit_label: string | null;
  property_name: string | null;
}

interface Tenant {
  id: string;
  full_name: string;
}

interface Unit {
  id: string;
  house_number: string;
  properties: { name: string } | null;
}

const paymentSchema = z.object({
  tenant_id: z.string().min(1, "Tenant or unit required"),
  amount: z.string().min(1, "Amount required").transform(Number).pipe(z.number().positive("Amount must be positive")),
  reference: z.string().trim().max(100).optional().or(z.literal("")),
  method: z.enum(["cash", "mpesa", "bank_transfer", "cheque"]),
  paid_at: z.string().min(1, "Date required"),
  reason: z.string().trim().max(255).optional().or(z.literal("")),
}).refine((data) => data.tenant_id, {
  message: "Please select a tenant or search by unit number",
  path: ["tenant_id"],
});
type PaymentFormValues = z.infer<typeof paymentSchema>;

export default function Payments() {
  const { hasRole, user } = useAuth();
  const canRecord = hasRole(["super_admin", "landlord", "accountant", "caretaker"]);
  const isCaretaker = hasRole(["caretaker"]);
  const [items, setItems] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const reload = async () => {
    try {
      let paymentsQuery = supabase
        .from("payments")
        .select("id,receipt_number,amount,method,reference,reason,paid_at,tenant_id,lease_id");

      // For caretakers, filter by assigned properties
      if (isCaretaker && user) {
        // Get assigned properties
        const { data: caretakerProps } = await supabase
          .from("caretaker_properties")
          .select("property_id")
          .eq("user_id", user.id);
        
        const propertyIds = (caretakerProps ?? []).map(cp => cp.property_id);
        
        if (propertyIds.length === 0) {
          // Caretaker has no assigned properties
          setItems([]);
          return;
        }

        // Get unit IDs for those properties
        const { data: units } = await supabase
          .from("units")
          .select("id")
          .in("property_id", propertyIds);
        
        const unitIds = (units ?? []).map(u => u.id);
        
        if (unitIds.length === 0) {
          setItems([]);
          return;
        }

        // Get tenant IDs from leases on those units
        const { data: leases } = await supabase
          .from("leases")
          .select("tenant_id")
          .in("unit_id", unitIds);
        
        const tenantIds = (leases ?? []).map(l => l.tenant_id);
        
        if (tenantIds.length > 0) {
          paymentsQuery = paymentsQuery.in("tenant_id", tenantIds);
        } else {
          setItems([]);
          return;
        }
      }

      const { data: paymentsData, error: paymentsError } = await paymentsQuery.order("paid_at", { ascending: false });

      if (paymentsError) return toast.error(paymentsError.message);

      if (!paymentsData || paymentsData.length === 0) {
        setItems([]);
        return;
      }

      const tenantIds = [...new Set(paymentsData.map((p) => p.tenant_id))];
      const leaseIds = [...new Set(paymentsData.map((p) => p.lease_id).filter(Boolean) as string[])];

      const [tenantsRes, leasesRes] = await Promise.all([
        supabase.from("tenants").select("id,full_name").in("id", tenantIds),
        leaseIds.length
          ? supabase
              .from("leases")
              .select("id,units(house_number,properties(name))")
              .in("id", leaseIds)
          : Promise.resolve({ data: [] as unknown[] }),
      ]);

      const tenantMap = new Map((tenantsRes.data ?? []).map((t) => [t.id, t]));
      const leaseMap = new Map(
        ((leasesRes.data ?? []) as Array<{
          id: string;
          units: { house_number: string; properties: { name: string } | null } | null;
        }>).map((l) => [l.id, l]),
      );

      const formatted: Row[] = paymentsData.map((p) => {
        const lease = p.lease_id ? leaseMap.get(p.lease_id) : null;
        return {
          id: p.id,
          receipt_number: p.receipt_number,
          amount: Number(p.amount),
          method: p.method,
          reference: p.reference,
          reason: p.reason,
          paid_at: p.paid_at,
          tenant_id: p.tenant_id,
          lease_id: p.lease_id,
          tenants: tenantMap.get(p.tenant_id) ?? null,
          unit_label: lease?.units?.house_number ?? null,
          property_name: lease?.units?.properties?.name ?? null,
        };
      });

      setItems(formatted);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load payments");
    }
  };

  useEffect(() => {
    document.title = "Payments · MUSEMBI PMS";
    void reload();
    const ch = supabase
      .channel("payments-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => void reload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  const filtered = (items ?? []).filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.receipt_number.toLowerCase().includes(s) ||
      (r.tenants?.full_name ?? "").toLowerCase().includes(s) ||
      (r.reference ?? "").toLowerCase().includes(s)
    );
  });

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">All receipted payments across tenants.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total shown</div>
            <div className="text-lg font-bold text-primary">{KES(total)}</div>
          </div>
          {canRecord && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" /> Record payment
                </Button>
              </DialogTrigger>
              <RecordPaymentDialog
                onCreated={() => {
                  setOpen(false);
                  void reload();
                }}
              />
            </Dialog>
          )}
        </div>
      </header>

      <Input placeholder="Search receipt / tenant / reference…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />

      {items === null ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No payments</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {filtered.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{r.receipt_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.tenants?.full_name ?? "—"}
                      {r.unit_label && <> · Unit {r.unit_label}</>}
                      {r.property_name && <> · {r.property_name}</>}
                    </div>
                    <div className="text-xs text-muted-foreground">{fmtDateTime(r.paid_at)}</div>
                    {r.reference && <div className="text-xs text-muted-foreground">Ref: {r.reference}</div>}
                    {r.reason && <div className="text-xs text-muted-foreground italic">Note: {r.reason}</div>}
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <Badge variant="secondary">{r.method}</Badge>
                    <div className="text-right font-semibold">{KES(r.amount)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RecordPaymentDialog({ onCreated }: { onCreated: () => void }) {
  const { user, hasRole } = useAuth();
  const isCaretaker = hasRole(["caretaker"]);
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenantSearch, setTenantSearch] = useState("");
  const [unitSearch, setUnitSearch] = useState("");
  const [showTenantList, setShowTenantList] = useState(false);
  const [showUnitList, setShowUnitList] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof paymentSchema>, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
  });

  const selectedTenantId = watch("tenant_id");

  useEffect(() => {
    const loadData = async () => {
      try {
        // For caretakers, filter tenants by assigned properties
        if (isCaretaker && user) {
          const { data: caretakerProps } = await supabase
            .from("caretaker_properties")
            .select("property_id")
            .eq("user_id", user.id);
          
          const propertyIds = (caretakerProps ?? []).map(cp => cp.property_id);
          
          if (propertyIds.length > 0) {
            // Get units for assigned properties
            const { data: unitData } = await supabase
              .from("units")
              .select("id")
              .in("property_id", propertyIds);
            
            const unitIds = (unitData ?? []).map(u => u.id);
            
            if (unitIds.length > 0) {
              // Get leases for those units
              const { data: leaseData } = await supabase
                .from("leases")
                .select("tenant_id,tenants(id,full_name)")
                .in("unit_id", unitIds);
              
              const caretakerTenants = (leaseData ?? [])
                .filter((l) => l.tenants)
                .map((l) => l.tenants!);
              
              // Remove duplicates
              const uniqueTenants = Array.from(
                new Map(caretakerTenants.map((t) => [t.id, t])).values()
              );
              
              setTenants(uniqueTenants.sort((a, b) => a.full_name.localeCompare(b.full_name)));
            } else {
              setTenants([]);
            }
          } else {
            setTenants([]);
          }
        } else {
          // For non-caretakers, show all tenants
          const { data: allTenants } = await supabase
            .from("tenants")
            .select("id,full_name")
            .order("full_name");
          setTenants(allTenants ?? []);
        }
      } catch (err) {
        console.error("Error loading tenants:", err);
        setTenants([]);
      }

      try {
        // Load units for caretaker or all units
        let unitsQuery = supabase
          .from("units")
          .select("id,house_number,properties(name)")
          .in("status", ["occupied", "vacant"])
          .order("house_number");

        if (isCaretaker && user) {
          const { data: caretakerProps } = await supabase
            .from("caretaker_properties")
            .select("property_id")
            .eq("user_id", user.id);
          
          const propertyIds = (caretakerProps ?? []).map(cp => cp.property_id);
          
          if (propertyIds.length > 0) {
            unitsQuery = unitsQuery.in("property_id", propertyIds);
          }
        }

        const { data: unitsData, error: unitsError } = await unitsQuery;
        if (!unitsError) setUnits(unitsData ?? []);
      } catch (err) {
        console.error("Error loading units:", err);
        setUnits([]);
      }
    };
    void loadData();
  }, [isCaretaker, user]);

  const filteredTenants = (tenants ?? []).filter((t) =>
    t.full_name.toLowerCase().includes(tenantSearch.toLowerCase())
  );

  const filteredUnits = units.filter((u) =>
    u.house_number.toLowerCase().includes(unitSearch.toLowerCase())
  );

  const onSubmit = async (values: PaymentFormValues) => {
    try {
      // Generate receipt number
      const now = new Date();
      const receipt = `RCP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Date.now().toString().slice(-6)}`;

      // Get the active lease for this tenant to link the payment
      const { data: leaseData } = await supabase
        .from("leases")
        .select("id")
        .eq("tenant_id", values.tenant_id)
        .eq("status", "active")
        .maybeSingle();

      const payload: Record<string, unknown> = {
        receipt_number: receipt,
        tenant_id: values.tenant_id,
        amount: values.amount,
        method: values.method,
        reference: values.reference || null,
        reason: values.reason || null,
        paid_at: values.paid_at,
        lease_id: leaseData?.id || null,
      };

      const { error } = await supabase.from("payments").insert(payload as never);
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Payment recorded successfully");
      reset();
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const handleTenantSelect = (tenantId: string, tenantName: string) => {
    setValue("tenant_id", tenantId);
    setTenantSearch(tenantName);
    setShowTenantList(false);
  };

  const handleUnitSelect = async (unitId: string, unitName: string) => {
    // Get the tenant associated with this unit (via active lease)
    const { data: leaseData } = await supabase
      .from("leases")
      .select("tenant_id,tenants(full_name)")
      .eq("unit_id", unitId)
      .eq("status", "active")
      .maybeSingle();

    if (leaseData?.tenant_id) {
      handleTenantSelect(leaseData.tenant_id, leaseData.tenants?.full_name || unitName);
    }
    setUnitSearch(unitName);
    setShowUnitList(false);
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Record a manual payment from a tenant. A receipt number will be generated automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tenant (search by name or unit number)</Label>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {/* Tenant Search */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="tenant" className="text-xs text-muted-foreground">
                  Search tenant name
                </Label>
                <Input
                  id="tenant"
                  placeholder="Type tenant name…"
                  value={tenantSearch}
                  onChange={(e) => {
                    setTenantSearch(e.target.value);
                    setShowTenantList(true);
                  }}
                  onFocus={() => setShowTenantList(true)}
                />
                {showTenantList && tenantSearch && filteredTenants.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 space-y-1 rounded-md border border-input bg-popover p-2 shadow-md">
                    {filteredTenants.slice(0, 5).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleTenantSelect(t.id, t.full_name)}
                        className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        {t.full_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Unit Search */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="unit" className="text-xs text-muted-foreground">
                  Or search unit number
                </Label>
                <Input
                  id="unit"
                  placeholder="Type unit (e.g., A-01)…"
                  value={unitSearch}
                  onChange={(e) => {
                    setUnitSearch(e.target.value);
                    setShowUnitList(true);
                  }}
                  onFocus={() => setShowUnitList(true)}
                />
                {showUnitList && unitSearch && filteredUnits.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 space-y-1 rounded-md border border-input bg-popover p-2 shadow-md">
                    {filteredUnits.slice(0, 5).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleUnitSelect(u.id, u.house_number)}
                        className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        <div className="font-medium">{u.house_number}</div>
                        {u.properties?.name && (
                          <div className="text-xs text-muted-foreground">{u.properties.name}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {selectedTenantId && (
              <div className="rounded-lg bg-muted p-2">
                <p className="text-xs font-medium text-foreground">
                  ✓ Selected: {tenants?.find((t) => t.id === selectedTenantId)?.full_name}
                </p>
              </div>
            )}
            {errors.tenant_id && <p className="text-xs text-destructive">{errors.tenant_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs">
                Amount (KES)
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("amount")}
              />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="method" className="text-xs">
                Method
              </Label>
              <Select defaultValue="" onValueChange={(value) => setValue("method", value as any)}>
                <SelectTrigger id="method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
              {errors.method && <p className="text-xs text-destructive">{errors.method.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paid_at" className="text-xs">
              Payment date
            </Label>
            <Input
              id="paid_at"
              type="date"
              {...register("paid_at")}
              defaultValue={new Date().toISOString().split("T")[0]}
            />
            {errors.paid_at && <p className="text-xs text-destructive">{errors.paid_at.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reference" className="text-xs">
              Reference number (optional)
            </Label>
            <Input
              id="reference"
              placeholder="M-Pesa transaction ID, bank receipt, etc."
              {...register("reference")}
            />
            {errors.reference && <p className="text-xs text-destructive">{errors.reference.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs">
              Note / Reason (optional)
            </Label>
            <Textarea
              id="reason"
              placeholder="E.g., Late payment settlement, partial payment, etc."
              className="min-h-[80px]"
              {...register("reason")}
            />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record payment
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
