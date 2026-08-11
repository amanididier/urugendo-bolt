# Product Context: Urugendo

## Why This Exists

Rwanda has no cross-operator bus booking platform. Each bus company operates in isolation, forcing passengers to physically queue at Nyabugogo terminal. Urugendo aggregates all operators into one app.

## User Flow

1. User opens app → sees splash with Rwanda landscape
2. Taps "Get Started" → arrives at Home
3. Selects FROM/TO cities via City Picker sheet
4. Taps "Search Buses" → sees filtered results with times, prices, amenities
5. Taps "Select" → views bus seat map, picks a seat
6. Taps "Pay" → reviews order, selects MTN MoMo/Airtel
7. Confirms payment → receives QR e-ticket
8. Can view all tickets in "My Tickets" tab

## UX Goals

- Mobile-first: entire app fits in 390×844 iPhone frame
- Fast booking: < 60 seconds from search to confirmation
- Visual seat selection: interactive bus diagram
- AI assistant: "Rugendo" helps with routes, prices, booking
- Premium feel: clean white design, no shadows, minimal color

## Key Experience Decisions

- Green (#00B85C) ONLY on CTAs, prices, active states — never backgrounds
- Cards use borders only, zero shadows
- Plus Jakarta Sans font throughout
- All animations via Framer Motion — fast and purposeful
- Bottom sheets via vaul for iOS-style swipe-to-close

## AI Assistant: Rugendo

Named "Rugendo" (not Rodi). Introduces: "Muraho! Nitwa Rugendo 🚌"
Smart replies for: route queries, cheapest bus, next departure, booking help, greetings.
Entry: green FAB button bottom-right of screen.
