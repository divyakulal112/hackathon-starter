import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import { AppStateProvider } from "@/context/AppStateContext";

export const metadata: Metadata = {
  title: "KisanSync — Smart Procurement Coordination",
  description:
    "KisanSync coordinates farmer demand with procurement-centre capacity: transparent recommendations, token booking, and live procurement-to-payment tracking.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <AppStateProvider>{children}</AppStateProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
