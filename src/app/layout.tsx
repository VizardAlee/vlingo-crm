import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRegistrar } from "@/components/pwa/pwa-registrar";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vlingo Systems CRM",
  description: "Secure business operations platform for Vlingo Systems Nig. Ltd.",
  applicationName: "Vlingo Systems CRM",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vlingo CRM",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/icons/icon-192x192.png",
    icon: "/icons/icon-192x192.png",
    shortcut: "/icons/icon-192x192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#155f16",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#155f16",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <PwaRegistrar />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
