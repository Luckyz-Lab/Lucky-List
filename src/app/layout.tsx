import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import { AppQueryProvider } from "@/components/app/query-provider";
import { ServiceWorkerCleanup } from "@/components/app/service-worker-cleanup";
import "./globals.css";

const geist = Geist({
  variable: "--font-latin",
  subsets: ["latin"],
  display: "swap",
});

const notoThai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lucky List",
  description: "Online-first task manager for personal work.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Lucky List",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${geist.variable} ${notoThai.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppQueryProvider>
          <ServiceWorkerCleanup />
          {children}
        </AppQueryProvider>
      </body>
    </html>
  );
}
