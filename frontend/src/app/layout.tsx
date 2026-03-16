import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["300", "400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-ui",
});

export const metadata: Metadata = {
  title: "Lumina | Neural Intelligence Platform",
  description: "Transform raw data into executive-grade dashboards with AI-powered natural language queries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} min-h-screen antialiased bg-background text-foreground selection:bg-violet-500/30 selection:text-violet-100`}>
        {children}
      </body>
    </html>
  );
}
