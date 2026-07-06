import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, Plus, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

interface Row {
  user_id: string;
  email: string;
  role: string;
}

const schema = z.object({
  email: z.string().email("Valid email required"),
  role: z.enum(["caretaker", "accountant", "technician"]),
});
type FormValues = z.infer<typeof schema>;

export default function Team() {
  const { hasRole } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState(false);

  const reload = async () => {
    const { data, error } = await supabase.from("user_roles").select("user_id,role");
    if (error) {
      toast.error(error.message);
      setRows([]);
      return;
    }
    // Format data - we'll just show user_id as email since we don't have email in user_roles
    const formatted = (data ?? []).map((row: any) => ({
      user_id: row.user_id,
      email: row.user_id.substring(0, 13) + "...", // Show truncated UUID
      role: row.role,
    }));
    setRows(formatted);
  };

  useEffect(() => {
    document.title = "Team · MUSEMBI PMS";
    if (!hasRole(["super_admin", "landlord"])) return;
    void reload();
  }, [hasRole]);

  if (!hasRole(["super_admin", "landlord"])) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          You don&apos;t have access to team management.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Team &amp; Roles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create team members and assign roles for caretakers, accountants, and technicians.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1 h-4 w-4" /> Add member
            </Button>
          </DialogTrigger>
          <TeamDialog
            onCreated={() => {
              setOpen(false);
              void reload();
            }}
          />
        </Dialog>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> Role assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {rows.map((r) => (
                <li key={`${r.user_id}-${r.role}`} className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{r.email}</div>
                    <div className="text-xs text-muted-foreground">{r.user_id}</div>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {r.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeamDialog({ onCreated }: { onCreated: () => void }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const role = watch("role");

  const onSubmit = async (values: FormValues) => {
    try {
      // Call the backend function to create user and assign role
      const { data, error } = await supabase.functions.invoke("create-team-member", {
        body: {
          email: values.email,
          role: values.role,
        },
      });

      if (error) {
        toast.error(error.message || "Failed to create team member");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success(`${values.role} invitation sent to ${values.email}`);
      reset();
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>
            Invite a new team member and assign a role. They&apos;ll receive an email to set up their account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="caretaker@example.com"
              {...register("email")}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role" className="text-xs">
              Role
            </Label>
            <Select defaultValue="" onValueChange={(value) => register("role").onChange({ target: { value } })}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="caretaker">Caretaker</SelectItem>
                <SelectItem value="accountant">Accountant</SelectItem>
                <SelectItem value="technician">Technician</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
          </div>
          {role && (
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              {role === "caretaker" && (
                <span>Caretakers can manage properties, record payments, and track maintenance.</span>
              )}
              {role === "accountant" && (
                <span>Accountants can manage invoices, payments, and financial reports.</span>
              )}
              {role === "technician" && (
                <span>Technicians can view and update maintenance requests assigned to them.</span>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="mt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send invitation
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
