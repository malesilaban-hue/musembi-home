import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, FileText, Download, Trash2, ArrowLeft } from "lucide-react";
import { fmtDate, KES } from "@/lib/format";

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
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<string>("national_id");
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

  if (!tenant) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/tenants" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Tenants
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{tenant.full_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tenant.phone}{tenant.email ? ` · ${tenant.email}` : ""}</p>
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
