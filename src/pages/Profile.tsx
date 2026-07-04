import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?\d{9,15}$/i, "Enter a valid phone")
    .optional()
    .or(z.literal("")),
});
type Values = z.infer<typeof schema>;

export default function Profile() {
  const { user, roles } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    document.title = "Profile · MUSEMBI PMS";
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name,phone")
        .eq("id", user.id)
        .maybeSingle();
      reset({ full_name: data?.full_name ?? "", phone: data?.phone ?? "" });
      setLoaded(true);
    })();
  }, [user, reset]);

  const onSubmit = async (v: Values) => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, full_name: v.full_name, phone: v.phone || null });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update your personal details.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1 text-sm">
            <div>
              <span className="text-muted-foreground">Email: </span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Roles: </span>
              <span className="font-medium">{roles.join(", ") || "unassigned"}</span>
            </div>
          </div>

          {loaded && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="pf-name">Full name</Label>
                <Input id="pf-name" {...register("full_name")} />
                {errors.full_name && (
                  <p className="text-xs text-destructive">{errors.full_name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-phone">Phone</Label>
                <Input id="pf-phone" placeholder="+2547..." {...register("phone")} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
