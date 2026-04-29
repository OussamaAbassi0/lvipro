import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LVI Control Center V2",
  description:
    "Dashboard centralisé des automations commerciales — LED Visual Innovation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="antialiased" style={{ background: "var(--bg)", color: "var(--navy)" }}>
        {children}
      </body>
    </html>
  );
}
