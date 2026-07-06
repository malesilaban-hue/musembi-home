import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Plus, FileSignature, Loader2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { fmtDate, KES } from "@/lib/format";

interface Lease {
  id: string;
  start_date: string;
  end_date: string | null;
  monthly_rent: number;
  status: string;
  tenants: { full_name: string } | null;
  units: { house_number: string; properties: { name: string } | null } | null;
}
interface TenantOpt { id: string; full_name: string }
interface UnitOpt {
  id: string;
  house_number: string;
  unit_type: string;
  floor_level: string;
  rent: number;
  water_charge: number;
  garbage_charge: number;
  parking_charge: number;
  service_charge: number;
  deposit: number;
  status: string;
  properties: { name: string } | null;
}

const schema = z.object({
  tenant_id: z.string().uuid("Select tenant"),
  unit_id: z.string().uuid("Select unit"),
  start_date: z.string().min(1, "Required"),
  end_date: z.string().optional().or(z.literal("")),
  monthly_rent: z.coerce.number().min(0),
  deposit: z.coerce.number().min(0),
  water_charge: z.coerce.number().min(0),
  garbage_charge: z.coerce.number().min(0),
  parking_charge: z.coerce.number().min(0),
  service_charge: z.coerce.number().min(0),
  billing_day: z.coerce.number().int().min(1).max(28),
});
type FormValues = z.infer<typeof schema>;

export default function Leases() {
  const { user, hasRole } = useAuth();
  const canCreate = hasRole(["super_admin", "landlord", "accountant"]);
  const [items, setItems] = useState<Lease[] | null>(null);
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<TenantOpt[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);

  const reload = async () => {
    const { data, error } = await supabase
      .from("leases")
      .select("id,start_date,end_date,monthly_rent,status,tenants(full_name),units(house_number,properties(name))")
      .order("start_date", { ascending: false });
    if (error) return toast.error(error.message);
    setItems((data as unknown as Lease[]) ?? []);
  };

  const loadOpts = async () => {
    const [t, u] = await Promise.all([
      supabase.from("tenants").select("id,full_name").order("full_name"),
      supabase
        .from("units")
        .select("id,house_number,unit_type,floor_level,rent,water_charge,garbage_charge,parking_charge,service_charge,deposit,status,properties(name)")
        .eq("status", "vacant")
        .order("house_number"),
    ]);
    setTenants((t.data as TenantOpt[]) ?? []);
    setUnits((u.data as unknown as UnitOpt[]) ?? []);
  };

  useEffect(() => {
    document.title = "Leases · MUSEMBI PMS";
    void reload();
    void loadOpts();
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Leases</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Assign tenants to units and set billing terms.
          </p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> New lease
              </Button>
            </DialogTrigger>
            <LeaseDialog
              userId={user!.id}
              tenants={tenants}
              units={units}
              onCreated={() => {
                setOpen(false);
                void reload();
                void loadOpts();
              }}
            />
          </Dialog>
        )}
      </header>

      {items === null ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileSignature className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No leases yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {items.map((l) => (
                <li key={l.id}>
                  <Link to={`/leases/${l.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {l.tenants?.full_name ?? "—"} → {l.units?.properties?.name ?? ""} unit {l.units?.house_number ?? ""}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {fmtDate(l.start_date)} → {l.end_date ? fmtDate(l.end_date) : "open"} · {KES(l.monthly_rent)}/mo
                      </div>
                    </div>
                    <Badge variant={l.status === "active" ? "default" : "secondary"}>{l.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LeaseDialog({
  userId,
  tenants,
  units,
  onCreated,
}: {
  userId: string;
  tenants: TenantOpt[];
  units: UnitOpt[];
  onCreated: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      start_date: new Date().toISOString().slice(0, 10),
      monthly_rent: 0,
      deposit: 0,
      water_charge: 0,
      garbage_charge: 0,
      parking_charge: 0,
      service_charge: 0,
      billing_day: 1,
    },
  });

  const onUnitChange = (uid: string) => {
    const u = units.find((x) => x.id === uid);
    if (!u) return;
    setValue("monthly_rent", Number(u.rent) || 0);
    setValue("deposit", Number(u.deposit) || 0);
    setValue("water_charge", Number(u.water_charge) || 0);
    setValue("garbage_charge", Number(u.garbage_charge) || 0);
    setValue("parking_charge", Number(u.parking_charge) || 0);
    setValue("service_charge", Number(u.service_charge) || 0);
  };

  const onSubmit = async (v: FormValues) => {
    const { error, data } = await supabase
      .from("leases")
      .insert({
        tenant_id: v.tenant_id,
        unit_id: v.unit_id,
        start_date: v.start_date,
        end_date: v.end_date || null,
        monthly_rent: v.monthly_rent,
        deposit: v.deposit,
        water_charge: v.water_charge,
        garbage_charge: v.garbage_charge,
        parking_charge: v.parking_charge,
        service_charge: v.service_charge,
        billing_day: v.billing_day,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    await supabase.from("units").update({ status: "occupied" as never }).eq("id", v.unit_id);
    toast.success("Lease created");
    reset();
    onCreated();
    if (data) window.location.href = `/leases/${data.id}`;
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>New lease</DialogTitle>
          <DialogDescription>Assign a tenant to a unit and set billing terms.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tenant</Label>
            <Controller
              control={control}
              name="tenant_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.tenant_id && <p className="text-xs text-destructive">{errors.tenant_id.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Unit</Label>
            <Controller
              control={control}
              name="unit_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => { field.onChange(v); onUnitChange(v); }}>
                  <SelectTrigger><SelectValue placeholder="Select vacant unit" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.properties?.name ?? "—"} · {u.house_number} ({u.unit_type.replace(/_/g, " ")}, {u.floor_level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.unit_id && <p className="text-xs text-destructive">{errors.unit_id.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date"><Input type="date" {...register("start_date")} /></Field>
            <Field label="End date (optional)"><Input type="date" {...register("end_date")} /></Field>
            <Field label="Monthly rent"><Input type="number" step="0.01" {...register("monthly_rent")} /></Field>
            <Field label="Deposit"><Input type="number" step="0.01" {...register("deposit")} /></Field>
            <Field label="Water"><Input type="number" step="0.01" {...register("water_charge")} /></Field>
            <Field label="Garbage"><Input type="number" step="0.01" {...register("garbage_charge")} /></Field>
            <Field label="Parking"><Input type="number" step="0.01" {...register("parking_charge")} /></Field>
            <Field label="Service"><Input type="number" step="0.01" {...register("service_charge")} /></Field>
            <Field label="Billing day (1–28)"><Input type="number" min={1} max={28} {...register("billing_day")} /></Field>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create lease
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
