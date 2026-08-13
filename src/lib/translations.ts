import { Language } from './types';

type TranslationKey =
  // Home
  | 'greeting'
  | 'whereTo'
  | 'from'
  | 'fromPlaceholder'
  | 'to'
  | 'toPlaceholder'
  | 'searchBuses'
  | 'popularRoutes'
  | 'seeAll'
  | 'liveDepartures'
  | 'live'
  | 'seats'
  | 'rugendoSays'
  | 'rugendoHelp'
  | 'cities'
  | 'operators'
  | 'madeWith'
  // Search
  | 'busesFound'
  | 'perSeat'
  | 'select'
  | 'noRoute'
  | 'goBackHome'
  | 'backToHome'
  // Seats
  | 'available'
  | 'taken'
  | 'yourPick'
  | 'seat'
  | 'total'
  | 'pay'
  // Payment
  | 'payment'
  | 'almostThere'
  | 'route'
  | 'dateTime'
  | 'operator'
  | 'baseFare'
  | 'bookingFee'
  | 'paymentMethod'
  | 'recommended'
  | 'comingSoon'
  | 'security'
  // Ticket
  | 'bookingConfirmed'
  | 'eTicketReady'
  | 'from2'
  | 'to2'
  | 'date'
  | 'time'
  | 'passenger'
  | 'downloadTicket'
  | 'shareTicket'
  | 'backHome'
  // Tickets page
  | 'myTickets'
  | 'manageTickets'
  | 'upcoming'
  | 'past'
  | 'cancelled'
  | 'noUpcoming'
  | 'noPast'
  | 'noCancelled'
  // Profile
  | 'totalTrips'
  | 'rating'
  | 'savedPassengers'
  | 'paymentMethods'
  | 'notifications'
  | 'language'
  | 'helpSupport'
  | 'logout'
  // Chat
  | 'rugendo'
  | 'online'
  | 'askRugendo'
  | 'rugendoWelcome1'
  | 'rugendoWelcome2'
  | 'suggestion1'
  | 'suggestion2'
  | 'suggestion3'
  | 'suggestion4'
  // Splash
  | 'tagline'
  | 'getStarted'
  | 'orContinue'
  | 'noAccount'
  | 'createOne'
  // City Picker
  | 'selectDeparture'
  | 'selectDestination'
  // Seats extra
  | 'noTrip'
  | 'driver'
  | 'searchBuses2'
  // Payment extra
  | 'noBooking'
  | 'mtnMomo'
  | 'airtelMoney'
  | 'bankCard'
  | 'processing'
  | 'totalLabel';

