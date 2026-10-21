import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import "./globals.css";
import { getSession } from "@/lib/session";
import HelpFooter from "@/components/HelpFooter";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", axes: ["wdth"] });
const archivoBlack = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--font-archivo-black" });

export const metadata: Metadata = {
  title: "Pathway Online",
  description: "The Rock's Pathway course, online.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="en" className={`${archivo.variable} ${archivoBlack.variable}`}>
      <body>
        {children}
        <HelpFooter name={session?.name ?? ""} />
      </body>
    </html>
  );
}
