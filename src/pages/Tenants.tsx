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
import { Plus, Users, Loader2, Phone, Home } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

interface Tenant {
  id: string;
  full_name: string;
  phone: string;
  alt_phone: string | null;
  created_at: string;
}

interface Unit {
  id: string;
  house_number: string;
  unit_type: string;
  floor_level: string;
  rent: number;
  status: string;
  properties: { name: string } | null;
}

const schema = z.object({
  full_name: z.string().trim().min(2, "Full name required").max(120),
  phone: z.string().trim().min(7, "Phone required").max(20),
  alt_phone: z.string().trim().max(20).optional().or(z.literal("")),
  unit_id: z.string().optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

export default function Tenants() {
  const { hasRole, user } = useAuth();
  const canCreate = hasRole(["super_admin", "landlord", "accountant", "caretaker"]);
  const [items, setItems] = useState<Tenant[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const reload = async () => {
    const { data, error } = await supabase
      .from("tenants")
      .select("id,full_name,phone,alt_phone,created_at")
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setItems(data ?? []);
  };

  useEffect(() => {
    document.title = "Tenants · MUSEMBI PMS";
    void reload();
    const ch = supabase
      .channel("tenants-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tenants" }, () => void reload())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const filtered = (items ?? []).filter((t) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      t.full_name.toLowerCase().includes(s) ||
      t.phone.toLowerCase().includes(s) ||
      (t.alt_phone ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Tenants</h1>
          <p className="mt-1 text-sm text-muted-foreground">Register and manage tenants.</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> New tenant
              </Button>
            </DialogTrigger>
            <TenantDialog
              userId={user!.id}
              onCreated={() => {
                setOpen(false);
                void reload();
              }}
            />
          </Dialog>
        )}
      </header>

      <Input
        placeholder="Search by name or phone…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-md"
      />

      {items === null ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No tenants found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <Link key={t.id} to={`/tenants/${t.id}`}>
              <Card className="h-full transition-shadow hover:shadow-elegant">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4 text-primary" />
                    {t.full_name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> {t.phone}
                  </div>
                  {t.alt_phone && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Phone className="h-3 w-3" /> {t.alt_phone}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function TenantDialog({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitSearch, setUnitSearch] = useState("");
  const [showUnitList, setShowUnitList] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const selectedUnitId = watch("unit_id");

  useEffect(() => {
    const loadData = async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id,house_number,unit_type,floor_level,rent,status,properties(name)")
        .eq("status", "vacant")
        .order("house_number");
      if (!error) setUnits(data ?? []);
    };
    void loadData();
  }, []);

  const filteredUnits = units.filter((u) =>
    u.house_number.toLowerCase().includes(unitSearch.toLowerCase())
  );

  const onSubmit = async (values: FormValues) => {
    const payload = {
      created_by: userId,
      full_name: values.full_name,
      phone: values.phone,
      alt_phone: values.alt_phone || null,
    };

    const { error, data } = await supabase.from("tenants").insert(payload as never).select("id");
    if (error) return toast.error(error.message);

    if (values.unit_id && data && data.length > 0) {
      const tenantId = data[0].id;
      const unit = units.find((u) => u.id === values.unit_id);
      const today = new Date().toISOString().slice(0, 10);
      const { error: leaseError } = await supabase.from("leases").insert({
        tenant_id: tenantId,
        unit_id: values.unit_id,
        start_date: today,
        monthly_rent: unit?.rent ?? 0,
        deposit: unit?.rent ?? 0,
        billing_day: 5,
        status: "active",
        created_by: userId,
      } as never);
      const { error: unitErr } = await supabase
        .from("units")
        .update({ status: "occupied" } as never)
        .eq("id", values.unit_id);
      if (leaseError || unitErr) {
        toast.warning("Tenant created but lease/unit update failed");
      } else {
        toast.success("Tenant registered, lease created & unit occupied");
      }
    } else {
      toast.success("Tenant registered");
    }

    reset();
    onCreated();
  };

  const selectedUnit = units.find((u) => u.id === selectedUnitId);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>Register tenant</DialogTitle>
          <DialogDescription>Minimal details — full name, phone, and unit.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Full name" error={errors.full_name?.message}>
            <Input {...register("full_name")} />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input {...register("phone")} placeholder="+2547…" />
          </Field>
          <Field label="Alt phone (optional)">
            <Input {...register("alt_phone")} />
          </Field>

          <div className="sm:col-span-2 border-t pt-4">
            <div className="space-y-3">
              <Label className="font-semibold text-sm">Assign vacant unit</Label>
              <div className="space-y-1.5">
                <Label htmlFor="unit-search" className="text-xs">Search unit by number</Label>
                <div className="relative">
                  <Input
                    id="unit-search"
                    placeholder="Search unit number (e.g., A-01)…"
                    value={unitSearch}
                    onChange={(e) => { setUnitSearch(e.target.value); setShowUnitList(true); }}
                    onFocus={() => setShowUnitList(true)}
                  />
                  {showUnitList && unitSearch && filteredUnits.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-input bg-popover p-2 shadow-md">
                      {filteredUnits.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setValue("unit_id", u.id);
                            setUnitSearch(u.house_number);
                            setShowUnitList(false);
                          }}
                          className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-accent"
                        >
                          <div className="font-medium">{u.house_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {u.unit_type} • Floor {u.floor_level} • KES {u.rent?.toLocaleString()}
                            {u.properties?.name && ` • ${u.properties.name}`}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedUnit && (
                  <div className="flex items-start gap-2 rounded-lg bg-muted p-3">
                    <Home className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{selectedUnit.house_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedUnit.unit_type} • Floor {selectedUnit.floor_level} • KES {selectedUnit.rent?.toLocaleString()}
                      </div>
                      {selectedUnit.properties?.name && (
                        <div className="text-xs text-muted-foreground">{selectedUnit.properties.name}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Register tenant
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
