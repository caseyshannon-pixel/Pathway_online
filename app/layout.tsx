import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const rawHelp = process.env.HELP_EMAIL?.trim() ?? "";
  const helpEmail = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(rawHelp) ? rawHelp : "";

  return (
    <html lang="en" className={`${archivo.variable} ${archivoBlack.variable}`}>
      <body>
        {children}
        {helpEmail && (
          <footer className="site-footer">
            Need help? <a href={`mailto:${helpEmail}`}>Email {helpEmail}</a>
          </footer>
        )}
      </body>
    </html>
  );
}
