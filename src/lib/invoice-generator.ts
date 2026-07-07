import { supabase } from "@/integrations/supabase/client";

/**
 * Generate monthly invoices for all active leases
 * Should be called daily or on demand from the dashboard
 */
export async function generateMonthlyInvoices() {
  try {
    const { data, error } = await supabase
      .rpc("generate_monthly_invoices");
    
    if (error) throw error;
    
    return {
      success: true,
      created: data?.length ?? 0,
      invoices: data ?? [],
    };
  } catch (err) {
    console.error("Invoice generation failed:", err);
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
