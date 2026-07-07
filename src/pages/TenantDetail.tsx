import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Upload, FileText, Download, Trash2, ArrowLeft, Pencil, Home } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fmtDate, KES } from "@/lib/format";

const editSchema = z.object({
  full_name: z.string().trim().min(2, "Full name required").max(120),
  phone: z.string().trim().min(7, "Phone required").max(20),
  alt_phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  national_id: z.string().trim().max(30).optional().or(z.literal("")),
  emergency_name: z.string().trim().max(120).optional().or(z.literal("")),
  emergency_phone: z.string().trim().max(20).optional().or(z.literal("")),
  emergency_relation: z.string().trim().max(60).optional().or(z.literal("")),
  occupation: z.string().trim().max(120).optional().or(z.literal("")),
  unit_id: z.string().optional().or(z.literal("")),
});
type EditFormValues = z.infer<typeof editSchema>;

interface Tenant {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  alt_phone: string | null;
  national_id: string | null;
  kra_pin: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  emergency_relation: string | null;
  occupation: string | null;
  employer: string | null;
  notes: string | null;
}

interface Unit {
  id: string;
  house_number: string;
  unit_type: string;
  floor_level: string;
  rent: number;
  status: string;
  properties: {
    name: string;
  } | null;
}

interface Doc {
  id: string;
  doc_type: string;
  storage_path: string;
  file_name: string;
  size_bytes: number | null;
  created_at: string;
}
interface Lease {
  id: string;
  start_date: string;
  end_date: string | null;
  monthly_rent: number;
  status: string;
  units: { house_number: string; properties: { name: string } | null } | null;
}

