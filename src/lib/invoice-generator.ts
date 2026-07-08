import { supabase } from "@/integrations/supabase/client";

/**
 * Generate monthly invoices for all active leases
 * Should be called daily or on demand from the dashboard
 */
export async function generateMonthlyInvoices() {
  try {
    // New idempotent RPC: creates one current-month invoice per active lease,
    // skipping any lease that already has one this month.
    const { data: createdCount, error } = await supabase.rpc(
      "generate_current_month_invoices" as never,
    );
    if (error) throw new Error(error.message || "Failed to generate invoices");

    // Also remove any duplicate current-month invoices left behind by prior runs.
    const { data: removedCount } = await supabase.rpc(
      "dedupe_current_month_invoices" as never,
    );

    return {
      success: true,
      created: Number(createdCount ?? 0),
      duplicatesRemoved: Number(removedCount ?? 0),
      message: "" as string,
    };
  } catch (err) {
    console.error("Invoice generation failed:", err);
    throw err;
  }
}

/**
 * Simple version - just tries to generate without complex logic
 * Useful if the main function has issues
 */
export async function simpleGenerateInvoices() {
  try {
    // Call the RPC directly with minimal parameters
    const { data, error } = await supabase
      .from("leases")
      .select("id, monthly_rent, billing_day, status")
      .eq("status", "active");
    
    if (error) throw error;

    // For now just show how many active leases we have
    return {
      success: true,
      activeLeases: data?.length ?? 0,
      message: `Found ${data?.length ?? 0} active leases. Run migrations first.`,
    };
  } catch (err) {
    console.error("Simple generation failed:", err);
    throw err;
  }
}

/**
 * Calculate outstanding amount for a lease
 */
export function calculateOutstanding(invoices: any[]): number {
  return invoices
    .filter(inv => inv.status === 'unpaid')
    .reduce((sum, inv) => sum + (inv.balance ?? 0), 0);
}

/**
 * Get outstanding invoices count
 */
export function getOutstandingCount(invoices: any[]): number {
  return invoices.filter(inv => inv.status === 'unpaid').length;
}
