import type { Metadata } from "next";
import { PwaRegistrar } from "@/components/PwaRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "KiJu Lager",
  description: "Scanner-optimierte Lagerverwaltung für MUNBYN IPDA082P",
  applicationName: "KiJu Lager",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "KiJu Lager",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
