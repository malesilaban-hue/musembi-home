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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Wrench, Loader2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { fmtDate, KES } from "@/lib/format";

interface Maintenance {
  id: string;
  title: string;
  description: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  status: string;
  priority: string;
  reported_date: string;
  completion_date: string | null;
  units: { house_number: string; properties: { name: string } | null } | null;
}

interface Property {
  id: string;
  name: string;
}

const schema = z.object({
  title: z.string().trim().min(3, "Title required").max(200),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  property_id: z.string().uuid("Select property"),
  unit_id: z.string().uuid().optional().or(z.literal("")),
  estimated_cost: z.coerce.number().min(0).optional(),
  actual_cost: z.coerce.number().min(0).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
});
type FormValues = z.infer<typeof schema>;

const statusColor: Record<string, string> = {
  pending: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  in_progress: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-destructive/10 text-destructive",
};

const priorityColor: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  high: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  urgent: "bg-destructive/10 text-destructive",
};

export default function Maintenance() {
  const { hasRole, user } = useAuth();
  const canCreate = hasRole(["super_admin", "landlord", "accountant", "caretaker"]);
  const canReadFull = hasRole(["super_admin", "landlord"]);
  const [items, setItems] = useState<Maintenance[] | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const reload = async () => {
    let query = supabase
      .from("maintenance")
      .select(
        "id,title,description,estimated_cost,actual_cost,status,priority,reported_date,completion_date,units(house_number,properties(name))"
      )
      .order("reported_date", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;
    if (error) return toast.error(error.message);
    setItems((data as unknown as Maintenance[]) ?? []);
  };

  const loadProperties = async () => {
    const { data, error } = await supabase
      .from("properties")
      .select("id,name")
      .order("name");
    if (error) return toast.error(error.message);
    setProperties(data ?? []);
  };

  useEffect(() => {
    document.title = "Maintenance · MUSEMBI PMS";
    void reload();
    void loadProperties();
  }, [filter]);

  const totalEstimated = (items ?? []).reduce((sum, m) => sum + Number(m.estimated_cost || 0), 0);
  const totalActual = (items ?? []).reduce((sum, m) => sum + Number(m.actual_cost || 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Maintenance</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track maintenance requests and costs.</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> New request
              </Button>
            </DialogTrigger>
            <MaintenanceDialog
              properties={properties}
              onCreated={() => {
                setOpen(false);
                void reload();
              }}
            />
          </Dialog>
        )}
      </header>

      {items !== null && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{KES(totalEstimated)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Actual Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{KES(totalActual)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Open Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(items ?? []).filter((m) => m.status !== "completed" && m.status !== "cancelled").length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex gap-2">
        {["all", "pending", "in_progress", "completed", "cancelled"].map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "All" : s.replace(/_/g, " ").toUpperCase()}
          </Button>
        ))}
      </div>

      {items === null ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Wrench className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No maintenance requests</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-base">{m.title}</h3>
                      <Badge className={statusColor[m.status]} variant="secondary">
                        {m.status.replace(/_/g, " ")}
                      </Badge>
                      <Badge className={priorityColor[m.priority]} variant="secondary">
                        {m.priority}
                      </Badge>
                    </div>
                    {m.description && (
                      <div className="mt-1">
                        <p className={canReadFull ? "" : "line-clamp-2"}>
                          <span className="text-sm text-muted-foreground">{m.description}</span>
                        </p>
                        {canReadFull && m.description.length > 100 && !expandedIds.has(m.id) && (
                          <button
                            onClick={() => {
                              const newExpanded = new Set(expandedIds);
                              newExpanded.add(m.id);
                              setExpandedIds(newExpanded);
                            }}
                            className="text-xs text-primary hover:underline mt-1"
                          >
                            Read more
                          </button>
                        )}
                        {canReadFull && expandedIds.has(m.id) && m.description.length > 100 && (
                          <button
                            onClick={() => {
                              const newExpanded = new Set(expandedIds);
                              newExpanded.delete(m.id);
                              setExpandedIds(newExpanded);
                            }}
                            className="text-xs text-primary hover:underline mt-1"
                          >
                            Show less
                          </button>
                        )}
                      </div>
                    )}
                    {m.units && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.units.properties?.name} · Unit {m.units.house_number}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Reported: </span>
                        <span className="font-medium">{fmtDate(m.reported_date)}</span>
                      </div>
                      {m.estimated_cost && (
                        <div>
                          <span className="text-muted-foreground">Est: </span>
                          <span className="font-medium">{KES(m.estimated_cost)}</span>
                        </div>
                      )}
                      {m.actual_cost && (
                        <div>
                          <span className="text-muted-foreground">Actual: </span>
                          <span className="font-medium">{KES(m.actual_cost)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MaintenanceDialog({
  properties,
  onCreated,
}: {
  properties: Property[];
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: "medium",
      status: "pending",
    },
  });

  const selectedProperty = watch("property_id");

  const onSubmit = async (v: FormValues) => {
    const { error } = await supabase.from("maintenance").insert({
      title: v.title,
      description: v.description || null,
      property_id: v.property_id,
      unit_id: v.unit_id || null,
      estimated_cost: v.estimated_cost ?? null,
      actual_cost: v.actual_cost ?? null,
      priority: v.priority,
      status: v.status,
      reported_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Maintenance request created");
    reset();
    onCreated();
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>New maintenance request</DialogTitle>
          <DialogDescription>Report a maintenance issue or work request.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Title" error={errors.title?.message}>
              <Input {...register("title")} placeholder="Broken window, plumbing issue, etc." />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <Textarea rows={2} {...register("description")} placeholder="Details about the issue..." />
            </Field>
          </div>
          <Field label="Property" error={errors.property_id?.message}>
            <Controller
              control={control}
              name="property_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Priority">
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Status">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Est. Cost (KES)">
            <Input type="number" step="0.01" min={0} {...register("estimated_cost")} />
          </Field>
          <Field label="Actual Cost (KES)">
            <Input type="number" step="0.01" min={0} {...register("actual_cost")} />
          </Field>
        </div>
        <DialogFooter className="mt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create request
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
