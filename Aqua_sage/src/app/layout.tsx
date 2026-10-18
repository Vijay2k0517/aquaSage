import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AquaSage — 3D IoT Digital Twin Simulator",
  description: "Precision Industrial 3D Digital Twin and Telemetry Simulator for Water Infrastructure Monitoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} bg-[#0B0F19] text-slate-100 antialiased min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
