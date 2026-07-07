import { useEffect, useState } from "react";
import { usePropertyTheme } from "@/lib/use-property-theme";
import { Link, useParams } from "react-router-dom";
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
import { ArrowLeft, Plus, Loader2, DoorClosed, Pencil, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

type UnitStatus = "vacant" | "occupied" | "reserved" | "maintenance" | "unavailable";
type UnitType = "single_room" | "bedsitter" | "double_room" | "store" | "caretaker_unit";
type FloorLevel = "ground" | "first" | "second" | "third" | "fourth" | "fifth";

interface Property {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  county: string | null;
  theme?: string | null;
}
interface Unit {
  id: string;
  house_number: string;
  unit_type: UnitType;
  floor_level: FloorLevel;
  rent: number;
  deposit: number;
  status: UnitStatus;
}

const unitSchema = z.object({
  house_number: z.string().trim().min(1, "Required").max(30),
  unit_type: z.enum(["single_room", "bedsitter", "double_room", "store", "caretaker_unit"]),
  floor_level: z.enum(["ground", "first", "second", "third", "fourth", "fifth"]),
  rent: z.coerce.number().min(0).max(10_000_000),
  deposit: z.coerce.number().min(0).max(10_000_000),
  status: z.enum(["vacant", "occupied", "reserved", "maintenance", "unavailable"]),
});
type UnitValues = z.infer<typeof unitSchema>;

const statusColor: Record<UnitStatus, string> = {
  vacant: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  occupied: "bg-primary/10 text-primary",
  reserved: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  maintenance: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  unavailable: "bg-muted text-muted-foreground",
};

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { hasRole, user } = useAuth();
  const canManage = hasRole(["super_admin", "landlord"]);
  const isCaretaker = hasRole(["caretaker"]);
  const canCreateUnit = canManage || isCaretaker;
  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [unitLeases, setUnitLeases] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [assignUnit, setAssignUnit] = useState<Unit | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "vacant" | "occupied">("all");

  useEffect(() => {
    if (!id) return;
    document.title = "Property · MUSEMBI PMS";
    void loadAll();
     
  }, [id]);

  const loadAll = async () => {
    const [{ data: p, error: pe }, { data: u, error: ue }, { data: l, error: le }] = await Promise.all([
      supabase.from("properties").select("id,name,address,city,county,theme").eq("id", id!).maybeSingle(),
      supabase
        .from("units")
        .select("id,house_number,unit_type,floor_level,rent,deposit,status")
        .eq("property_id", id!)
        .order("house_number"),
      supabase.from("leases").select("unit_id").eq("status", "active"),
    ]);
    if (pe) toast.error(pe.message);
    if (ue) toast.error(ue.message);
    setProperty(p as Property | null);
    setUnits((u ?? []) as Unit[]);
    
    // Build a map of which units have active leases
    const leasedUnits: Record<string, boolean> = {};
    (l ?? []).forEach((lease: any) => {
      leasedUnits[lease.unit_id] = true;
    });
    setUnitLeases(leasedUnits);
  };

  usePropertyTheme(property?.theme);

  if (!property) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/properties"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to properties
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{property.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[property.address, property.city, property.county].filter(Boolean).join(", ") ||
              "No address recorded"}
          </p>
        </div>
        {canCreateUnit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> New unit
              </Button>
            </DialogTrigger>
            <UnitDialog
              propertyId={property.id}
              onCreated={() => {
                setOpen(false);
                void loadAll();
              }}
            />
          </Dialog>
        )}
      </header>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Units ({units?.length ?? 0})
          </h2>
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
            {(["all", "vacant", "occupied"] as const).map((f) => {
              const count =
                f === "all"
                  ? units?.length ?? 0
                  : (units ?? []).filter((u) => u.status === f).length;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
                    filter === f ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f} ({count})
                </button>
              );
            })}
          </div>
        </div>
        {units === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : units.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <DoorClosed className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No units yet. {canManage && "Create the first unit above."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {["ground", "first", "second", "third", "fourth", "fifth"].map((floor) => {
              const floorUnits = units.filter((u) => u.floor_level === floor);
              if (floorUnits.length === 0) return null;
              return (
                <div key={floor}>
                  <h3 className="mb-2 text-sm font-medium capitalize text-foreground">
                    {floor === "ground" ? "Ground Floor" : `${floor.charAt(0).toUpperCase() + floor.slice(1)} Floor`} ({floorUnits.length})
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {floorUnits.map((u) => (
                      <Card key={u.id} className="relative">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-base">Unit {u.house_number}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge className={statusColor[u.status]} variant="secondary">
                              {u.status}
                            </Badge>
                            {canCreateUnit && (
                              <>
                                {u.status === "occupied" && !unitLeases[u.id] && (
                                  <Dialog open={assignOpen && assignUnit?.id === u.id} onOpenChange={(open) => {
                                    if (!open) setAssignUnit(null);
                                    setAssignOpen(open);
                                  }}>
                                    <DialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setAssignUnit(u)}
                                        className="h-8 w-8 p-0"
                                        title="Assign tenant to this unit"
                                      >
                                        <Users className="h-4 w-4" />
                                      </Button>
                                    </DialogTrigger>
                                    {assignUnit?.id === u.id && (
                                      <AssignTenantDialog
                                        unit={assignUnit}
                                        userId={user!.id}
                                        onAssigned={() => {
                                          setAssignOpen(false);
                                          setAssignUnit(null);
                                          void loadAll();
                                        }}
                                      />
                                    )}
                                  </Dialog>
                                )}
                                <Dialog open={editOpen && editingUnit?.id === u.id} onOpenChange={(open) => {
                                  if (!open) setEditingUnit(null);
                                  setEditOpen(open);
                                }}>
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingUnit(u)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  {editingUnit?.id === u.id && (
                                    <EditUnitDialog
                                      unit={editingUnit}
                                      onSaved={() => {
                                        setEditOpen(false);
                                        setEditingUnit(null);
                                        void loadAll();
                                      }}
                                    />
                                  )}
                                </Dialog>
                              </>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-1 text-sm text-muted-foreground">
                          <div>
                            {u.unit_type.replace(/_/g, " ")} · {u.floor_level} floor
                          </div>
                          <div className="font-medium text-foreground">
                            KES {Number(u.rent).toLocaleString("en-KE")}
                            <span className="text-xs font-normal text-muted-foreground"> / month</span>
                          </div>
                          {u.deposit > 0 && (
                            <div className="text-xs">
                              Deposit: KES {Number(u.deposit).toLocaleString("en-KE")}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function UnitDialog({
  propertyId,
  onCreated,
}: {
  propertyId: string;
  onCreated: () => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UnitValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: { status: "vacant", unit_type: "single_room", floor_level: "ground", rent: 0, deposit: 0 },
  });

  const status = watch("status");
  const unitType = watch("unit_type");
  const floorLevel = watch("floor_level");

  const onSubmit = async (v: UnitValues) => {
    try {
      // Explicitly cast enum values to ensure they're correct
      const payload = {
        property_id: propertyId,
        house_number: v.house_number,
        unit_type: v.unit_type || 'single_room',
        floor_level: v.floor_level || 'ground',
        rent: Number(v.rent) || 0,
        deposit: Number(v.deposit) || 0,
        status: v.status || 'vacant',
      };

      console.log("Inserting unit with payload:", payload);

      const { error } = await supabase.from("units").insert([payload]);
      
      if (error) {
        console.error("Insert error:", error);
        toast.error(`Failed to create unit: ${error.message}`);
        return;
      }
      
      toast.success("Unit created successfully");
      reset();
      onCreated();
    } catch (err) {
      console.error("Exception:", err);
      toast.error(err instanceof Error ? err.message : "Unknown error");
    }
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>New unit</DialogTitle>
        </DialogHeader>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="u-hn">House number</Label>
            <Input id="u-hn" placeholder="A-01" {...register("house_number")} />
            {errors.house_number && (
              <p className="text-xs text-destructive">{errors.house_number.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-type">Unit type</Label>
            <Select value={unitType} onValueChange={(v) => {
              setValue("unit_type", v as UnitType);
              // Auto-clear rent for store and caretaker_unit
              if (v === "store" || v === "caretaker_unit") {
                setValue("rent", 0);
                setValue("deposit", 0);
              }
            }}>
              <SelectTrigger id="u-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single_room">Single room</SelectItem>
                <SelectItem value="bedsitter">Bedsitter</SelectItem>
                <SelectItem value="double_room">Double room</SelectItem>
                <SelectItem value="store">Store</SelectItem>
                <SelectItem value="caretaker_unit">Caretaker unit</SelectItem>
              </SelectContent>
            </Select>
            {errors.unit_type && (
              <p className="text-xs text-destructive">{errors.unit_type.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-floor">Floor</Label>
            <Select value={floorLevel} onValueChange={(v) => setValue("floor_level", v as FloorLevel)}>
              <SelectTrigger id="u-floor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ground">Ground floor</SelectItem>
                <SelectItem value="first">First floor</SelectItem>
                <SelectItem value="second">Second floor</SelectItem>
                <SelectItem value="third">Third floor</SelectItem>
                <SelectItem value="fourth">Fourth floor</SelectItem>
                <SelectItem value="fifth">Fifth floor</SelectItem>
              </SelectContent>
            </Select>
            {errors.floor_level && (
              <p className="text-xs text-destructive">{errors.floor_level.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-rent">Rent (KES)</Label>
            <Input id="u-rent" type="number" min={0} step="0.01" {...register("rent")} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="u-dep">Deposit (KES)</Label>
            <Input id="u-dep" type="number" min={0} step="0.01" {...register("deposit")} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setValue("status", v as UnitStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacant">Vacant</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create unit
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function EditUnitDialog({ unit, onSaved }: { unit: Unit; onSaved: () => void }) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UnitValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      house_number: unit.house_number,
      unit_type: unit.unit_type,
      floor_level: unit.floor_level,
      rent: unit.rent,
      deposit: unit.deposit,
      status: unit.status,
    },
  });

  const status = watch("status");
  const unitType = watch("unit_type");
  const floorLevel = watch("floor_level");

  const onSubmit = async (v: UnitValues) => {
    const { error } = await supabase.from("units").update({
      house_number: v.house_number,
      unit_type: v.unit_type,
      floor_level: v.floor_level,
      rent: v.rent,
      deposit: v.deposit,
      status: v.status,
    }).eq("id", unit.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Unit updated");
    onSaved();
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>Edit unit {unit.house_number}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="e-hn">House number</Label>
            <Input id="e-hn" placeholder="A-01" {...register("house_number")} />
            {errors.house_number && (
              <p className="text-xs text-destructive">{errors.house_number.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-type">Unit type</Label>
            <Select value={unitType} onValueChange={(v) => {
              setValue("unit_type", v as UnitType);
              // Auto-clear rent for store and caretaker_unit
              if (v === "store" || v === "caretaker_unit") {
                setValue("rent", 0);
                setValue("deposit", 0);
              }
            }}>
              <SelectTrigger id="e-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single_room">Single room</SelectItem>
                <SelectItem value="bedsitter">Bedsitter</SelectItem>
                <SelectItem value="double_room">Double room</SelectItem>
                <SelectItem value="store">Store</SelectItem>
                <SelectItem value="caretaker_unit">Caretaker unit</SelectItem>
              </SelectContent>
            </Select>
            {errors.unit_type && (
              <p className="text-xs text-destructive">{errors.unit_type.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-floor">Floor</Label>
            <Select value={floorLevel} onValueChange={(v) => setValue("floor_level", v as FloorLevel)}>
              <SelectTrigger id="e-floor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ground">Ground floor</SelectItem>
                <SelectItem value="first">First floor</SelectItem>
                <SelectItem value="second">Second floor</SelectItem>
                <SelectItem value="third">Third floor</SelectItem>
                <SelectItem value="fourth">Fourth floor</SelectItem>
                <SelectItem value="fifth">Fifth floor</SelectItem>
              </SelectContent>
            </Select>
            {errors.floor_level && (
              <p className="text-xs text-destructive">{errors.floor_level.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-rent">Rent (KES)</Label>
            <Input id="e-rent" type="number" min={0} step="0.01" {...register("rent")} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="e-dep">Deposit (KES)</Label>
            <Input id="e-dep" type="number" min={0} step="0.01" {...register("deposit")} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setValue("status", v as UnitStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacant">Vacant</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}


const assignTenantSchema = z.object({
  tenant_id: z.string().min(1, "Select a tenant"),
});
type AssignTenantValues = z.infer<typeof assignTenantSchema>;

interface TenantOption {
  id: string;
  full_name: string;
}

function AssignTenantDialog({
  unit,
  userId,
  onAssigned,
}: {
  unit: Unit;
  userId: string;
  onAssigned: () => void;
}) {
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantSearch, setTenantSearch] = useState("");
  const [showTenantList, setShowTenantList] = useState(false);

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AssignTenantValues>({
    resolver: zodResolver(assignTenantSchema),
  });

  const selectedTenantId = watch("tenant_id");

  useEffect(() => {
    const loadTenants = async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id,full_name")
        .order("full_name");
      if (!error) setTenants(data ?? []);
    };
    void loadTenants();
  }, []);

  const filteredTenants = tenants.filter((t) =>
    t.full_name.toLowerCase().includes(tenantSearch.toLowerCase())
  );

  const onSubmit = async (values: AssignTenantValues) => {
    const tenant = tenants.find((t) => t.id === values.tenant_id);
    const today = new Date().toISOString().slice(0, 10);

    const { error: leaseError } = await supabase.from("leases").insert({
      tenant_id: values.tenant_id,
      unit_id: unit.id,
      start_date: today,
      monthly_rent: unit.rent,
      deposit: unit.deposit,
      billing_day: 5,
      status: "active",
      created_by: userId,
    } as never);

    if (leaseError) return toast.error(leaseError.message);
    toast.success(`${tenant?.full_name} assigned to Unit ${unit.house_number}`);
    onAssigned();
  };

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);

  return (
    <DialogContent>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>Assign Tenant</DialogTitle>
          <DialogDescription>Assign a tenant to Unit {unit.house_number}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tenant-search" className="text-xs">
              Search tenant by name
            </Label>
            <div className="relative">
              <Input
                id="tenant-search"
                placeholder="Enter tenant name…"
                value={tenantSearch}
                onChange={(e) => {
                  setTenantSearch(e.target.value);
                  setShowTenantList(true);
                }}
                onFocus={() => setShowTenantList(true)}
              />
              {showTenantList && tenantSearch && filteredTenants.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-input bg-popover p-2 shadow-md">
                  {filteredTenants.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setValue("tenant_id", t.id);
                        setTenantSearch(t.full_name);
                        setShowTenantList(false);
                      }}
                      className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-accent"
                    >
                      <div className="font-medium">{t.full_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.tenant_id && <p className="text-xs text-destructive">{errors.tenant_id.message}</p>}
          </div>
          {selectedTenant && (
            <div className="rounded-lg bg-muted p-3">
              <div className="text-sm font-medium">{selectedTenant.full_name}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                <div>Unit: {unit.house_number}</div>
                <div>Type: {unit.unit_type.replace(/_/g, " ")}</div>
                <div>Rent: KES {Number(unit.rent).toLocaleString("en-KE")}/month</div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="mt-6">
          <Button type="submit" disabled={isSubmitting || !selectedTenantId}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Lease & Assign
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
