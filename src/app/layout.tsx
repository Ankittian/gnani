import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { fontVariables } from "./fonts";
import { Providers } from "@/components/layout/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dukaan Dost",
  description: "Voice-first assistant for kirana stores — khata, stock, orders and hisaab in your language. Built on Gnani Prisma & Timbre.",
  applicationName: "Dukaan Dost",
  appleWebApp: { capable: true, title: "Dukaan Dost", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#060a18",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hi" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