const translations: Record<TranslationKey, { EN: string; RW: string }> = {
  // Home
  greeting: { EN: 'Muraho 👋', RW: 'Muraho 👋' },
  whereTo: { EN: 'Where to today?', RW: 'Ugiye he uyu munsi?' },
  from: { EN: 'From', RW: 'Kuva' },
  fromPlaceholder: { EN: 'From (e.g. Kigali)', RW: 'Kuva (urugero: Kigali)' },
  to: { EN: 'To', RW: 'Kujya' },
  toPlaceholder: { EN: 'To (e.g. Musanze)', RW: 'Kujya (urugero: Musanze)' },
  searchBuses: { EN: 'Search Buses', RW: 'Shakisha Bisi' },
  popularRoutes: { EN: 'Popular Routes', RW: 'Inzira Zikunda' },
  seeAll: { EN: 'See all', RW: 'Reba byose' },
  liveDepartures: { EN: 'Live Departures', RW: 'Gusohoka Mu Gihe' },
  live: { EN: 'Live', RW: 'Ubuzima' },
  seats: { EN: 'seats', RW: 'intebe' },
  rugendoSays: { EN: 'Rugendo says hi! 👋', RW: 'Rugendo aguhamya! 👋' },
  rugendoHelp: { EN: 'Ask me about routes, prices, or booking help', RW: 'Mbazanye ku nzira, ibiciro, cyangwa ubufasha bwo gutumiza' },
  cities: { EN: '8 Cities', RW: 'Umudugudu 8' },
  operators: { EN: '4 Operators', RW: 'Abakozi 4' },
  madeWith: { EN: "Made with 💚 for Rwanda's travellers", RW: "Yakozwe n'💚 ku bagenzi b'u Rwanda" },

  // Search
  busesFound: { EN: 'buses found today', RW: 'bisi zabonetse uyu munsi' },
  perSeat: { EN: 'per seat', RW: 'kuri buri intebe' },
  select: { EN: 'Select', RW: 'Hitamo' },
  noRoute: { EN: 'No route selected', RW: 'Nta nzira wahisemo' },
  goBackHome: { EN: 'Go back to Home and select your departure and destination cities', RW: 'Subira ahande uhitemo umudugu wo kuvayo no kujyayo' },
  backToHome: { EN: 'Back to Home', RW: 'Subira Ahande' },

  // Seats
  available: { EN: 'Available', RW: 'Ihari' },
  taken: { EN: 'Taken', RW: 'Yafashwe' },
  yourPick: { EN: 'Your pick', RW: 'Wahisemo' },
  seat: { EN: 'Seat', RW: 'Intebe' },
  total: { EN: 'Total', RW: 'Igiteranyo' },
  pay: { EN: 'Pay', RW: 'Ishyura' },

  // Payment
  payment: { EN: 'Payment', RW: 'Kwishyura' },
  almostThere: { EN: "Almost there! 🎉", RW: 'Hafi kugera! 🎉' },
  route: { EN: 'Route', RW: 'Inzira' },
  dateTime: { EN: 'Date & Time', RW: 'Itariki n\'Isaha' },
  operator: { EN: 'Operator', RW: 'Umukozi' },
  baseFare: { EN: 'Base Fare', RW: 'Ikiguzi' },
  bookingFee: { EN: 'Booking Fee', RW: 'Ikiguzi cyo Gutumiza' },
  paymentMethod: { EN: 'Payment Method', RW: 'Uburyo bwo Kwishyura' },
  recommended: { EN: 'Recommended', RW: 'Byasabwe' },
  comingSoon: { EN: 'Coming soon', RW: 'Biraza vuba' },
  security: { EN: '256-bit encrypted · Safe & secure', RW: 'Birinzwe 256-bit · Birinzwe neza' },

  // Ticket
  bookingConfirmed: { EN: 'Booking Confirmed!', RW: 'Gutumiza Byemejwe!' },
  eTicketReady: { EN: 'Your e-ticket is ready', RW: 'Ikarita yawe yelekironike iri gutegure' },
  from2: { EN: 'From', RW: 'Kuva' },
  to2: { EN: 'To', RW: 'Kujya' },
  date: { EN: 'Date', RW: 'Itariki' },
  time: { EN: 'Time', RW: 'Isaha' },
  passenger: { EN: 'Passenger', RW: 'Umurwayi' },
  downloadTicket: { EN: 'Download Ticket', RW: 'Kurura Ikarita' },
  shareTicket: { EN: 'Share Ticket', RW: 'Sangira Ikarita' },
  backHome: { EN: 'Back to Home', RW: 'Subira Ahande' },

  // Tickets page
  myTickets: { EN: 'My Tickets', RW: 'Amakarita Yanjye' },
  manageTickets: { EN: 'Manage your bus tickets', RW: 'Genzura amakarita yawe ya bisi' },
  upcoming: { EN: 'Upcoming', RW: 'Biraza' },
  past: { EN: 'Past', RW: 'Byashize' },
  cancelled: { EN: 'Cancelled', RW: 'Byavanywemo' },
  noUpcoming: { EN: 'No upcoming trips. Book your next journey!', RW: 'Nta rugendo ruraza. Tumiza rugendo rwawe rukurikira!' },
  noPast: { EN: 'No past trips yet', RW: 'Nta rugendo rushize' },
  noCancelled: { EN: 'No cancelled tickets', RW: 'Nta makarita yavanywemo' },

  // Profile
  totalTrips: { EN: 'Total Trips', RW: 'Ingendo Zose' },
  rating: { EN: 'Rating', RW: 'Amanota' },
  savedPassengers: { EN: 'Saved Passengers', RW: 'Abanyerendo Bashinzwe' },
  paymentMethods: { EN: 'Payment Methods', RW: 'Uburyo bwo Kwishyura' },
  notifications: { EN: 'Notifications', RW: 'Amakuru' },
  language: { EN: 'Language', RW: 'Ururimi' },
  helpSupport: { EN: 'Help & Support', RW: 'Ubufasha' },
  logout: { EN: 'Logout', RW: 'Gusohoka' },

  // Chat
  rugendo: { EN: 'Rugendo', RW: 'Rugendo' },
  online: { EN: 'Online · Ready to help', RW: 'Ahari · Witeguye gufasha' },
  askRugendo: { EN: 'Ask Rugendo anything...', RW: 'Baza Rugendo ikintu cyose...' },
  rugendoWelcome1: { EN: 'Muraho! Nitwa Rugendo 🚌', RW: 'Muraho! Nitwa Rugendo 🚌' },
  rugendoWelcome2: {
    EN: 'I can help you find buses, compare prices, and book your trip in Rwanda! Where are you headed today? 😊',
    RW: 'Nshobora gufasha mu gushakisha bisi, kugereranya ibiciro, no gutumiza urugendo rwawe mu Rwanda! Ugiye he uyu munsi? 😊',
  },
  suggestion1: { EN: 'Kigali to Musanze 🌿', RW: 'Kigali kujya Musanze 🌿' },
  suggestion2: { EN: 'Cheapest bus today?', RW: 'Bisi igura uyu munsi?' },
  suggestion3: { EN: 'Next departure?', RW: 'Gusohoka gusaza?' },
  suggestion4: { EN: 'Help me book 🎫', RW: 'Ndamfasha gutumiza 🎫' },

  // Splash
  tagline: { EN: 'Your personal secure journey app', RW: 'Porogaramu yawe y\'urugendo rwizewe' },
  getStarted: { EN: 'Get Started', RW: 'Tangira' },
  orContinue: { EN: 'or continue with', RW: 'cyangwa komereza na' },
  noAccount: { EN: "Don't have an account? ", RW: 'Ufite konti? ' },
  createOne: { EN: 'Create one', RW: 'Fungura konti' },

  // City Picker
  selectDeparture: { EN: 'Select Departure', RW: 'Hitamo Aho Uva' },
  selectDestination: { EN: 'Select Destination', RW: 'Hitamo Aho Ujya' },

  // Seats extra
  noTrip: { EN: 'No trip selected', RW: 'Nta rugendo wahisemo' },
  driver: { EN: 'Driver', RW: 'Umushoferi' },
  searchBuses2: { EN: 'Search Buses', RW: 'Shakisha Bisi' },

  // Payment extra
  noBooking: { EN: 'No booking in progress', RW: 'Nta gutumiza gukomeje' },
  mtnMomo: { EN: 'MTN Mobile Money', RW: 'MTN Mobile Money' },
  airtelMoney: { EN: 'Airtel Money', RW: 'Airtel Money' },
  bankCard: { EN: 'Bank Card', RW: 'Ikarita ya Banki' },
  processing: { EN: '⏳ Processing...', RW: '⏳ Birakora...' },
  totalLabel: { EN: 'Total', RW: 'Igiteranyo' },
};

export function t(key: TranslationKey, lang: Language): string {
  return translations[key]?.[lang] || translations[key]?.EN || key;
}
