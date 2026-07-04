import { useEffect, useState } from "react";
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
import { ArrowLeft, Plus, Loader2, DoorClosed } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

type UnitStatus = "vacant" | "occupied" | "reserved" | "maintenance" | "unavailable";
interface Property {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  county: string | null;
}
interface Unit {
  id: string;
  house_number: string;
  floor: number | null;
  bedrooms: number;
  bathrooms: number;
  rent: number;
  status: UnitStatus;
}

const unitSchema = z.object({
  house_number: z.string().trim().min(1, "Required").max(30),
  floor: z.coerce.number().int().min(0).max(200).optional(),
  bedrooms: z.coerce.number().int().min(0).max(20),
  bathrooms: z.coerce.number().int().min(0).max(20),
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
  const { hasRole } = useAuth();
  const canManage = hasRole(["super_admin", "landlord", "caretaker"]);
  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    document.title = "Property · MUSEMBI PMS";
    void loadAll();
     
  }, [id]);

  const loadAll = async () => {
    const [{ data: p, error: pe }, { data: u, error: ue }] = await Promise.all([
      supabase.from("properties").select("id,name,address,city,county").eq("id", id!).maybeSingle(),
      supabase
        .from("units")
        .select("id,house_number,floor,bedrooms,bathrooms,rent,status")
        .eq("property_id", id!)
        .order("house_number"),
    ]);
    if (pe) toast.error(pe.message);
    if (ue) toast.error(ue.message);
    setProperty(p as Property | null);
    setUnits((u ?? []) as Unit[]);
  };

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
        {canManage && (
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Units ({units?.length ?? 0})
        </h2>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {units.map((u) => (
              <Card key={u.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">Unit {u.house_number}</CardTitle>
                  <Badge className={statusColor[u.status]} variant="secondary">
                    {u.status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <div>
                    {u.bedrooms} bed · {u.bathrooms} bath
                    {u.floor != null && ` · Floor ${u.floor}`}
                  </div>
                  <div className="font-medium text-foreground">
                    KES {Number(u.rent).toLocaleString("en-KE")}
                    <span className="text-xs font-normal text-muted-foreground"> / month</span>
                  </div>
                </CardContent>
              </Card>
            ))}
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
    formState: { errors, isSubmitting },
  } = useForm<UnitValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: { status: "vacant", bedrooms: 1, bathrooms: 1, rent: 0, deposit: 0 },
  });

  const status = watch("status");

  const onSubmit = async (v: UnitValues) => {
    const { error } = await supabase.from("units").insert({
      property_id: propertyId,
      house_number: v.house_number,
      floor: v.floor ?? null,
      bedrooms: v.bedrooms,
      bathrooms: v.bathrooms,
      rent: v.rent,
      deposit: v.deposit,
      status: v.status,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Unit created");
    reset();
    onCreated();
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
            <Label htmlFor="u-floor">Floor</Label>
            <Input id="u-floor" type="number" min={0} {...register("floor")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-bed">Bedrooms</Label>
            <Input id="u-bed" type="number" min={0} {...register("bedrooms")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-bath">Bathrooms</Label>
            <Input id="u-bath" type="number" min={0} {...register("bathrooms")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-rent">Rent (KES)</Label>
            <Input id="u-rent" type="number" min={0} step="0.01" {...register("rent")} />
          </div>
          <div className="space-y-1.5">
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
