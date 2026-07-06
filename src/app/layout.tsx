import type { Metadata } from "next";
import { Inter, Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/app/service-worker-register";
import "./globals.css";

const inter = Inter({
  variable: "--font-latin",
  subsets: ["latin"],
  display: "swap",
});

const notoThai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lucky List",
  description: "Hybrid offline-first task manager for personal work.",
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
      className={`${inter.variable} ${notoThai.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
