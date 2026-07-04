import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Wallet, Printer } from "lucide-react";
import { fmtDate, fmtDateTime, KES } from "@/lib/format";

interface Invoice {
  id: string;
  invoice_number: string;
  lease_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  subtotal: number;
  total: number;
  amount_paid: number;
  balance: number;
  status: string;
  notes: string | null;
  leases: {
    tenant_id: string;
    tenants: { full_name: string; phone: string } | null;
    units: { house_number: string; properties: { name: string } | null } | null;
  } | null;
}
interface Item { id: string; description: string; quantity: number; unit_price: number; amount: number }
interface Allocation {
  id: string;
  amount: number;
  payments: { receipt_number: string; method: string; paid_at: string } | null;
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, hasRole } = useAuth();
  const canPay = hasRole(["super_admin", "landlord", "accountant", "caretaker"]);
  const [inv, setInv] = useState<Invoice | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [allocs, setAllocs] = useState<Allocation[]>([]);
  const [payOpen, setPayOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    const [i, li, al] = await Promise.all([
      supabase
        .from("invoices")
        .select("*,leases(tenant_id,tenants(full_name,phone),units(house_number,properties(name)))")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("invoice_items").select("*").eq("invoice_id", id).order("created_at"),
      supabase
        .from("payment_allocations")
        .select("id,amount,payments(receipt_number,method,paid_at)")
        .eq("invoice_id", id)
        .order("created_at"),
    ]);
    if (i.error) toast.error(i.error.message);
    setInv(i.data as unknown as Invoice | null);
    setItems((li.data as Item[]) ?? []);
    setAllocs((al.data as unknown as Allocation[]) ?? []);
  };

  useEffect(() => {
    document.title = "Invoice · MUSEMBI PMS";
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!inv) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Invoices
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{inv.invoice_number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {inv.leases?.tenants?.full_name} · {inv.leases?.units?.properties?.name} unit {inv.leases?.units?.house_number}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print
          </Button>
          {canPay && Number(inv.balance) > 0 && (
            <Dialog open={payOpen} onOpenChange={setPayOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Wallet className="mr-1 h-4 w-4" /> Record payment</Button>
              </DialogTrigger>
              <PayDialog
                invoice={inv}
                userId={user!.id}
                onDone={() => { setPayOpen(false); void load(); }}
              />
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Line items</CardTitle>
            <Badge variant={inv.status === "paid" ? "default" : inv.status === "overdue" ? "destructive" : "secondary"}>{inv.status}</Badge>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="pb-2">Description</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Price</th><th className="pb-2 text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2">{it.description}</td>
                    <td className="py-2 text-right">{it.quantity}</td>
                    <td className="py-2 text-right">{KES(it.unit_price)}</td>
                    <td className="py-2 text-right">{KES(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr><td colSpan={3} className="pt-3 text-right text-muted-foreground">Total</td><td className="pt-3 text-right font-semibold">{KES(inv.total)}</td></tr>
                <tr><td colSpan={3} className="text-right text-muted-foreground">Paid</td><td className="text-right">{KES(inv.amount_paid)}</td></tr>
                <tr><td colSpan={3} className="text-right text-muted-foreground">Balance</td><td className="text-right font-bold text-primary">{KES(inv.balance)}</td></tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Info k="Period" v={`${fmtDate(inv.period_start)} → ${fmtDate(inv.period_end)}`} />
            <Info k="Due date" v={fmtDate(inv.due_date)} />
            <Info k="Tenant phone" v={inv.leases?.tenants?.phone ?? "—"} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Payments applied</CardTitle></CardHeader>
        <CardContent className="p-0">
          {allocs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No payments applied yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {allocs.map((a) => (
                <li key={a.id} className="flex items-center justify-between p-4 text-sm">
                  <div>
                    <div className="font-medium">{a.payments?.receipt_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.payments?.method} · {fmtDateTime(a.payments?.paid_at)}
                    </div>
                  </div>
                  <div className="font-semibold">{KES(a.amount)}</div>
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

function PayDialog({
  invoice,
  userId,
  onDone,
}: {
  invoice: Invoice;
  userId: string;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState<string>(String(invoice.balance));
  const [method, setMethod] = useState<string>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) return toast.error("Amount must be positive");
    if (amt > Number(invoice.balance)) return toast.error("Amount exceeds balance");
    if (!invoice.leases) return;
    setBusy(true);
    try {
      const { data: rn, error: rnErr } = await supabase.rpc("next_receipt_number");
      if (rnErr) throw rnErr;
      const { data: pay, error: payErr } = await supabase
        .from("payments")
        .insert({
          receipt_number: rn as string,
          tenant_id: invoice.leases.tenant_id,
          lease_id: invoice.lease_id,
          amount: amt,
          method: method as never,
          reference: reference || null,
          notes: notes || null,
          recorded_by: userId,
        })
        .select("id")
        .single();
      if (payErr) throw payErr;
      const { error: allocErr } = await supabase
        .from("payment_allocations")
        .insert({ payment_id: pay.id, invoice_id: invoice.id, amount: amt });
      if (allocErr) throw allocErr;
      toast.success(`Payment recorded (${rn})`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription>Balance due: {KES(invoice.balance)}</DialogDescription>
      </DialogHeader>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Amount (KES)</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["cash", "cheque", "bank_transfer", "mpesa", "other"].map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Reference (M-Pesa code, cheque no.)</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <DialogFooter className="mt-6">
        <Button onClick={submit} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save payment
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
