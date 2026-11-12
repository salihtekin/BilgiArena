import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BilgiArena — Oyun zamanı.",
  description: "Kelime, hafıza, matematik ve bilgi oyunları. 10/15 saniyelik aşamalar, haftalık sıralama ve Android’de çevrimdışı antrenman.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/app-icon.png",
    shortcut: "/app-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
