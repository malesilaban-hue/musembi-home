import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Settings as SettingsIcon, Save } from "lucide-react";
import { toast } from "sonner";

interface AppSettings {
  overdue_grace_days: number;
  default_due_day: number;
  business_name: string | null;
  business_kra_pin: string | null;
  business_address: string | null;
  business_phone: string | null;
  business_email: string | null;
}

const defaults: AppSettings = {
  overdue_grace_days: 5,
  default_due_day: 5,
  business_name: "",
  business_kra_pin: "",
  business_address: "",
  business_phone: "",
  business_email: "",
};

export default function Settings() {
  const { hasRole } = useAuth();
  const canEdit = hasRole(["super_admin", "landlord"]);
  const [s, setS] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Settings · MUSEMBI PMS";
    (async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select(
          "overdue_grace_days,default_due_day,business_name,business_kra_pin,business_address,business_phone,business_email",
        )
        .eq("id", true)
        .maybeSingle();
      if (error) toast.error(error.message);
      setS({ ...defaults, ...(data ?? {}) });
    })();
  }, []);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({
        overdue_grace_days: s.overdue_grace_days,
        default_due_day: s.default_due_day,
        business_name: s.business_name || null,
        business_kra_pin: s.business_kra_pin || null,
        business_address: s.business_address || null,
        business_phone: s.business_phone || null,
        business_email: s.business_email || null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", true);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  };

  if (!s) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const disabled = !canEdit;

  const upd = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    setS({ ...s, [k]: v });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <SettingsIcon className="h-6 w-6" /> Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Global rules for invoices, receipts and overdue detection.
        </p>
      </header>

      {!canEdit && (
        <Card className="border-dashed">
          <CardContent className="py-3 text-xs text-muted-foreground">
            You have read-only access. Only super admins and landlords can edit.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing rules</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Overdue grace days</Label>
            <Input
              type="number"
              min={0}
              max={60}
              disabled={disabled}
              value={s.overdue_grace_days}
              onChange={(e) => upd("overdue_grace_days", Number(e.target.value))}
            />
            <p className="text-[11px] text-muted-foreground">
              Days past due date before an invoice is marked overdue.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Default rent due day</Label>
            <Input
              type="number"
              min={1}
              max={28}
              disabled={disabled}
              value={s.default_due_day}
              onChange={(e) => upd("default_due_day", Number(e.target.value))}
            />
            <p className="text-[11px] text-muted-foreground">
              Day of the month rent is due (used when generating invoices).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business details (invoices & receipts)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Business name</Label>
            <Input
              disabled={disabled}
              value={s.business_name ?? ""}
              onChange={(e) => upd("business_name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">KRA PIN</Label>
            <Input
              disabled={disabled}
              value={s.business_kra_pin ?? ""}
              onChange={(e) => upd("business_kra_pin", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Address</Label>
            <Input
              disabled={disabled}
              value={s.business_address ?? ""}
              onChange={(e) => upd("business_address", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone</Label>
            <Input
              disabled={disabled}
              value={s.business_phone ?? ""}
              onChange={(e) => upd("business_phone", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              disabled={disabled}
              value={s.business_email ?? ""}
              onChange={(e) => upd("business_email", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save settings
          </Button>
        </div>
      )}
    </div>
  );
}
