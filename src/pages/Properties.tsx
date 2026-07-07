import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Edit, Plus, Building2, Loader2, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

interface Property {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  county: string | null;
  created_at: string;
}

const schema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120),
  address: z.string().trim().max(255).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  county: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  theme: z.enum(["default", "orange", "green", "blue", "purple"]).default("default"),
});
type FormValues = z.infer<typeof schema>;

export default function Properties() {
  const { hasRole, user } = useAuth();
  const canCreate = hasRole(["super_admin", "landlord"]);
  const isCaretaker = hasRole(["caretaker"]);
  const [items, setItems] = useState<Property[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Properties · MUSEMBI PMS";
    void reload();
  }, []);

  const reload = async () => {
    try {
      let query = supabase
        .from("properties")
        .select("id,name,address,city,county,created_at")
        .order("created_at", { ascending: false });

      // If caretaker, only show assigned properties
      if (isCaretaker && user) {
        console.log("Loading properties for caretaker:", user.id);
        const { data: cpData, error: cpError } = await supabase
          .from("caretaker_properties")
          .select("property_id")
          .eq("user_id", user.id);
        
        if (cpError) {
          console.error("Error loading caretaker properties:", cpError);
          toast.error("Failed to load assigned properties");
          setItems([]);
          return;
        }

        const propertyIds = (cpData ?? []).map((cp) => cp.property_id);
        console.log("Assigned property IDs:", propertyIds);
        
        if (propertyIds.length > 0) {
          query = query.in("id", propertyIds);
        } else {
          // Caretaker with no assigned properties
          console.log("Caretaker has no assigned properties");
          setItems([]);
          return;
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error loading properties:", error);
        toast.error(error.message);
        return;
      }
      console.log("Loaded properties:", data);
      setItems(data ?? []);
    } catch (err: any) {
      console.error("Exception loading properties:", err);
      toast.error("Failed to load properties");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Properties</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage buildings, blocks and units.
          </p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) setEditingId(null);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> New property
              </Button>
            </DialogTrigger>
            <PropertyDialog
              userId={user!.id}
              propertyId={editingId}
              onCreated={() => {
                setOpen(false);
                setEditingId(null);
                void reload();
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
            <Building2 className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No properties yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {canCreate
                  ? "Add your first property to start creating blocks and units."
                  : "You don't have access to any properties yet."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div key={p.id} className="group relative">
              <Link to={`/properties/${p.id}`}>
                <Card className="h-full transition-shadow hover:shadow-elegant">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="h-4 w-4 text-primary" />
                      {p.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {p.address || p.city || p.county ? (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          {[p.address, p.city, p.county].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    ) : (
                      <span className="italic">No address recorded</span>
                    )}
                  </CardContent>
                </Card>
              </Link>
              {canCreate && (
                <button
                  onClick={() => {
                    setEditingId(p.id);
                    setOpen(true);
                  }}
                  className="absolute right-2 top-2 rounded-lg bg-background/80 p-1.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                  title="Edit property"
                >
                  <Edit className="h-4 w-4 text-primary" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyDialog({ userId, onCreated, propertyId }: { userId: string; onCreated: () => void; propertyId?: string | null }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof schema>, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { theme: "default" },
  });

  const isEditing = !!propertyId;

  useEffect(() => {
    if (isEditing && propertyId) {
      (async () => {
        const { data } = await supabase
          .from("properties")
          .select("name,address,city,county,notes,theme")
          .eq("id", propertyId)
          .maybeSingle();
        if (data) {
          reset({
            name: data.name,
            address: data.address ?? "",
            city: data.city ?? "",
            county: data.county ?? "",
            notes: data.notes ?? "",
            theme: (data as { theme?: FormValues["theme"] }).theme ?? "default",
          });
        }
      })();
    } else {
      reset({ name: "", address: "", city: "", county: "", notes: "", theme: "default" });
    }
  }, [isEditing, propertyId, reset]);

  const currentTheme = watch("theme") ?? "default";

  const onSubmit = async (values: FormValues) => {
    const payload = {
      name: values.name,
      address: values.address || null,
      city: values.city || null,
      county: values.county || null,
      notes: values.notes || null,
      theme: values.theme,
    };

    let error;
    if (isEditing) {
      ({ error } = await supabase.from("properties").update(payload as never).eq("id", propertyId!));
    } else {
      ({ error } = await supabase.from("properties").insert({ ...payload, owner_id: userId } as never));
    }

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isEditing ? "Property updated" : "Property created");
    reset();
    onCreated();
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit property" : "New property"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update building or estate details." : "Create a building or estate you manage."}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" placeholder="Musembi Court" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-address">Address</Label>
            <Input id="p-address" placeholder="123 Ngong Road" {...register("address")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-city">City / Town</Label>
              <Input id="p-city" placeholder="Nairobi" {...register("city")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-county">County</Label>
              <Input id="p-county" placeholder="Nairobi" {...register("county")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-notes">Notes</Label>
            <Textarea id="p-notes" rows={3} {...register("notes")} />
          </div>
          <div className="space-y-1.5">
            <Label>Property theme colour</Label>
            <div className="flex flex-wrap gap-2">
              {(["default", "orange", "green", "blue", "purple"] as const).map((c) => {
                const swatch: Record<string, string> = {
                  default: "hsl(220 30% 30%)",
                  orange: "hsl(28 90% 55%)",
                  green: "hsl(150 60% 40%)",
                  blue: "hsl(220 80% 55%)",
                  purple: "hsl(285 70% 55%)",
                };
                const active = currentTheme === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue("theme", c, { shouldDirty: true })}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs capitalize transition ${
                      active ? "border-primary ring-2 ring-primary/40" : "border-border"
                    }`}
                  >
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full"
                      style={{ background: swatch[c] }}
                    />
                    {c}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Applied when viewing this property or when a caretaker of this property signs in.
            </p>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Update property" : "Create property"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
