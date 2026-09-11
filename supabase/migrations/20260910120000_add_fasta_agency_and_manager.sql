/*
 * Add Fasta agency and manager for pitch/demo purposes
 * Agency: Fasta
 * Manager: amani, code: MGR-002, password: manager@123
 * Password hash generated with salt 'urugendo-mgr-0000000000000002', 100000 iterations
 */

/* =========================================================================
 * 1. Add Fasta agency to operators table (if not exists)
 * ========================================================================= */
INSERT INTO public.operators (id, name, logo, gradient, emoji, rating, totalReviews, contactPhone, whatsappNumber, momoCode, momoAccountName, branches)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Fasta',
  '🚌',
  'linear-gradient(135deg, #FF6B1A, #FF8800)',
  '🚌',
  4.8,
  120,
  '+250 788 888 888',
  '+250 788 888 888',
  'FASTA001',
  'Fasta Mobile Money',
  ARRAY['Kigali', 'Nyagatare', 'Gicumbi', 'Huye']
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name;

/* =========================================================================
 * 2. Add Fasta manager to agency_managers table
 * ========================================================================= */
INSERT INTO public.agency_managers (
  id, name, email, manager_code, agency_name, password_hash, password_salt, password_iter, is_active, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000005',
  'amani',
  'manager@fasta.com',
  'MGR-002',
  'Fasta',
  '/AFpymDUZexgJmXHByhMU2E4MBu8n8OKKiJm93ZjHfi0CO2SeKBKG1qeQOqI36UwqcTgzkXigOY4q7G1Vn7kyw==',
  'urugendo-mgr-0000000000000002',
  100000,
  true,
  now(),
  now()
)
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name,
    manager_code = EXCLUDED.manager_code,
    agency_name = EXCLUDED.agency_name,
    password_hash = EXCLUDED.password_hash,
    password_salt = EXCLUDED.password_salt,
    password_iter = EXCLUDED.password_iter,
    updated_at = now();

/* =========================================================================
 * 3. Ensure branches for Fasta exist
 * ========================================================================= */
INSERT INTO public.branches (id, name, location, momo_code, phone, agent_name, agent_email, stats, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000006', 'Kigali', 'Kigali City', 'FASTA001', '+250 788 111 111', 'John Doe', 'john@fasta.com', '{"today":{"passengers":0,"revenue":0},"monthly":{"passengers":0,"revenue":0},"yearly":{"passengers":0,"revenue":0}}', now()),
  ('00000000-0000-0000-0000-000000000007', 'Nyagatare', 'Nyagatare District', 'FASTA001', '+250 788 222 222', 'Jane Smith', 'jane@fasta.com', '{"today":{"passengers":0,"revenue":0},"monthly":{"passengers":0,"revenue":0},"yearly":{"passengers":0,"revenue":0}}', now()),
  ('00000000-0000-0000-0000-000000000008', 'Gicumbi', 'Gicumbi District', 'FASTA001', '+250 788 333 333', 'Bob Johnson', 'bob@fasta.com', '{"today":{"passengers":0,"revenue":0},"monthly":{"passengers":0,"revenue":0},"yearly":{"passengers":0,"revenue":0}}', now()),
  ('00000000-0000-0000-0000-000000000009', 'Huye', 'Huye District', 'FASTA001', '+250 788 444 444', 'Alice Williams', 'alice@fasta.com', '{"today":{"passengers":0,"revenue":0},"monthly":{"passengers":0,"revenue":0},"yearly":{"passengers":0,"revenue":0}}', now())
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    location = EXCLUDED.location,
    momo_code = EXCLUDED.momo_code,
    phone = EXCLUDED.phone,
    agent_name = EXCLUDED.agent_name,
    agent_email = EXCLUDED.agent_email,
    stats = EXCLUDED.stats,
    updated_at = now();