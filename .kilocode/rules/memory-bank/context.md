# Active Context: Urugendo

## Current State

**Status**: ✅ v2 - Role-Based Dashboards with Verification

The Urugendo app now has separate dashboards for passengers, agency managers, and drivers with enhanced verification features.

## Recently Completed

- [x] **Role-Based Login** - `/login` page with:
  - Phone number login for passengers
  - Email login for agencies/drivers
  - Quick demo buttons for each role
- [x] **Passenger App** - `/home` with:
  - City picker, search, popular routes
  - Live departures, AI chat
  - Login popup after 10 seconds
- [x] **Agency Dashboard** - `/agency` with:
  - Today/Schedule/Verify/Reports tabs
  - Revenue tracking (Urugendo vs Paper tickets)
  - Quick seat verification by seat number
  - Mark passengers as verified/unverified
- [x] **Driver Dashboard** - `/driver` with:
  - Current trip with live tracking
  - Passenger list with pending/verified sections
  - Verify button moves passengers to verified list
  - Stats show pending vs verified counts
- [x] **LoginPopup** - `/components/LoginPopup.tsx` - Bottom sheet with role options

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/layout.tsx` | Root layout with PhoneFrame wrapper | ✅ |
| `src/app/page.tsx` | Home screen | ✅ |
| `src/app/splash/page.tsx` | Splash/Onboarding | ✅ |
| `src/app/search/page.tsx` | Search results | ✅ |
| `src/app/seats/[tripId]/page.tsx` | Seat selection | ✅ |
| `src/app/payment/page.tsx` | Payment | ✅ |
| `src/app/ticket/[bookingId]/page.tsx` | Lightning Ticket | ✅ |
| `src/app/tickets/page.tsx` | My Tickets | ✅ |
| `src/app/profile/page.tsx` | Profile | ✅ |

## Build Verification

- `bun typecheck` ✅ passes
- `bun lint` ✅ passes  

## Session History

| Date | Changes |
|------|---------|
| 2026-03-27 | Full Urugendo v0 build |
| 2026-04-09 | Lightning Ticket v1: AMA-10 code, bus colors, live timer, anti-screenshot |

## Pitch Points for Agencies

**3 Biggest Agency Pain Points:**
1. Revenue Leakage - Drivers pocket roadside cash
2. Operational Chaos - "Fill-and-Go" delays  
3. Ticketing Fraud - Black market resellers

**Urugendo Solutions:**
1. Direct-to-bank MoMo split payments
2. Digital manifest for on-time departures
3. Device-bound tickets with anti-screenshot animations