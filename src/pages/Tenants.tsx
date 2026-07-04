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
import { Plus, Users, Loader2, Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

interface Tenant {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  national_id: string | null;
  created_at: string;
}

const schema = z.object({
  full_name: z.string().trim().min(2, "Full name required").max(120),
  phone: z.string().trim().min(7, "Phone required").max(20),
  alt_phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  national_id: z.string().trim().max(30).optional().or(z.literal("")),
  kra_pin: z.string().trim().max(30).optional().or(z.literal("")),
  emergency_name: z.string().trim().max(120).optional().or(z.literal("")),
  emergency_phone: z.string().trim().max(20).optional().or(z.literal("")),
  emergency_relation: z.string().trim().max(60).optional().or(z.literal("")),
  occupation: z.string().trim().max(120).optional().or(z.literal("")),
  employer: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
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
      .select("id,full_name,phone,email,national_id,created_at")
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setItems(data ?? []);
  };

  useEffect(() => {
    document.title = "Tenants · MUSEMBI PMS";
    void reload();
  }, []);

  const filtered = (items ?? []).filter((t) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      t.full_name.toLowerCase().includes(s) ||
      t.phone.toLowerCase().includes(s) ||
      (t.email ?? "").toLowerCase().includes(s) ||
      (t.national_id ?? "").toLowerCase().includes(s)
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
        placeholder="Search by name, phone, email or ID…"
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
                  {t.email && <div className="truncate">{t.email}</div>}
                  {t.national_id && <div>ID: {t.national_id}</div>}
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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    const payload: Record<string, unknown> = { created_by: userId };
    for (const [k, v] of Object.entries(values)) {
      payload[k] = v === "" ? null : v;
    }
    payload.full_name = values.full_name;
    payload.phone = values.phone;
    const { error } = await supabase.from("tenants").insert(payload as never);
    if (error) return toast.error(error.message);
    toast.success("Tenant registered");
    reset();
    onCreated();
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>Register tenant</DialogTitle>
          <DialogDescription>KYC details for a new tenant.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Full name" error={errors.full_name?.message}>
            <Input {...register("full_name")} />
          </Field>
          <Field label="Phone">
            <Input {...register("phone")} placeholder="+2547…" />
          </Field>
          <Field label="Alt phone">
            <Input {...register("alt_phone")} />
          </Field>
          <Field label="Email">
            <Input type="email" {...register("email")} />
          </Field>
          <Field label="National ID">
            <Input {...register("national_id")} />
          </Field>
          <Field label="KRA PIN">
            <Input {...register("kra_pin")} />
          </Field>
          <Field label="Emergency name">
            <Input {...register("emergency_name")} />
          </Field>
          <Field label="Emergency phone">
            <Input {...register("emergency_phone")} />
          </Field>
          <Field label="Emergency relation">
            <Input {...register("emergency_relation")} placeholder="Spouse / Parent…" />
          </Field>
          <Field label="Occupation">
            <Input {...register("occupation")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Employer">
              <Input {...register("employer")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea rows={2} {...register("notes")} />
            </Field>
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