const DOC_TYPES = [
  { v: "national_id", l: "National ID" },
  { v: "kra_pin", l: "KRA PIN" },
  { v: "passport", l: "Passport" },
  { v: "lease_contract", l: "Lease contract" },
  { v: "other", l: "Other" },
];

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, hasRole } = useAuth();
  const canManage = hasRole(["super_admin", "landlord", "accountant", "caretaker"]);
  const canDelete = hasRole(["super_admin", "landlord"]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<string>("national_id");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    if (!id) return;
    const [t, d, l] = await Promise.all([
      supabase.from("tenants").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("tenant_documents")
        .select("id,doc_type,storage_path,file_name,size_bytes,created_at")
        .eq("tenant_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("leases")
        .select("id,start_date,end_date,monthly_rent,status,units(house_number,properties(name))")
        .eq("tenant_id", id)
        .order("start_date", { ascending: false }),
    ]);
    if (t.error) toast.error(t.error.message);
    setTenant(t.data as Tenant | null);
    setDocs((d.data as Doc[]) ?? []);
    setLeases((l.data as unknown as Lease[]) ?? []);
  };

  useEffect(() => {
    document.title = "Tenant · MUSEMBI PMS";
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleUpload = async (file: File) => {
    if (!id || !user) return;
    setUploading(true);
    const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const up = await supabase.storage.from("tenant-documents").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (up.error) {
      toast.error(up.error.message);
      setUploading(false);
      return;
    }
    const ins = await supabase.from("tenant_documents").insert({
      tenant_id: id,
      doc_type: docType as never,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: user.id,
    });
    setUploading(false);
    if (ins.error) return toast.error(ins.error.message);
    toast.success("Document uploaded");
    if (fileRef.current) fileRef.current.value = "";
    void load();
  };

  const downloadDoc = async (d: Doc) => {
    const { data, error } = await supabase.storage
      .from("tenant-documents")
      .createSignedUrl(d.storage_path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const deleteDoc = async (d: Doc) => {
    if (!confirm(`Delete ${d.file_name}?`)) return;
    await supabase.storage.from("tenant-documents").remove([d.storage_path]);
    const { error } = await supabase.from("tenant_documents").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    void load();
  };

  const deleteTenant = async () => {
    if (!id) return;
    if (!confirm("Are you sure you want to delete this tenant? This cannot be undone.")) return;
    setDeleteLoading(true);
    const { error } = await supabase.from("tenants").delete().eq("id", id);
    setDeleteLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Tenant deleted");
    window.location.href = "/tenants";
  };

  if (!tenant) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/tenants" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Tenants
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{tenant.full_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tenant.phone}{tenant.email ? ` · ${tenant.email}` : ""}</p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Pencil className="mr-1 h-4 w-4" /> Edit
                </Button>
              </DialogTrigger>
              <EditTenantDialog
                tenant={tenant}
                onSaved={() => {
                  setEditOpen(false);
                  void load();
                }}
              />
            </Dialog>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="destructive"
              onClick={deleteTenant}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">KYC & personal</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <Info k="National ID" v={tenant.national_id} />
            <Info k="KRA PIN" v={tenant.kra_pin} />
            <Info k="Alt phone" v={tenant.alt_phone} />
            <Info k="Occupation" v={tenant.occupation} />
            <Info k="Employer" v={tenant.employer} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Emergency contact</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <Info k="Name" v={tenant.emergency_name} />
            <Info k="Phone" v={tenant.emergency_phone} />
            <Info k="Relation" v={tenant.emergency_relation} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Documents</CardTitle>
          {canManage && (
            <div className="flex items-center gap-2">
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
              <Button
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                Upload
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded.</p>
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{d.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {DOC_TYPES.find((x) => x.v === d.doc_type)?.l ?? d.doc_type} · {fmtDate(d.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" onClick={() => downloadDoc(d)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    {canManage && (
                      <Button size="icon" variant="ghost" onClick={() => deleteDoc(d)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Leases</CardTitle></CardHeader>
        <CardContent>
          {leases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No leases yet. <Link to="/leases" className="text-primary underline">Create one</Link>.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {leases.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                  <Link to={`/leases/${l.id}`} className="flex-1 hover:underline">
                    <div className="font-medium">
                      {l.units?.properties?.name ?? "—"} · Unit {l.units?.house_number ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(l.start_date)} → {l.end_date ? fmtDate(l.end_date) : "open"} · {KES(l.monthly_rent)}/mo
                    </div>
                  </Link>
                  <Badge variant={l.status === "active" ? "default" : "secondary"}>{l.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className="font-medium">{v || "—"}</div>
    </div>
  );
}

function EditTenantDialog({
  tenant,
  onSaved,
}: {
  tenant: Tenant;
  onSaved: () => void;
}) {
  const { user } = useAuth();
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
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      full_name: tenant.full_name,
      phone: tenant.phone,
      alt_phone: tenant.alt_phone ?? "",
      email: tenant.email ?? "",
      national_id: tenant.national_id ?? "",
      emergency_name: tenant.emergency_name ?? "",
      emergency_phone: tenant.emergency_phone ?? "",
      emergency_relation: tenant.emergency_relation ?? "",
      occupation: tenant.occupation ?? "",
      unit_id: "",
    },
  });

  const selectedUnitId = watch("unit_id");

  useEffect(() => {
    const loadUnits = async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id,house_number,unit_type,floor_level,rent,status,properties(name)")
        .eq("status", "vacant")
        .order("house_number");
      if (!error) setUnits(data ?? []);
    };
    void loadUnits();
  }, []);

  const filteredUnits = units.filter((u) =>
    u.house_number.toLowerCase().includes(unitSearch.toLowerCase())
  );

  const onSubmit = async (values: EditFormValues) => {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (k === "unit_id") continue; // Handle separately
      payload[k] = v === "" ? null : v;
    }

    const { error } = await supabase
      .from("tenants")
      .update(payload as never)
      .eq("id", tenant.id);

    if (error) return toast.error(error.message);

    // If a unit is selected, create a lease and update unit status
    if (values.unit_id && user) {
      const unit = units.find((u) => u.id === values.unit_id);
      const today = new Date().toISOString().slice(0, 10);
      
      const { error: leaseError } = await supabase.from("leases").insert({
        tenant_id: tenant.id,
        unit_id: values.unit_id,
        start_date: today,
        monthly_rent: unit?.rent ?? 0,
        deposit: unit?.rent ?? 0,
        billing_day: 5,
        status: "active",
        created_by: user.id,
      } as never);
      
      const { error: unitErr } = await supabase
        .from("units")
        .update({ status: "occupied" } as never)
        .eq("id", values.unit_id);

      if (leaseError || unitErr) {
        toast.warning("Tenant updated but lease/unit assignment failed");
      } else {
        toast.success("Tenant updated & unit assigned with lease created");
      }
    } else {
      toast.success("Tenant updated");
    }

    reset();
    onSaved();
  };

  const selectedUnit = units.find((u) => u.id === selectedUnitId);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>Edit tenant</DialogTitle>
          <DialogDescription>Update tenant information and assign unit.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Full name" error={errors.full_name?.message}>
            <Input {...register("full_name")} />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
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
          <Field label="Emergency name">
            <Input {...register("emergency_name")} />
          </Field>
          <Field label="Emergency phone">
            <Input {...register("emergency_phone")} />
          </Field>
          <Field label="Emergency relation">
            <Input {...register("emergency_relation")} placeholder="Spouse / Parent…" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Occupation">
              <Input {...register("occupation")} />
            </Field>
          </div>

          {/* Unit Assignment Section */}
          <div className="sm:col-span-2 border-t pt-4">
            <div className="space-y-3">
              <Label className="font-semibold text-sm">Assign Unit (Optional)</Label>
              <div className="space-y-1.5">
                <Label htmlFor="edit-unit-search" className="text-xs">
                  Search unit by number
                </Label>
                <div className="relative">
                  <Input
                    id="edit-unit-search"
                    placeholder="Search unit number (e.g., A-01)…"
                    value={unitSearch}
                    onChange={(e) => {
                      setUnitSearch(e.target.value);
                      setShowUnitList(true);
                    }}
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
                        {selectedUnit.unit_type} • Floor {selectedUnit.floor_level} • KES{" "}
                        {selectedUnit.rent?.toLocaleString()}
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
            Save changes
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
