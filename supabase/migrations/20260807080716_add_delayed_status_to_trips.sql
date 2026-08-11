-- Allow 'delayed' as a valid trip status (for the Mark as Delayed feature)
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_status_check;
ALTER TABLE public.trips ADD CONSTRAINT trips_status_check
  CHECK (status IN ('scheduled', 'boarding', 'departed', 'arrived', 'cancelled', 'delayed'));
