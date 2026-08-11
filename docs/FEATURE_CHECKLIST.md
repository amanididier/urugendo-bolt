# URUGENDO - Full Feature Checklist

## V0 (Pilot - 2 Weeks Trial) ✅ COMPLETE

### Core Booking Flow
- [x] Search buses (departure → destination)
- [x] Current location button (GPS)
- [x] Home page with popular routes
- [x] Live departures (top 3 routes)
- [x] Search results with all buses
- [x] Filter by earliest/cheapest/amenities
- [x] Seat selection (visual seat map)
- [x] Payment (MTN MoMo, Airtel Money)
- [x] Digital ticket with unique code
- [x] Download ticket PDF (working)
- [x] Share ticket via WhatsApp

### Authentication
- [x] Phone login (passengers)
- [x] Email login (drivers/agents)
- [x] Quick demo buttons
- [x] Role-based navigation

### Ticket Features
- [x] QR-style booking code
- [x] Live countdown timer
- [x] Bus/plate information
- [x] Terminal/gate info
- [x] Status: upcoming/boarded/completed

---

## V1 (Full Launch Features) ✅ MOSTLY COMPLETE

### Driver Dashboard
- [x] Today's assignment card
- [x] Passenger list (pending/verified)
- [x] Verify passengers (tap to mark)
- [x] Live map tracking (OpenStreetMap - FREE!)
- [x] Manifest PDF generation

### Agency Dashboard
- [x] Today's bookings count
- [x] Revenue tracking
- [x] Urugendo vs Paper tickets
- [x] Schedule management
- [x] Reports generation
- [x] Seat verification by number
- [x] Quick passenger entry

### Map & Tracking
- [x] Free OpenStreetMap (no API key needed)
- [x] Bus location marker
- [x] Route path visualization
- [x] Terminal markers
- [x] Passenger live tracking view

### Points System (Basic)
- [x] Points display on profile
- [x] Points earning history
- [x] Redeem options

---

## V2 (Advanced Features) 🚧 TO IMPLEMENT

### Mid-Way Pickup System
- [ ] Book from current location
- [ ] Select pickup point on map
- [ ] See buses passing nearby
- [ ] Reserve seat mid-route
- [ ] Notify driver of pickup
- [ ] Mid-way passenger list

### Real-Time GPS Tracking
- [ ] User allows location sharing
- [ ] Use multiple user locations
- [ ] Calculate bus position
- [ ] Show crowd-sourced tracking
- [ ] Backup GPS when driver offline

### Check-In/Check-Out System
- [ ] Check-in button (station)
- [ ] Auto check-in at departure
- [ ] Check-out at destination
- [ ] Mid-way check-out
- [ ] Points for checking out

### Points System (Full)
- [ ] Points for check-out
- [ ] Points for bus location helper
- [ ] Discount on booking fee
- [ ] Free trip redemption
- [ ] Driver gets points too

### Notifications
- [ ] 30 min before departure
- [ ] 10 min before departure
- [ ] 5 min before departure
- [ ] Bus started notification
- [ ] Mid-way pickup alert way

### User Profiles
- [ ] Upload profile picture
- [ ] Saved passengers
- [ ] Payment methods saved
- [ ] Travel history

### Agency Reports
- [ ] Download Excel report
- [ ] Share via WhatsApp
- [ ] Send to driver
- [ ] Print manifest

---

## Technical Features 🚧 TO BE ADDED

### Location Services
- [ ] Get user GPS location
- [ ] Calculate distance/time
- [ ] Find nearby buses
- [ ] Location-based search

### Push Notifications (V2)
- [ ] Browser notifications
- [ ] In-app notifications
- [ ] Reminder system

### QR Code (V2)
- [ ] Real QR code on ticket
- [ ] Scan to verify
- [ ] Agent scanning

---

## Current Build Status

| Feature | Status |
|---------|--------|
| Search | ✅ |
| Payment | ✅ |
| Ticket PDF | ✅ |
| Driver Map | ✅ |
| Agency Dashboard | ✅ |
| Points (Basic) | ✅ |
| Login (All roles) | ✅ |
| Mid-way pickup | ❌ |
| Check-in/out | ❌ |
| Crowd GPS | ❌ |
| Notifications | ❌ |

---

## What's Working Now

1. **Passenger flow**: Search → Select Bus → Choose Seat → Pay → Download Ticket
2. **Driver view**: See passengers, verify them, view map
3. **Agency view**: See bookings, revenue, manage schedule
4. **Map**: Free OpenStreetMap anywhere

## What's Next (Priority Order)

1. **Mid-way pickup** - Book from road
2. **Check-out system** - Track trip completion
3. **Points system** - Reward users
4. **Notifications** - Remind users