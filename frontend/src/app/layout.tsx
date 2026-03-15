import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-display",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-ui",
});

export const metadata: Metadata = {
  title: "Lumina | Ambient Intelligence",
  description: "Turn natural language into interactive data dashboards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${manrope.variable} ${ibmPlexMono.variable} min-h-screen antialiased bg-background text-foreground selection:bg-primary/30`}>
        {children}
      </body>
    </html>
  );
}
