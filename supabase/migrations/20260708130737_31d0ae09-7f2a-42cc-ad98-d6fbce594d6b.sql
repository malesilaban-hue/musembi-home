DROP TRIGGER IF EXISTS trg_auto_allocate_payment ON public.payments;
DROP TRIGGER IF EXISTS trg_alloc_recompute ON public.payment_allocations;
DROP TRIGGER IF EXISTS trg_recompute_invoice_paid ON public.payment_allocations;