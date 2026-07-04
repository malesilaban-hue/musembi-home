import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime, KES } from "@/lib/format";

interface Row {
  id: string;
  receipt_number: string;
  amount: number;
  method: string;
  reference: string | null;
  paid_at: string;
  tenants: { full_name: string } | null;
}

export default function Payments() {
  const [items, setItems] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    document.title = "Payments · MUSEMBI PMS";
    (async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id,receipt_number,amount,method,reference,paid_at,tenants(full_name)")
        .order("paid_at", { ascending: false });
      if (error) return toast.error(error.message);
      setItems((data as unknown as Row[]) ?? []);
    })();
  }, []);

  const filtered = (items ?? []).filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.receipt_number.toLowerCase().includes(s) ||
      (r.tenants?.full_name ?? "").toLowerCase().includes(s) ||
      (r.reference ?? "").toLowerCase().includes(s)
    );
  });

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">All receipted payments across tenants.</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total shown</div>
          <div className="text-lg font-bold text-primary">{KES(total)}</div>
        </div>
      </header>

      <Input placeholder="Search receipt / tenant / reference…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />

      {items === null ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No payments</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {filtered.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="font-medium">{r.receipt_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.tenants?.full_name ?? "—"} · {fmtDateTime(r.paid_at)}
                      {r.reference ? ` · ${r.reference}` : ""}
                    </div>
                  </div>
                  <Badge variant="secondary">{r.method}</Badge>
                  <div className="text-right font-semibold">{KES(r.amount)}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
