# Project Brief: Urugendo — Rwanda's Bus Ticket Aggregator

## Purpose

Urugendo (Kinyarwanda: 'Journey') is Rwanda's first bus ticket aggregator. Passengers search, compare, and book seats across Volcano Express, RITCO, Trinity Express, and Virunga Express from a single mobile-first app.

## The Problem

- 30-90 minute physical queues at Nyabugogo terminal
- No real-time visibility of seats, schedules, or prices across operators
- Cash-only — no digital booking exists
- No cross-operator platform — each app is siloed to one company

## The Solution

- Single platform aggregating all operators — search once, compare all
- Real-time seat selection with visual bus diagram
- MTN Mobile Money and Airtel Money payments
- Instant QR e-ticket — show phone to board
- AI assistant 'Rugendo' available 24/7 in-app

## Business Model

2-5% commission per completed booking. Operator wins: reduced queues, higher fill rates. Urugendo wins: earns only when operators earn — aligned incentives.

## Key Requirements

- iPhone 15 Pro frame wrapping entire app (390×844px)
- Primary green #00B85C only on: CTAs, active nav, prices, selected seat, avatar
- Plus Jakarta Sans font
- Zero shadows on cards — border only (1px #E4E4E7)
- Framer Motion for all animations
- vaul drawer for bottom sheets (city picker, AI chat)

## Screens

1. Splash/Onboarding (/splash) — Rwanda landscape photo background
2. Home (/) — Search card, popular routes, live departures
3. Search Results (/search) — Filter chips, bus cards with times/prices
4. Seat Selection (/seats/[tripId]) — Visual bus diagram, seat picker
5. Payment (/payment) — Order summary, MTN/Airtel payment
6. Booking Confirmed (/ticket/[bookingId]) — QR e-ticket
7. My Tickets (/tickets) — Upcoming/Past/Cancelled tabs
8. Profile (/profile) — Stats, menu items

## Rwanda Data

- 8 cities: Kigali, Musanze, Huye, Rubavu, Nyanza, Rwamagana, Byumba, Cyangugu
- 4 operators: Volcano Express, RITCO, Trinity Express, Virunga Express
- Currency: RWF (format: "3,500 RWF")
- Payments: MTN Mobile Money (primary), Airtel Money, Bank Card (coming soon)

## Author

Amanididier + Claude AI · Kigali, Rwanda · Built with love for Rwanda's travellers
