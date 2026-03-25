import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const mainTitle = "AntigravityChess ⚡️ Ultra-High Speed Hyperbullet";
const description = "The ultimate high-performance chess arena. Hyperbullet, Edge-powered, Sub-second moves.";

export const metadata: Metadata = {
  title: {
    default: mainTitle,
    template: `%s | AntigravityChess`
  },
  description,
  metadataBase: new URL("https://antigravitychess.io"),
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    title: mainTitle,
    description,
    url: "https://antigravitychess.io",
    siteName: "AntigravityChess",
    images: [{ url: "/og-image.png" }]
  },
  twitter: {
    card: "summary_large_image",
    title: mainTitle,
    description
  }
};

import { SpeedInsights } from "@vercel/speed-insights/next";
import AppBackground from "@/components/AppBackground";
import SettingsPanel from "@/components/SettingsPanel";
import { SettingsProvider } from "@/providers/SettingsProvider";

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
      <body className="min-h-full flex flex-col transition-colors duration-700">
        <SettingsProvider>
          <AppBackground />
          <div className="relative z-10 flex-1">
            {children}
          </div>
          <SettingsPanel />
          <SpeedInsights />
        </SettingsProvider>
      </body>
    </html>
  );
}
