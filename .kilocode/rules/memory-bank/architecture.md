# System Architecture: Urugendo

## Overview

Next.js 16 App Router application with client-side state management for a bus ticket booking platform.

## File Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout: PhoneFrame + BottomNav + RugendoChat + CityPicker
│   ├── page.tsx            # Home screen (/)
│   ├── globals.css         # Tailwind CSS 4 with design tokens
│   ├── splash/page.tsx     # Splash/Onboarding screen
│   ├── search/page.tsx     # Search results
│   ├── seats/[tripId]/page.tsx  # Seat selection (dynamic)
│   ├── payment/page.tsx    # Payment flow
│   ├── ticket/[bookingId]/page.tsx  # E-ticket confirmation (dynamic)
│   ├── tickets/page.tsx    # My Tickets
│   └── profile/page.tsx    # Profile
├── components/
│   ├── PhoneFrame.tsx      # iPhone 15 Pro frame wrapper (390×844px)
│   ├── BottomNav.tsx       # 4-tab bottom navigation with Framer Motion
│   ├── RugendoFAB.tsx      # Green FAB button for AI chat
│   ├── RugendoChat.tsx     # AI chat bottom sheet
│   └── CityPicker.tsx      # City selection bottom sheet
├── context/
│   └── app-context.tsx     # Global state (search, bookings, chat, language)
└── lib/
    ├── types.ts            # TypeScript interfaces
    ├── data.ts             # Cities, operators, routes, mock trip generation
    └── chat.ts             # Smart reply logic for Rugendo AI
```

## Key Patterns

### PhoneFrame
- Wraps ALL content in a persistent iPhone 15 Pro frame (390×844px)
- 9px bezel (#111111), Dynamic Island (118×33px black pill)
- Desktop: centered on #0F0F0F background
- Never hidden at any breakpoint

### State Management
- React Context (AppProvider) for all global state
- No external state library (Zustand, Redux, etc.)
- State includes: search params, selected trip/seat, bookings, chat messages, language

### Bottom Sheets
- vaul Drawer component for CityPicker and RugendoChat
- Custom animated sheets with spring physics (NOT using vaul, using Framer Motion directly for full control)

### Animations
- All via Framer Motion
- Screen transitions: slideInRight/slideOutLeft
- Cards: fadeInUp staggered
- Nav: layoutId pill animation
- Buttons: scale on press

### Styling
- Tailwind CSS 4 with @theme for design tokens
- Custom colors: primary (#00B85C), accent (#F59E0B), text hierarchy
- Zero box-shadow on all elements except PhoneFrame
- Plus Jakarta Sans font via next/font/google

## Tech Stack

| Tech | Version | Purpose |
|------|---------|---------|
| Next.js | 16.x | Framework (App Router) |
| React | 19.x | UI |
| TypeScript | 5.9.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| Framer Motion | 12.x | Animations |
| Lucide React | 0.462 | Icons |
| vaul | 1.1.x | Bottom sheets |
| date-fns | 4.x | Date formatting |
| Bun | Latest | Package manager |
