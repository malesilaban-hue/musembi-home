import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Loader2, FilePlus2 } from "lucide-react";
import { QrDisplay } from "@/components/QrDisplay";
import { fmtDate, KES } from "@/lib/format";

interface Lease {
  id: string;
  tenant_id: string;
  unit_id: string;
  start_date: string;
  end_date: string | null;
  monthly_rent: number;
  deposit: number;
  water_charge: number;
  garbage_charge: number;
  parking_charge: number;
  service_charge: number;
  billing_day: number;
  status: string;
  qr_token: string;
  tenants: { full_name: string; phone: string } | null;
  units: { house_number: string; properties: { name: string } | null } | null;
}
interface Invoice {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  due_date: string;
  total: number;
  amount_paid: number;
  balance: number;
  status: string;
}

export default function LeaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, hasRole } = useAuth();
  const canManage = hasRole(["super_admin", "landlord", "accountant"]);
  const [lease, setLease] = useState<Lease | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [genOpen, setGenOpen] = useState(false);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    if (!id) return;
    const [l, i] = await Promise.all([
      supabase
        .from("leases")
        .select("*,tenants(full_name,phone),units(house_number,properties(name))")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("invoices")
        .select("id,invoice_number,period_start,period_end,due_date,total,amount_paid,balance,status")
        .eq("lease_id", id)
        .order("period_start", { ascending: false }),
    ]);
    if (l.error) toast.error(l.error.message);
    setLease(l.data as unknown as Lease | null);
    setInvoices((i.data as Invoice[]) ?? []);
  };

  useEffect(() => {
    document.title = "Lease · MUSEMBI PMS";
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const generateInvoice = async () => {
    if (!lease || !user) return;
    setGenerating(true);
    try {
      const [y, m] = period.split("-").map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 0));
      const due = new Date(Date.UTC(y, m - 1, Math.min(lease.billing_day || 1, 28)));
      const items = [
        { description: "Monthly rent", amount: Number(lease.monthly_rent) },
        { description: "Water", amount: Number(lease.water_charge) },
        { description: "Garbage", amount: Number(lease.garbage_charge) },
        { description: "Parking", amount: Number(lease.parking_charge) },
        { description: "Service charge", amount: Number(lease.service_charge) },
      ].filter((it) => it.amount > 0);
      const total = items.reduce((s, it) => s + it.amount, 0);

      const { data: numData, error: numErr } = await supabase.rpc("next_invoice_number");
      if (numErr) throw numErr;

      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .insert({
          invoice_number: numData as string,
          lease_id: lease.id,
          period_start: start.toISOString().slice(0, 10),
          period_end: end.toISOString().slice(0, 10),
          due_date: due.toISOString().slice(0, 10),
          subtotal: total,
          total,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (invErr) throw invErr;

      const { error: itemErr } = await supabase.from("invoice_items").insert(
        items.map((it) => ({
          invoice_id: inv.id,
          description: it.description,
          quantity: 1,
          unit_price: it.amount,
          amount: it.amount,
        })),
      );
      if (itemErr) throw itemErr;
      toast.success("Invoice generated");
      setGenOpen(false);
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  if (!lease) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const qrValue = `${window.location.origin}/l/${lease.qr_token}`;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/leases" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Leases
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {lease.tenants?.full_name} · Unit {lease.units?.house_number}
          </h1>
          <Badge variant={lease.status === "active" ? "default" : "secondary"}>{lease.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {lease.units?.properties?.name} · {fmtDate(lease.start_date)} → {lease.end_date ? fmtDate(lease.end_date) : "open"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Terms</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Info k="Rent" v={KES(lease.monthly_rent)} />
            <Info k="Deposit" v={KES(lease.deposit)} />
            <Info k="Water" v={KES(lease.water_charge)} />
            <Info k="Garbage" v={KES(lease.garbage_charge)} />
            <Info k="Parking" v={KES(lease.parking_charge)} />
            <Info k="Service" v={KES(lease.service_charge)} />
            <Info k="Billing day" v={String(lease.billing_day)} />
            <Info k="Tenant phone" v={lease.tenants?.phone ?? "—"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Lease QR</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <QrDisplay value={qrValue} />
            <p className="text-center text-xs text-muted-foreground">Scan to open lease</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Invoices</CardTitle>
          {canManage && (
            <Dialog open={genOpen} onOpenChange={setGenOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><FilePlus2 className="mr-1 h-4 w-4" /> Generate invoice</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate monthly invoice</DialogTitle>
                  <DialogDescription>Bills rent + charges for the selected month.</DialogDescription>
                </DialogHeader>
                <div className="mt-4 space-y-2">
                  <Label>Billing month</Label>
                  <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
                </div>
                <DialogFooter className="mt-6">
                  <Button onClick={generateInvoice} disabled={generating}>
                    {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {invoices.map((inv) => (
                <li key={inv.id}>
                  <Link to={`/invoices/${inv.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50">
                    <div>
                      <div className="font-medium">{inv.invoice_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDate(inv.period_start)} → {fmtDate(inv.period_end)} · due {fmtDate(inv.due_date)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{KES(inv.total)}</div>
                      <div className="text-xs text-muted-foreground">Bal {KES(inv.balance)}</div>
                    </div>
                    <Badge variant={inv.status === "paid" ? "default" : inv.status === "overdue" ? "destructive" : "secondary"}>
                      {inv.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}
