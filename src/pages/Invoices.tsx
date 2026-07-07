import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ReceiptText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { fmtDate, KES } from "@/lib/format";

interface Row {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  due_date: string;
  total: number;
  balance: number;
  status: string;
  leases: {
    tenants: { full_name: string } | null;
    units: { house_number: string; properties: { name: string } | null } | null;
  } | null;
}

export default function Invoices() {
  const { hasRole } = useAuth();
  const canGenerate = hasRole(["super_admin", "landlord", "accountant"]);
  const [items, setItems] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [generating, setGenerating] = useState(false);

  const reload = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("id,invoice_number,period_start,period_end,due_date,total,balance,status,leases(tenants(full_name),units(house_number,properties(name)))")
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setItems((data as unknown as Row[]) ?? []);
  };

  const generateNow = async () => {
    setGenerating(true);
    const { data, error } = await supabase.rpc("generate_due_invoices" as never);
    setGenerating(false);
    if (error) return toast.error(error.message);
    const n = Number(data ?? 0);
    if (n > 0) toast.success(`Generated ${n} invoice${n === 1 ? "" : "s"}`);
    else toast.info("No new invoices to generate yet");
    void reload();
  };

  useEffect(() => {
    document.title = "Invoices · MUSEMBI PMS";
    void reload();
    // Auto-attempt monthly generation on load (idempotent — skips if already created)
    void supabase.rpc("generate_due_invoices" as never).then(() => reload());
    const ch = supabase
      .channel("invoices-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => void reload())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const filtered = (items ?? []).filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.invoice_number.toLowerCase().includes(s) ||
      (r.leases?.tenants?.full_name ?? "").toLowerCase().includes(s) ||
      (r.leases?.units?.house_number ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">Auto-generated on the billing day for every active lease.</p>
        </div>
        {canGenerate && (
          <Button size="sm" variant="outline" onClick={generateNow} disabled={generating}>
            {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Generate now
          </Button>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "unpaid", "partial", "paid", "overdue", "void"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>


      {items === null ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ReceiptText className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No invoices</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {filtered.map((r) => (
                <li key={r.id}>
                  <Link to={`/invoices/${r.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50">
                    <div className="min-w-0">
                      <div className="font-medium">{r.invoice_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.leases?.tenants?.full_name ?? "—"} · {r.leases?.units?.properties?.name ?? ""} {r.leases?.units?.house_number ?? ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDate(r.period_start)} → {fmtDate(r.period_end)} · due {fmtDate(r.due_date)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{KES(r.total)}</div>
                      <div className="text-xs text-muted-foreground">Bal {KES(r.balance)}</div>
                    </div>
                    <Badge variant={r.status === "paid" ? "default" : r.status === "overdue" ? "destructive" : "secondary"}>{r.status}</Badge>
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
