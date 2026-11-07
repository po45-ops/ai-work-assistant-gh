import type { Metadata } from "next";
import "./globals.css";
import { Noto_Sans_Thai } from "next/font/google";
const thai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-thai",
});

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "AI Personal Work Assistant",
  description: "ผู้ช่วยจัดงานส่วนตัว วางแผนงาน และติดตามโปรเจกต์",
  applicationName: "Po · AI Work Assistant",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={thai.variable}>{children}</body>
    </html>
  );
}
