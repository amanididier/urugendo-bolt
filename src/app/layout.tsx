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

export const metadata: Metadata = {
  title: "Urugendo — Rwanda's Journey App",
  description: "Search, compare, and book bus tickets across Rwanda",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Urugendo",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.variable} antialiased bg-[#0A1A12]`}>
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
              window.addEventListener('urugendo-trip-delayed', (e) => {
                try {
                  const dest = e.detail?.destination || 'Rubavu';
                  const existing = localStorage.getItem('urugendo_user_notifications');
                  const parsed = existing ? JSON.parse(existing) : [];
                  const newNotif = {
                    id: 'notif-' + Date.now(),
                    title: 'Trip Alert',
                    message: '⚠️ Trip Alert: Your trip to ' + dest + ' has been delayed for 15 minutes due to heavy rainfall on the road. We appreciate your patience!',
                    type: 'alert',
                    read: false,
                    createdAt: new Date().toISOString()
                  };
                  localStorage.setItem('urugendo_user_notifications', JSON.stringify([newNotif, ...parsed]));
                } catch(err) {}
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
