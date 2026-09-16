import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/app-context";
import { ClientLayout } from "@/components/ClientLayout";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const SITE_URL = "https://urugendo-v0.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Urugendo",
  title: {
    default:
      "Urugendo — #1 Bus Booking Platform in Rwanda | Kigali to Musanze & Beyond",
    template: "%s | Urugendo - Rwanda's Journey App",
  },
  description:
    "Urugendo is the best bus booking platform in Rwanda — application yo gutegeraho bisi. Book intercity buses from Kigali to Musanze, Rubavu, Huye, Rusizi, Nyagatare & Kayonza. Fast, secure & reliable online bus ticket reservation.",
  keywords: [
    "Urugendo",
    "Rwanda bus booking",
    "bus booking Rwanda",
    "online bus ticket Rwanda",
    "intercity bus booking Rwanda",
    "Kigali to Musanze bus",
    "Kigali Musanze bus ticket",
    "Kigali to Rubavu bus",
    "Kigali to Huye bus",
    "Kigali to Rusizi bus",
    "Kigali to Nyagatare bus",
    "Kigali to Kayonza bus",
    "best bus booking platform in Rwanda",
    "the best bus booking platform in Rwanda",
    "cheapest bus booking Rwanda",
    "express bus Rwanda",
    "Rwanda travel app",
    "bus reservation Rwanda",
    "public transport Rwanda",
    "buy bus ticket Rwanda online",
    "compare bus prices Rwanda",
    "réservation bus Rwanda",
    "billet de bus Rwanda",
    "billet de bus Kigali",
    "transport en bus Rwanda",
    "bus interurbain Rwanda",
    "application réservation bus Rwanda",
    "meilleure plateforme réservation bus Rwanda",
    "billet Kigali Musanze",
    "voyage en bus Kigali",
    "réserver billet bus Rwanda",
    "application yo gutegeraho bisi",
    "application yo gutegeraho bus",
    "porogaramu yo gutegeraho bisi",
    "gutegura urugendo Rwanda",
    "kubona bisi Kigali",
    "amatike ya bisi Rwanda",
    "bisi Kigali Musanze",
    "bisi Kigali Rubavu",
    "bisi Kigali Huye",
    "kubona itike ya bisi",
    "urugendo app Rwanda",
    "gahigo ko gutegura urugendo",
    "gutega bisi mu Rwanda",
    "tega bisi online Rwanda",
  ],
  authors: [{ name: "Urugendo", url: SITE_URL }],
  creator: "Urugendo",
  publisher: "Urugendo",
  category: "Travel",
  classification: "Bus Booking & Travel",
  verification: {
    google: "IuUgRT8BnOTNOGBbpHnATPZCOI1ylQe4lLZSFcNyyKM",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_RW",
    url: SITE_URL,
    siteName: "Urugendo",
    title: "Urugendo — #1 Bus Booking Platform in Rwanda",
    description:
      "Book intercity buses across Rwanda in seconds. Kigali to Musanze, Rubavu, Huye & beyond — the fastest application yo gutegeraho bisi/bus. Secure, reliable, 24/7.",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "Urugendo - Rwanda's #1 Bus Booking Platform",
      },
      {
        url: "/icon-192.png",
        width: 192,
        height: 192,
        alt: "Urugendo App Icon",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Urugendo — #1 Bus Booking Platform in Rwanda",
    description:
      "Best bus booking platform in Rwanda. Kigali to Musanze & all intercity routes — book in seconds. Application yo gutegeraho bisi.",
    images: ["/icon-512.png"],
    creator: "@urugendo",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Urugendo",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", sizes: "any", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#00B85C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#organization`,
      name: "Urugendo",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon-512.png`,
      },
      description:
        "Urugendo — Rwanda's #1 bus booking platform. Application yo gutegeraho bisi for intercity travel across Rwanda.",
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      url: SITE_URL,
      name: "Urugendo — #1 Bus Booking Platform in Rwanda",
      publisher: { "@id": `${SITE_URL}#organization` },
      inLanguage: ["en-RW", "fr-RW", "rw-RW"],
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "TravelAgency",
      name: "Urugendo",
      url: SITE_URL,
      description:
        "Best bus booking platform in Rwanda — book Kigali to Musanze, Rubavu, Huye, Rusizi and all intercity routes online.",
      areaServed: { "@type": "Country", name: "Rwanda" },
      availableLanguage: ["en", "fr", "rw"],
      priceRange: "$$",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.variable} antialiased bg-[#0A1A12]`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <AppProvider>
          <ClientLayout>{children}</ClientLayout>
        </AppProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
