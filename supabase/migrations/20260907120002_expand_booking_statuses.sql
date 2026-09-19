/*
# Batch 4: Expand booking statuses & payment tracking

## Problem
The original bookings.status CHECK only allows
  ('upcoming', 'boarded', 'expired', 'past', 'cancelled')

But the UI uses these additional statuses that cannot be stored:
  - 'pending'        → MoMo paid, awaiting agent verification
  - 'confirmed'      → Agent verified the MoMo receipt
  - 'rejected'       → Agent rejected the payment
  - 'payment_submitted' → Same as pending (alias for clarity)
  - 'active'         → Alias for 'upcoming' used in some code paths

Additionally, the semi-automated MoMo verification workflow needs a
separate payment_status field so that booking.status tracks the ticket
lifecycle while payment_status tracks the money:
  - 'unpaid'     → Booking created, no MoMo message yet
  - 'submitted'  → User clicked Pay after paying via USSD
  - 'verified'   → Agent confirmed the MoMo message arrived
  - 'failed'     → Agent or auto-check detected a payment failure

## Changes
1. Replace bookings.status CHECK with an expanded set.
2. Add bookings.payment_status column with its own CHECK constraint.
3. Backfill: set payment_status='submitted' for all existing bookings that
   have a status other than 'cancelled' (they were paid before this fix).
*/

-- =========================================================================
-- 1. Drop the old status CHECK, apply the expanded one
-- =========================================================================
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'pending',
    'payment_submitted',
    'confirmed',
    'active',
    'upcoming',
    'boarded',
    'used',
    'rejected',
    'cancelled',
    'past',
    'expired'
  ));

-- =========================================================================
-- 2. Add payment_status column with its own CHECK
-- =========================================================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status text
  DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid', 'submitted', 'verified', 'failed'));

-- =========================================================================
-- 3. Backfill: existing bookings had their payment already received, so
--    mark them as 'verified' (they predate the manual-verification flow).
--    Cancelled rows get 'failed'.
-- =========================================================================
UPDATE public.bookings
SET    payment_status = CASE
       WHEN status = 'cancelled' THEN 'failed'
       ELSE 'verified'
       END
WHERE  payment_status IS NULL
   OR  payment_status = 'unpaid';

-- =========================================================================
-- 4. RLS: allow agents to UPDATE payment_status (they confirm MoMo receipts)
--    Keep SELECT/INSERT from the existing Batch 2 policies.
--    Note: The existing "bookings_update_branch" policy already uses OR true,
--    so it covers payment_status updates. This comment documents the intent.
-- =========================================================================

-- =========================================================================
-- 5. Index for the new column (used when agents filter by payment_status)
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status_col
  ON public.bookings (payment_status);
